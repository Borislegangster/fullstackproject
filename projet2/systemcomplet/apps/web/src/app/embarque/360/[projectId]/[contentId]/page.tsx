"use client";

import { use } from "react";

import { ImmersiveViewer } from "@/components/three/immersive-viewer";
import { useApi } from "@/lib/hooks";

interface Content {
  id: string;
  kind: string;
  title: string;
  url?: string | null;
}

/** Visite 360° (photo ou vidéo) pour les applications mobiles : gyroscope du téléphone, casque VR, plein écran. */
export default function Embedded360Page({ params }: { params: Promise<{ projectId: string; contentId: string }> }) {
  const { projectId, contentId } = use(params);
  const data = useApi<{ contents: Content[] }>(`/client/projects/${projectId}/immersion`);
  if (data.loading) return <p className="flex h-full items-center justify-center text-sm text-brand-200">Chargement de la visite…</p>;
  const content = data.data?.contents.find((c) => c.id === contentId);
  if (!content?.url) return <p className="flex h-full items-center justify-center px-6 text-center text-sm text-brand-200">{data.error ?? "Contenu indisponible."}</p>;
  return <ImmersiveViewer url={content.url} video={content.kind === "video_360"} className="h-full w-full" />;
}
