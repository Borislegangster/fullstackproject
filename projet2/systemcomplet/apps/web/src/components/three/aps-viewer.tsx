"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";

import type { BimMarker, BimPick, BimViewerHandle, CameraState } from "./bim-viewer";

declare global {
  interface Window {
    Autodesk?: any;
  }
}

const BASE = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*";
let scriptPromise: Promise<void> | null = null;

function loadViewerScript(): Promise<void> {
  if (window.Autodesk?.Viewing) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `${BASE}/style.min.css`;
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = `${BASE}/viewer3D.min.js`;
      js.async = true;
      js.onload = () => resolve();
      js.onerror = () => {
        scriptPromise = null;
        reject(new Error("Visionneuse Autodesk inaccessible (réseau)"));
      };
      document.head.appendChild(js);
    });
  }
  return scriptPromise;
}

export interface ApsSource {
  key: string;
  name: string;
  urn: string;
  visible: boolean;
  region?: string | null;
}

/** Visionneuse Autodesk Platform Services (formats natifs RVT, DWG, NWD, IFC…) avec fédération multi-modèles. */
export const ApsViewer = forwardRef<
  BimViewerHandle,
  { sources: ApsSource[]; markers?: BimMarker[]; onPick?: (pick: BimPick) => void; onMarkerClick?: (id: string) => void; onCameraChange?: (c: CameraState) => void; className?: string }
>(function ApsViewer({ sources, markers = [], onPick, onMarkerClick, onCameraChange, className }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<any>(null);
  const loaded = useRef(new Map<string, any>());
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState<{ id: string; x: number; y: number; color?: string; label?: string }[]>([]);
  const cb = useRef({ onPick, onCameraChange, markers });
  cb.current = { onPick, onCameraChange, markers };

  const projectMarkers = () => {
    const v = viewer.current;
    if (!v || !host.current) return;
    const THREE = window.Autodesk?.Viewing?.Private ? (window as any).THREE : null;
    if (!THREE) return;
    setOverlay(
      cb.current.markers
        .map((m) => {
          const p = v.worldToClient(new THREE.Vector3(m.position.x, m.position.y, m.position.z));
          return { id: m.id, x: p.x, y: p.y, color: m.color, label: m.label };
        })
        .filter((m) => m.x >= 0 && m.y >= 0),
    );
  };

  useEffect(() => {
    const models = loaded.current;
    let disposed = false;
    const region = sources.find((s) => s.region)?.region ?? "US";
    (async () => {
      try {
        await loadViewerScript();
        const Autodesk = window.Autodesk;
        await new Promise<void>((resolve) =>
          Autodesk.Viewing.Initializer(
            {
              env: "AutodeskProduction2",
              api: region === "EMEA" ? "streamingV2_EU" : "streamingV2",
              getAccessToken: (callback: (token: string, expires: number) => void) => {
                api<{ access_token: string; expires_in: number }>("/bim/viewer-token")
                  .then((t) => callback(t.access_token, t.expires_in))
                  .catch((err) => setError(errorMessage(err)));
              },
            },
            () => resolve(),
          ),
        );
        if (disposed || !host.current) return;
        const v = new Autodesk.Viewing.GuiViewer3D(host.current, { extensions: ["Autodesk.DocumentBrowser"] });
        v.start();
        viewer.current = v;
        v.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, () => {
          projectMarkers();
          const nav = v.navigation;
          const pos = nav.getPosition();
          const target = nav.getTarget();
          cb.current.onCameraChange?.({ position: [pos.x, pos.y, pos.z], target: [target.x, target.y, target.z] });
        });
        v.container.addEventListener("click", (e: MouseEvent) => {
          const rect = v.container.getBoundingClientRect();
          const hit = v.clientToWorld(e.clientX - rect.left, e.clientY - rect.top, true);
          if (hit?.point) {
            const model = hit.model;
            const key = [...loaded.current.entries()].find(([, m]) => m === model)?.[0] ?? null;
            cb.current.onPick?.({ modelKey: key, objectName: String(hit.dbId ?? ""), expressId: hit.dbId, point: { x: hit.point.x, y: hit.point.y, z: hit.point.z } });
          }
        });
        setReady(true);
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
    return () => {
      disposed = true;
      viewer.current?.finish();
      viewer.current = null;
      models.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = viewer.current;
    if (!ready || !v) return;
    const Autodesk = window.Autodesk;
    sources.forEach((src) => {
      const model = loaded.current.get(src.key);
      if (model) {
        if (src.visible) v.showModel(model.id ?? model);
        else v.hideModel(model.id ?? model);
        return;
      }
      if (!src.visible) return;
      loaded.current.set(src.key, null);
      Autodesk.Viewing.Document.load(
        `urn:${src.urn}`,
        async (doc: any) => {
          const node = doc.getRoot().getDefaultGeometry();
          const m = await v.loadDocumentNode(doc, node, { keepCurrentModels: true, globalOffset: { x: 0, y: 0, z: 0 } });
          loaded.current.set(src.key, m);
        },
        (code: number, message: string) => setError(`${src.name} : ${message || `erreur ${code}`}`),
      );
    });
  }, [sources, ready]);

  useEffect(() => {
    projectMarkers();
  }, [markers, ready]);

  useImperativeHandle(ref, () => ({
    getCamera() {
      const v = viewer.current;
      if (!v) return null;
      const p = v.navigation.getPosition();
      const t = v.navigation.getTarget();
      return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
    },
    setCamera(c) {
      const v = viewer.current;
      const THREE = (window as any).THREE;
      if (!v || !THREE) return;
      v.navigation.setView(new THREE.Vector3(...c.position), new THREE.Vector3(...c.target));
    },
    fitAll() {
      viewer.current?.fitToView();
    },
    async snapshot() {
      const v = viewer.current;
      if (!v) return null;
      return new Promise<Blob | null>((resolve) => v.getScreenShot(v.container.clientWidth, v.container.clientHeight, (url: string) => fetch(url).then((r) => r.blob()).then(resolve).catch(() => resolve(null))));
    },
    setSection(axis) {
      const v = viewer.current;
      if (!v) return;
      if (!axis) v.setCutPlanes([]);
      else v.loadExtension("Autodesk.Section").then((ext: any) => ext?.activate?.(axis === "y" ? "z" : axis));
    },
    // Boîtes englobantes non exposées par la visionneuse APS : détection assistée via la visionneuse navigateur.
    elements: () => [],
  }));

  return (
    <div className={className ?? "h-[520px]"} style={{ position: "relative" }}>
      <div ref={host} className="absolute inset-0 overflow-hidden rounded-xl" />
      {overlay.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onMarkerClick?.(m.id)}
          className="absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
          style={{ left: m.x, top: m.y, backgroundColor: m.color ?? "#FB8C43" }}
          title={m.label}
          aria-label={m.label ?? "Annotation"}
        />
      ))}
      {error ? <div className="absolute inset-x-3 bottom-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 shadow">{error}</div> : null}
    </div>
  );
});
