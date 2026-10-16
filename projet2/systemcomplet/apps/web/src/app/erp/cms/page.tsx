"use client";

import { Suspense } from "react";

import { CmsHub } from "@/components/cms/cms-hub";

export default function CmsPage() {
  return (
    <Suspense>
      <CmsHub />
    </Suspense>
  );
}
