"use client";

import { openConsentManager } from "@/lib/consent";

export function ConsentLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => openConsentManager()}>
      Gérer les cookies
    </button>
  );
}
