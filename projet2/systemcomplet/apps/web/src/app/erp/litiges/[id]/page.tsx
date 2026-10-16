"use client";

import { use } from "react";

import { DisputeDetail } from "@/components/erp/subcontracting";

export default function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DisputeDetail id={id} />;
}
