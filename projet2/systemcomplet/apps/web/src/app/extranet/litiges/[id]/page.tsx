"use client";

import { use } from "react";

import { DisputePage } from "@/components/extranet/subcontractor";

export default function DisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DisputePage id={id} />;
}
