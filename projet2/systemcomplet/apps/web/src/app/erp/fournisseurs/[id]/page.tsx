"use client";

import { use } from "react";

import { SupplierDetail } from "@/components/erp/suppliers";

export default function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SupplierDetail id={id} />;
}
