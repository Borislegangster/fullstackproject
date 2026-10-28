"use client";

import { use } from "react";

import { toApp } from "../../bridge";
import { FederatedViewer, type Federation } from "@/components/three/federated-viewer";
import { useApi } from "@/lib/hooks";

/** Maquette 3D fédérée (calques par discipline, coupe) pour les applications mobiles : client ou équipe projet. */
export default function EmbeddedModelPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ source?: string }> }) {
  const { projectId } = use(params);
  const { source } = use(searchParams);
  const staff = source === "erp";
  const data = useApi<{ bim: Federation } | Federation>(staff ? `/projects/${projectId}/bim/federation` : `/client/projects/${projectId}/immersion`);
  if (data.loading) return <p className="flex h-full items-center justify-center text-sm text-brand-200">Chargement de la maquette…</p>;
  const federation = data.data ? ("bim" in data.data ? data.data.bim : data.data) : null;
  if (!federation) {
    toApp("error", { message: data.error ?? "Maquette indisponible" });
    return <p className="flex h-full items-center justify-center px-6 text-center text-sm text-brand-200">{data.error ?? "Maquette indisponible"}</p>;
  }
  if (!federation.models.length)
    return <p className="flex h-full items-center justify-center px-6 text-center text-sm text-brand-200">La maquette 3D sera publiée par votre équipe de conception.</p>;
  return <FederatedViewer federation={federation} className="min-h-0 w-full flex-1" />;
}
