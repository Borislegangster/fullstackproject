"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { storeReferral } from "@/lib/referral";

export function ReferralWelcome({ code, days }: { code: string; days: number }) {
  useEffect(() => storeReferral(code, days), [code, days]);
  return (
    <div className="mt-10 flex flex-wrap justify-center gap-3">
      <Link href="/decrire-mon-projet" className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-accent-600">
        Décrire mon projet <ArrowRight className="h-4 w-4" />
      </Link>
      <Link href="/projets" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20">
        Voir nos réalisations
      </Link>
    </div>
  );
}
