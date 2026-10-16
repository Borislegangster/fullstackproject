"use client";

import { use } from "react";

import { SupplierInvoiceDetail } from "@/components/erp/billing";

export default function SupplierInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SupplierInvoiceDetail id={id} />;
}
