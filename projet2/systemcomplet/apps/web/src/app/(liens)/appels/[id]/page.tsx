"use client";

import { use } from "react";

import { SpaceRedirect } from "@/components/shell/space-redirect";

export default function CallLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SpaceRedirect path={`/appels/${id}`} />;
}
