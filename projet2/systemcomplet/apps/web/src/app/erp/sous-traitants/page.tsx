"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SubcontractingHub } from "@/components/erp/subcontracting";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("onglet") ?? "sous-traitants";
  return <SubcontractingHub tab={tab} onTab={(t) => router.replace(`/erp/sous-traitants?onglet=${t}`, { scroll: false })} />;
}

export default function SubcontractingPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
