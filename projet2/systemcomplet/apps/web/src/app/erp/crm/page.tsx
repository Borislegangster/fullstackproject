"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CrmHub } from "@/components/erp/crm";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("onglet") ?? "tableau";
  return <CrmHub tab={tab} onTab={(t) => router.replace(`/erp/crm?onglet=${t}`, { scroll: false })} />;
}

export default function CrmPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
