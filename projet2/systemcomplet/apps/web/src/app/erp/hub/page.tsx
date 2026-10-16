"use client";

import { Suspense } from "react";

import { BimHub } from "@/components/erp/bim";

export default function HubPage() {
  return (
    <Suspense>
      <BimHub />
    </Suspense>
  );
}
