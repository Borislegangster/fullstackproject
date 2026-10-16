"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { HrHub } from "@/components/erp/hr";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("onglet") ?? "personnel";
  return <HrHub tab={tab} onTab={(t) => router.replace(`/erp/rh?onglet=${t}`, { scroll: false })} />;
}

export default function HrPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
