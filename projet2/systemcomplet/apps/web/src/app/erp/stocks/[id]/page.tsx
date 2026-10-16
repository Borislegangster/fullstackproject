"use client";

import { use } from "react";

import { StockItemDetail } from "@/components/erp/inventory";

export default function StockItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <StockItemDetail id={id} />;
}
