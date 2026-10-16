"use client";

import { use } from "react";

import { QuoteDetail } from "@/components/erp/crm";

export default function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <QuoteDetail id={id} />;
}
