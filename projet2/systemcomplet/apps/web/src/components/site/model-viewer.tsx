"use client";

import dynamic from "next/dynamic";

const SceneViewer = dynamic(() => import("@/components/three/scene-viewer").then((m) => m.SceneViewer), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center rounded-2xl bg-brand-50 text-sm text-muted">Chargement de la 3D…</div>,
});

export function ModelViewer({ url, className }: { url: string; className?: string }) {
  return (
    <div className={className ?? "h-[420px]"}>
      <SceneViewer url={url} className="h-full" />
      <p className="mt-2 text-center text-xs text-muted">Faites pivoter la maquette au doigt ou à la souris, pincez pour zoomer.</p>
    </div>
  );
}
