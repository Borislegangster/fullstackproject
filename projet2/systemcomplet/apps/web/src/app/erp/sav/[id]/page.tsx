"use client";

import { use } from "react";

import { StaffTicketPage } from "@/components/erp/support";

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <StaffTicketPage id={id} />;
}
