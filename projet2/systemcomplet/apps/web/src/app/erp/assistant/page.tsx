"use client";

import { Suspense } from "react";

import { AssistantInbox } from "@/components/erp/assistant-inbox";

export default function AssistantPage() {
  return (
    <Suspense>
      <AssistantInbox />
    </Suspense>
  );
}
