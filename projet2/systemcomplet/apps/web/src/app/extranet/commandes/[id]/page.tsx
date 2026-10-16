"use client";

import { use } from "react";

import { SupplierOrderPage } from "@/components/extranet/supplier";

export default function SupplierOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SupplierOrderPage id={id} />;
}
