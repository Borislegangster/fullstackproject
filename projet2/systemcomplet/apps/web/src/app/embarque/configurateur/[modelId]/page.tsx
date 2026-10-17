"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";

import { fromApp, toApp } from "../../bridge";
import { SceneViewer, type MaterialSpec, type SceneViewerHandle } from "@/components/three/scene-viewer";
import { api, errorMessage } from "@/lib/api";

interface Material {
  id: string;
  color_hex?: string | null;
  roughness?: string | null;
  metalness?: string | null;
  texture_url?: string | null;
  normal_url?: string | null;
  texture_repeat?: string | null;
}
interface Zone {
  id: string;
  mesh_names: string[];
  default_material_id: string;
  materials: Material[];
}
interface Model {
  file_url?: string | null;
  zones: Zone[];
}
interface Scenario {
  id: string;
  items: { zone_id: string; material?: Material | null }[];
}

const spec = (m?: Material | null): MaterialSpec | null =>
  m ? { color_hex: m.color_hex, roughness: m.roughness, metalness: m.metalness, texture_url: m.texture_url, normal_url: m.normal_url, repeat: m.texture_repeat } : null;

/**
 * Aperçu 3D du configurateur pour les applications mobiles : le choix des matériaux se fait dans l'application,
 * qui pilote la scène (scénario courant, matériau d'une zone, capture) par le pont JavaScript.
 */
export default function EmbeddedConfiguratorPage({ params, searchParams }: { params: Promise<{ modelId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const { modelId } = use(params);
  const { scenario: initialScenario } = use(searchParams);
  const viewer = useRef<SceneViewerHandle>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const scenarioId = useRef<string | null>(initialScenario ?? null);

  const applyScenario = useCallback(
    async (id: string | null) => {
      if (!model || !ready) return;
      let items = new Map<string, Material | null | undefined>();
      if (id) {
        try {
          const list = await api<Scenario[]>(`/configurator/models/${modelId}/scenarios`);
          items = new Map((list.find((s) => s.id === id)?.items ?? []).map((i) => [i.zone_id, i.material]));
        } catch (err) {
          toApp("error", { message: errorMessage(err) });
        }
      }
      model.zones.forEach((z) => {
        const m = items.get(z.id) ?? z.materials.find((x) => x.id === z.default_material_id);
        const s = spec(m);
        if (s) viewer.current?.applyMaterial(z.mesh_names, s);
      });
    },
    [model, ready, modelId],
  );

  useEffect(() => {
    api<Model>(`/configurator/models/${modelId}`)
      .then(setModel)
      .catch((err) => {
        setError(errorMessage(err));
        toApp("error", { message: errorMessage(err) });
      });
  }, [modelId]);

  useEffect(() => {
    if (ready) void applyScenario(scenarioId.current);
  }, [ready, applyScenario]);

  useEffect(
    () =>
      fromApp((message) => {
        if (message.type === "scenario") {
          scenarioId.current = (message.id as string) ?? null;
          void applyScenario(scenarioId.current);
        } else if (message.type === "material" && Array.isArray(message.meshes)) {
          const s = spec(message.material as Material);
          if (s) viewer.current?.applyMaterial(message.meshes as string[], s);
        } else if (message.type === "highlight") {
          viewer.current?.highlight(Array.isArray(message.meshes) ? (message.meshes as string[]) : null);
        } else if (message.type === "reset") {
          viewer.current?.resetView();
        } else if (message.type === "snapshot") {
          void viewer.current?.snapshot().then(async (blob) => {
            if (!blob) return toApp("snapshot", { data: null });
            const reader = new FileReader();
            reader.onload = () => toApp("snapshot", { data: String(reader.result).split(",")[1] ?? null });
            reader.readAsDataURL(blob);
          });
        }
      }),
    [applyScenario],
  );

  if (error) return <p className="flex h-full items-center justify-center px-6 text-center text-sm text-brand-200">{error}</p>;
  if (!model) return <p className="flex h-full items-center justify-center text-sm text-brand-200">Chargement de la maquette…</p>;
  if (!model.file_url) return <p className="flex h-full items-center justify-center px-6 text-center text-sm text-brand-200">Aperçu 3D indisponible pour cette maquette.</p>;
  return (
    <SceneViewer
      ref={viewer}
      url={model.file_url}
      className="h-full w-full"
      onLoaded={(names) => {
        setReady(true);
        toApp("ready", { meshes: names.length });
      }}
      onPick={(name) => toApp("pick", { mesh: name })}
      onError={(message) => toApp("error", { message })}
    />
  );
}
