"use client";

import { Suspense } from "react";

import { AiHub } from "@/components/erp/ai";

export default function AiPage() {
  return (
    <Suspense>
      <AiHub />
    </Suspense>
  );
}
