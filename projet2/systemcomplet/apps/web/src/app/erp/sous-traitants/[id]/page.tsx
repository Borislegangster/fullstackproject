"use client";

import { use } from "react";

import { SubcontractorDetail } from "@/components/erp/subcontracting";

export default function SubcontractorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SubcontractorDetail id={id} />;
}
