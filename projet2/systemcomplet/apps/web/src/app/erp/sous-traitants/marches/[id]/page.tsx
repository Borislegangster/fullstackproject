"use client";

import { use } from "react";

import { ContractDetail } from "@/components/erp/subcontracting";

export default function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ContractDetail id={id} />;
}
