"use client";

import { use } from "react";

import { ReceiptDetail } from "@/components/erp/deliveries";

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ReceiptDetail id={id} />;
}
