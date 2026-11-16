"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { FileViewer } from "@/components/ui/file-preview";

import { toApp } from "../bridge";

/** Lien d'accès contrôlé de l'API uniquement (même origine) : jamais une adresse externe. */
const SAFE_SOURCE = /^\/api\/v1\/[A-Za-z0-9\-._~%!$&'()*+,;=:@/?]+$/;

function Preview() {
  const params = useSearchParams();
  const src = params.get("src") ?? "";
  const name = (params.get("name") ?? "Document").slice(0, 200);
  if (!SAFE_SOURCE.test(src) || src.includes("//") || src.includes("..")) {
    return <p className="flex h-full items-center justify-center px-6 text-center text-sm text-brand-200">Document indisponible.</p>;
  }
  return (
    <div className="h-full bg-white text-ink">
      <FileViewer
        source={{ url: src, name }}
        fallbackAction={
          <button type="button" className="btn-brand !py-2.5 text-sm" onClick={() => toApp("open_external")}>
            Ouvrir avec une autre application
          </button>
        }
      />
    </div>
  );
}

/** Aperçu d'un document (PDF, Word, Excel, image, vidéo…) dans les applications mobiles, sans application tierce. */
export default function EmbeddedPreviewPage() {
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  );
}
