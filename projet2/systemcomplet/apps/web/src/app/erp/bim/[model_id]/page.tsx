"use client";

import { use } from "react";

import { ModelDetail } from "@/components/erp/bim";

export default function BimModelPage({ params }: { params: Promise<{ model_id: string }> }) {
  const { model_id } = use(params);
  return <ModelDetail modelId={model_id} />;
}
