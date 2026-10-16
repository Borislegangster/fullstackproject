"use client";

import { use } from "react";

import { PaymentDetail } from "@/components/erp/finance";

export default function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PaymentDetail id={id} />;
}
