"use client";

import { Suspense } from "react";

import { AccountView } from "@/components/account/account-view";

export default function ErpAccountPage() {
  return (
    <Suspense>
      <AccountView />
    </Suspense>
  );
}
