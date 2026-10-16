"use client";

import { use } from "react";

import { SituationPage } from "@/components/extranet/subcontractor";

export default function SituationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SituationPage id={id} />;
}
