"use client";

import { use } from "react";

import { DocumentDetail } from "@/components/erp/ged";

export default function GedDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DocumentDetail id={id} />;
}
