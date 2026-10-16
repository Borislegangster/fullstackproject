"use client";

import clsx from "clsx";
import { Crosshair, Eye, EyeOff, Layers, Scissors } from "lucide-react";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";

import { apiUrl } from "@/lib/api";

import { ApsViewer } from "./aps-viewer";
import { BimViewer, type BimMarker, type BimPick, type BimViewerHandle, type CameraState } from "./bim-viewer";

export interface FederationModel {
  model_id: string;
  model: string;
  discipline: string;
  discipline_name: string;
  color: string;
  version_id: string;
  number: number;
  status: string;
  viewer: "three" | "aps" | string;
  urn?: string | null;
  format: string;
}

export interface Federation {
  project_id: string;
  disciplines: { key: string; name: string; color: string; visible_by_default?: boolean }[];
  models: FederationModel[];
}

/** Fédération multi-disciplines (V4-BIM-20) : calques, moteur adapté (navigateur ou Autodesk APS), coupe. */
export const FederatedViewer = forwardRef<
  BimViewerHandle,
  {
    federation: Federation;
    markers?: BimMarker[];
    cursors?: { id: string; name: string; position: { x: number; y: number; z: number }; color: string }[];
    onPick?: (pick: BimPick & { versionId?: string }) => void;
    onMarkerClick?: (id: string) => void;
    onCameraChange?: (c: CameraState) => void;
    className?: string;
    only?: string[];
  }
>(function FederatedViewer({ federation, markers, cursors, onPick, onMarkerClick, onCameraChange, className, only }, ref) {
  const models = useMemo(() => federation.models.filter((m) => !only || only.includes(m.version_id)), [federation, only]);
  const hasAps = models.some((m) => m.viewer === "aps" && m.urn);
  const hasThree = models.some((m) => m.viewer === "three");
  const [engine, setEngine] = useState<"three" | "aps">(hasThree ? "three" : "aps");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(federation.disciplines.filter((d) => d.visible_by_default === false).map((d) => d.key)));
  const [section, setSection] = useState<"x" | "y" | "z" | null>(null);
  const [ratio, setRatio] = useState(0.5);
  const inner = useRef<BimViewerHandle>(null);
  useImperativeHandle(ref, () => ({
    getCamera: () => inner.current?.getCamera() ?? null,
    setCamera: (c) => inner.current?.setCamera(c),
    fitAll: () => inner.current?.fitAll(),
    snapshot: async () => (inner.current ? inner.current.snapshot() : null),
    setSection: (axis, r) => inner.current?.setSection(axis, r),
    elements: (key) => inner.current?.elements(key) ?? [],
  }));

  const threeSources = models
    .filter((m) => m.viewer === "three")
    .map((m) => ({ key: m.version_id, name: `${m.model} (${m.discipline_name})`, url: apiUrl(`/bim/versions/${m.version_id}/file`), format: m.format, color: m.color, visible: !hidden.has(m.discipline) }));
  const apsSources = models.filter((m) => m.viewer === "aps" && m.urn).map((m) => ({ key: m.version_id, name: m.model, urn: m.urn!, visible: !hidden.has(m.discipline) }));
  const usedDisciplines = federation.disciplines.filter((d) => models.some((m) => m.discipline === d.key));

  if (!models.length) return <div className="flex h-64 items-center justify-center rounded-xl bg-brand-50 text-sm text-muted">Aucune maquette exploitable pour le moment.</div>;

  const toggleSection = (axis: "x" | "y" | "z" | null) => {
    setSection(axis);
    inner.current?.setSection(axis, ratio);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold text-muted">
          <Layers className="h-3.5 w-3.5" /> Disciplines
        </span>
        {usedDisciplines.map((d) => {
          const off = hidden.has(d.key);
          return (
            <button
              key={d.key}
              type="button"
              onClick={() =>
                setHidden((h) => {
                  const next = new Set(h);
                  if (next.has(d.key)) next.delete(d.key);
                  else next.add(d.key);
                  return next;
                })
              }
              className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1", off ? "bg-white text-muted ring-line" : "bg-white text-ink ring-brand-200")}
              aria-pressed={!off}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color, opacity: off ? 0.3 : 1 }} />
              {d.name}
              {off ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-1">
          {hasAps && hasThree ? (
            <select value={engine} onChange={(e) => setEngine(e.target.value as "three" | "aps")} className="rounded-lg border border-line bg-white px-2 py-1 text-xs" aria-label="Moteur de visualisation">
              <option value="three">Visionneuse navigateur</option>
              <option value="aps">Autodesk APS</option>
            </select>
          ) : null}
          <button type="button" onClick={() => inner.current?.fitAll()} className="rounded-lg p-1.5 text-muted hover:bg-white" title="Recentrer" aria-label="Recentrer">
            <Crosshair className="h-4 w-4" />
          </button>
          <span className="flex items-center gap-1 rounded-lg bg-white px-1.5 py-1 ring-1 ring-line">
            <Scissors className="h-3.5 w-3.5 text-muted" />
            {(["x", "y", "z"] as const).map((a) => (
              <button key={a} type="button" onClick={() => toggleSection(section === a ? null : a)} className={clsx("rounded px-1.5 text-xs uppercase", section === a ? "bg-brand-500 text-white" : "text-muted")}>
                {a}
              </button>
            ))}
            {section ? (
              <input
                type="range"
                min={0.05}
                max={0.95}
                step={0.01}
                value={ratio}
                onChange={(e) => {
                  setRatio(Number(e.target.value));
                  inner.current?.setSection(section, Number(e.target.value));
                }}
                className="w-20"
                aria-label="Position de la coupe"
              />
            ) : null}
          </span>
        </span>
      </div>
      {engine === "three" && hasThree ? (
        <BimViewer ref={inner} sources={threeSources} markers={markers} cursors={cursors} onPick={(p) => onPick?.({ ...p, versionId: p.modelKey ?? undefined })} onMarkerClick={onMarkerClick} onCameraChange={onCameraChange} className={className} />
      ) : hasAps ? (
        <ApsViewer ref={inner} sources={apsSources} markers={markers} onPick={(p) => onPick?.({ ...p, versionId: p.modelKey ?? undefined })} onMarkerClick={onMarkerClick} onCameraChange={onCameraChange} className={className} />
      ) : (
        <div className="flex h-64 items-center justify-center rounded-xl bg-brand-50 text-sm text-muted">Maquettes en cours de traitement.</div>
      )}
    </div>
  );
});
