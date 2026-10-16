"use client";

import { use } from "react";

import { TenderDetail } from "@/components/erp/subcontracting";

export default function TenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TenderDetail id={id} />;
}
