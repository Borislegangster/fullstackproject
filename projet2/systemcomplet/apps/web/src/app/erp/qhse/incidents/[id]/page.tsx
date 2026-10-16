"use client";

import { use } from "react";

import { IncidentDetail } from "@/components/erp/qhse";

export default function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <IncidentDetail id={id} />;
}
