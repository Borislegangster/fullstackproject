"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { BillingHub } from "@/components/erp/billing";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("onglet") ?? "clients";
  return <BillingHub tab={tab} onTab={(t) => router.replace(`/erp/facturation?onglet=${t}`, { scroll: false })} />;
}

export default function BillingPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
