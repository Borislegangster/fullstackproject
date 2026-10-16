"use client";

import { use } from "react";

import { ExecutiveReportDetail } from "@/components/erp/executive";

export default function ExecutiveReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ExecutiveReportDetail id={id} />;
}
