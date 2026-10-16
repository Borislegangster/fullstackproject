"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { NewsletterHub } from "@/components/erp/newsletter";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("onglet") ?? "campagnes";
  return <NewsletterHub tab={tab} onTab={(t) => router.replace(`/erp/newsletter?onglet=${t}`, { scroll: false })} />;
}

export default function NewsletterPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
