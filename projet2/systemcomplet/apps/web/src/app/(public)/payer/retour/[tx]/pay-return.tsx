"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { money } from "@/lib/format";

const PAYLINK_KEY = "globus_paylink_token";

interface TxStatus {
  status: string;
  transaction_status: string;
  amount: string;
  currency: string;
  number?: string | null;
  failure_reason?: string | null;
}

/** Retour de la page de l'opérateur (Orange Money, carte) : le statut est relu chez l'opérateur, jamais déduit de l'URL. */
export function PayReturn({ tx }: { tx: string }) {
  const [status, setStatus] = useState<TxStatus | null>(null);
  const [unknown, setUnknown] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem(PAYLINK_KEY);
    if (!token) {
      setUnknown(true);
      return;
    }
    let stop = false;
    const poll = async (attempt: number) => {
      try {
        const s = await api<TxStatus>(`/public/pay/${encodeURIComponent(token)}/transactions/${encodeURIComponent(tx)}`);
        if (stop) return;
        setStatus(s);
        if (["succeeded", "failed", "cancelled", "expired"].includes(s.status)) {
          if (s.status === "succeeded") sessionStorage.removeItem(PAYLINK_KEY);
          return;
        }
      } catch {
        if (attempt > 3) setUnknown(true);
      }
      if (attempt < 36) setTimeout(() => void poll(attempt + 1), 5000);
    };
    void poll(0);
    return () => {
      stop = true;
    };
  }, [tx]);

  const box = "rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-card)] ring-1 ring-line";
  if (status?.status === "succeeded") {
    return (
      <div className={box}>
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-brand-800">Paiement confirmé</h1>
        <p className="mt-2 text-muted">
          {money(status.amount, status.currency === "XAF" ? "FCFA" : status.currency)} reçus{status.number ? ` (réf. ${status.number})` : ""}. Merci ! Votre reçu est
          disponible dans votre espace client.
        </p>
      </div>
    );
  }
  if (status && ["failed", "cancelled", "expired"].includes(status.status)) {
    return (
      <div className={box}>
        <XCircle className="mx-auto h-14 w-14 text-red-600" />
        <h1 className="mt-4 text-2xl font-bold text-brand-800">Paiement non abouti</h1>
        <p className="mt-2 text-muted">{status.failure_reason ?? "L'opérateur n'a pas confirmé le paiement."} Vous pouvez réessayer depuis le lien reçu.</p>
      </div>
    );
  }
  if (unknown) {
    return (
      <div className={box}>
        <Loader2 className="mx-auto h-12 w-12 text-brand-400" />
        <h1 className="mt-4 text-xl font-bold text-brand-800">Paiement en cours de confirmation</h1>
        <p className="mt-2 text-muted">Dès que l&apos;opérateur confirme votre règlement, vous recevez votre reçu par e-mail et il apparaît dans votre espace client.</p>
      </div>
    );
  }
  return (
    <div className={box}>
      <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-500" />
      <h1 className="mt-4 text-xl font-bold text-brand-800">Confirmation auprès de l&apos;opérateur…</h1>
      <p className="mt-2 text-muted">Merci de patienter quelques secondes.</p>
    </div>
  );
}
