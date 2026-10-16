"use client";

import { Suspense } from "react";

import { AccountView } from "@/components/account/account-view";

export default function ExtranetAccountPage() {
  return (
    <Suspense>
      <AccountView withPrivacy />
    </Suspense>
  );
}
