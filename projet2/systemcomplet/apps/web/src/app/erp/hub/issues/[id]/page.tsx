"use client";

import { use } from "react";

import { IssueDetail } from "@/components/erp/bim";

export default function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <IssueDetail id={id} />;
}
