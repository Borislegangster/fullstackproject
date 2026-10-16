"use client";

import { use } from "react";

import { TenderPage } from "@/components/extranet/subcontractor";

export default function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TenderPage id={id} />;
}
