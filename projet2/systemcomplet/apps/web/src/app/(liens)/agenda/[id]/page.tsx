"use client";

import { use } from "react";

import { SpaceRedirect } from "@/components/shell/space-redirect";

export default function AgendaLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SpaceRedirect path={`/agenda/${id}`} />;
}
