"use client";

import { Suspense } from "react";

import { DocsCenter } from "@/components/docs/docs-center";

export default function ErpDocumentationPage() {
  return (
    <Suspense>
      <DocsCenter base="/erp" />
    </Suspense>
  );
}
