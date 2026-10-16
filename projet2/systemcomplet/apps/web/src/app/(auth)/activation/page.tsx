import type { Metadata } from "next";
import { Suspense } from "react";

import { ActivationForm } from "./activation-form";

export const metadata: Metadata = { title: "Activer mon accès — GLOBUS ENGINEERING", robots: { index: false, follow: false } };

export default function ActivationPage() {
  return (
    <Suspense>
      <ActivationForm />
    </Suspense>
  );
}
