"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";

import { Alert, Card, Skeleton } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";

interface TxStatus {
  transaction_id: string;
  provider?: string | null;
  flow?: "redirect" | "push" | null;
  instructions?: string | null;
  expires_at?: string | null;
  status: string;
  payment_status?: string | null;
  amount: string;
  currency: string;
  failure_reason?: string | null;
  payment_number?: string | null;
  receipt_available: boolean;
  payment_id?: string | null;
}

const FINAL = new Set(["succeeded", "failed", "cancelled", "expired"]);

/** Retour du prestataire de paiement : suivi du statut (confirmé par webhook signé côté serveur). */
export default function PaymentReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tx, setTx] = useState<TxStatus | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const poll = async (attempt: number) => {
      try {
        const res = await api<TxStatus>(`/payments/transactions/${id}`);
        if (cancelled) return;
        setTx(res);
        setTries(attempt);
        if (FINAL.has(res.status) || attempt > 90) {
          if (res.status === "succeeded" && res.payment_id) {
            const detail = await api<{ receipt_url?: string | null }>(`/client/payments/${res.payment_id}`).catch(() => null);
            if (!cancelled) setReceipt(detail?.receipt_url ?? null);
          }
          return;
        }
        timer = setTimeout(() => void poll(attempt + 1), Math.min(6000, 2500 + attempt * 250));
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    };
    void poll(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!tx) return <Skeleton className="h-64 w-full max-w-xl" />;
  const cur = tx.currency === "XAF" ? "FCFA" : tx.currency;
  const done = tx.status === "succeeded";
  const failed = ["failed", "cancelled", "expired"].includes(tx.status);
  return (
    <div className="mx-auto max-w-xl">
      <Card className="p-8 text-center">
        {done ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /> : failed ? <XCircle className="mx-auto h-14 w-14 text-red-600" /> : <Clock className="mx-auto h-14 w-14 animate-pulse text-amber-500" />}
        <h1 className="mt-4 text-2xl font-bold text-brand-800">
          {done ? "Paiement confirmé" : failed ? "Paiement non abouti" : tx.flow === "push" ? "Validez le paiement sur votre téléphone" : "Paiement en cours de confirmation"}
        </h1>
        <p className="mt-2 text-muted">
          {money(tx.amount, cur)} {tx.payment_number ? `· ${tx.payment_number}` : ""}
        </p>
        {failed && tx.failure_reason ? <p className="mt-2 text-sm text-red-700">{tx.failure_reason}</p> : null}
        {!done && !failed && tx.instructions ? <Alert tone="info">{tx.instructions}</Alert> : null}
        {!done && !failed ? <p className="mt-3 text-sm text-muted">Confirmation par l'opérateur… ({tries + 1})</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {receipt ? (
            <a href={receipt} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
              Télécharger le reçu
            </a>
          ) : null}
          <Link href="/espace-client/finances" className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
            Retour aux finances
          </Link>
        </div>
      </Card>
    </div>
  );
}
