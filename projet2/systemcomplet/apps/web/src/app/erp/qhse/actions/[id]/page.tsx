"use client";

import { use } from "react";

import { ActionDetail } from "@/components/erp/qhse";

export default function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ActionDetail id={id} />;
}
