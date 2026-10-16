"use client";

import { use } from "react";

import { OrderDetail } from "@/components/erp/procurement";

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OrderDetail id={id} />;
}
