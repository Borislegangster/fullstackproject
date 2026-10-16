"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { FinanceHub } from "@/components/erp/finance";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("onglet") ?? "pilotage";
  return <FinanceHub tab={tab} onTab={(t) => router.replace(`/erp/finances?onglet=${t}`, { scroll: false })} />;
}

export default function FinancePage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
