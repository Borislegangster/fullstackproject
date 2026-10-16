"use client";

import { use } from "react";

import { SituationDetail } from "@/components/erp/subcontracting";

export default function SituationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SituationDetail id={id} />;
}
