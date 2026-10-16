"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { QhseHub } from "@/components/erp/qhse";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("onglet") ?? "tableau";
  return <QhseHub tab={tab} onTab={(t) => router.replace(`/erp/qhse?onglet=${t}`, { scroll: false })} />;
}

export default function QhsePage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
