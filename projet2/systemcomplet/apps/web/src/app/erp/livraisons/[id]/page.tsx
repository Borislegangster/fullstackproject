"use client";

import { use } from "react";

import { DeliveryDetail } from "@/components/erp/deliveries";

export default function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DeliveryDetail id={id} />;
}
