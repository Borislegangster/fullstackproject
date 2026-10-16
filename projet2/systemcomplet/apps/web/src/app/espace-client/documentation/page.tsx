"use client";

import { Suspense } from "react";

import { DocsCenter } from "@/components/docs/docs-center";

export default function ClientDocumentationPage() {
  return (
    <Suspense>
      <DocsCenter base="/espace-client" />
    </Suspense>
  );
}
