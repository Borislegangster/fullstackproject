"use client";

import { use } from "react";

import { PayrollRunDetail } from "@/components/erp/hr";

export default function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PayrollRunDetail id={id} />;
}
