import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nouveau mot de passe — GLOBUS ENGINEERING", robots: { index: false, follow: false } };

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
