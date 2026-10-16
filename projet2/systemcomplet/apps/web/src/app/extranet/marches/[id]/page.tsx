"use client";

import { use } from "react";

import { ContractPage } from "@/components/extranet/subcontractor";

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ContractPage id={id} />;
}
