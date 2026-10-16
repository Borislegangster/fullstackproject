"use client";

import { Suspense } from "react";

import { DocsCenter } from "@/components/docs/docs-center";

export default function ExtranetDocumentationPage() {
  return (
    <Suspense>
      <DocsCenter base="/extranet" />
    </Suspense>
  );
}
