"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SupportHub } from "@/components/erp/support";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("onglet") ?? "tickets";
  return <SupportHub tab={tab} onTab={(t) => router.replace(`/erp/sav?onglet=${t}`, { scroll: false })} />;
}

export default function SupportPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
