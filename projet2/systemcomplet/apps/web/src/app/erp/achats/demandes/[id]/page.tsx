"use client";

import { use } from "react";

import { RequestDetail } from "@/components/erp/procurement";

export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequestDetail id={id} />;
}
