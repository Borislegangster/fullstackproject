"use client";

import { use } from "react";

import { EquipmentDetail } from "@/components/erp/equipment";

export default function EquipmentItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <EquipmentDetail id={id} />;
}
