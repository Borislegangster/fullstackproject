"use client";

import { CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Field, Input } from "@/components/ui/form";
import { Alert, Button } from "@/components/ui/primitives";
import { api, errorMessage, newKey } from "@/lib/api";
import { date, money } from "@/lib/format";

interface PayView {
  company: string;
  kind: string;
  number: string;
  label: string;
  project_name?: string | null;
  currency: string;
  amount_due: string;
  balance_due: string;
  due_date?: string | null;
  installment?: { index: number; count: number; plan: string } | null;
  paid: boolean;
  methods: { provider: string; method: string; label: string; flow: "redirect" | "push"; requires_phone: boolean }[];
  expires_at: string;
}

export const PAYLINK_KEY = "globus_paylink_token";

/** Paiement en un clic depuis une relance (e-mail, WhatsApp, SMS) : aucune connexion requise. */
export function PayLink({ token }: { token: string }) {
  const [view, setView] = useState<PayView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ tx: string; instructions?: string | null } | null>(null);
  const [result, setResult] = useState<"succeeded" | "failed" | null>(null);
  const key = useRef(newKey());

  useEffect(() => {
    api<PayView>(`/public/pay/${encodeURIComponent(token)}`)
      .then(setView)
      .catch((err) => setLoadError(errorMessage(err)));
  }, [token]);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(async () => {
      try {
        const s = await api<{ status: string; failure_reason?: string | null }>(`/public/pay/${encodeURIComponent(token)}/transactions/${pending.tx}`);
        if (s.status === "succeeded") {
          setResult("succeeded");
          setPending(null);
        } else if (["failed", "cancelled", "expired"].includes(s.status)) {
          setResult("failed");
          setError(s.failure_reason ?? "Paiement non abouti");
          setPending(null);
        }
      } catch {
        /* nouvel essai au prochain tour */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [pending, token]);

  if (loadError) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-line">
        <XCircle className="mx-auto h-12 w-12 text-red-500" />
        <h1 className="mt-3 text-xl font-bold text-brand-800">Lien de paiement indisponible</h1>
        <p className="mt-2 text-muted">{loadError}</p>
      </div>
    );
  }
  if (!view) return <div className="h-96 animate-pulse rounded-3xl bg-white/70 ring-1 ring-line" />;
  const cur = view.currency === "XAF" ? "FCFA" : view.currency;
  if (view.paid || result === "succeeded") {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-card)] ring-1 ring-line">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-brand-800">Paiement reçu — merci !</h1>
        <p className="mt-2 text-muted">
          {view.kind} {view.number} : votre règlement est confirmé par l&apos;opérateur. Le reçu est disponible dans votre espace client.
        </p>
      </div>
    );
  }
  const m = view.methods[choice];
  const phoneOk = !m?.requires_phone || phone.replace(/\D/g, "").length >= 9;
  const pay = async () => {
    if (!m) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ transaction_id: string; checkout_url?: string | null; flow: string; instructions?: string | null }>(
        `/public/pay/${encodeURIComponent(token)}/checkout`,
        {
          method: "POST",
          idempotent: `${key.current}-${m.provider}-${m.method}-${m.requires_phone ? phone : ""}`,
          body: { provider: m.provider, method: m.method, payer_name: name, payer_phone: phone || null, payer_email: email || null },
        },
      );
      if (res.flow === "redirect" && res.checkout_url) {
        sessionStorage.setItem(PAYLINK_KEY, token);
        window.location.href = res.checkout_url;
        return;
      }
      setPending({ tx: res.transaction_id, instructions: res.instructions });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 p-6 text-white shadow-[var(--shadow-card)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{view.company}</p>
        <h1 className="mt-3 font-title text-2xl font-extrabold text-white">
          {view.kind} {view.number}
        </h1>
        <p className="mt-1 text-white/80">{view.label}</p>
        {view.project_name ? <p className="text-sm text-white/70">{view.project_name}</p> : null}
        <p className="mt-8 text-sm text-white/70">{view.installment ? `Échéance ${view.installment.index}/${view.installment.count} (${view.installment.plan})` : "Montant à régler"}</p>
        <p className="font-title text-5xl font-extrabold tabular-nums">{money(view.amount_due, cur)}</p>
        {view.installment ? <p className="mt-1 text-sm text-white/70">Solde total de la pièce : {money(view.balance_due, cur)}</p> : null}
        {view.due_date ? <p className="mt-1 text-sm text-white/70">Échéance : {date(view.due_date)}</p> : null}
        <p className="mt-8 flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck className="h-4 w-4" /> Lien personnel et sécurisé, valable jusqu&apos;au {date(view.expires_at)}.
        </p>
      </div>
      <div className="space-y-4 rounded-3xl bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
        {pending ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-500" />
            <p className="mt-4 font-semibold text-ink">Validez le paiement sur votre téléphone</p>
            <p className="mt-1 text-sm text-muted">{pending.instructions ?? "Composez votre code secret Mobile Money pour confirmer la demande."}</p>
            <p className="mt-4 text-xs text-muted">Cette page se met à jour automatiquement.</p>
          </div>
        ) : (
          <>
            <p className="font-semibold text-ink">Choisissez votre moyen de paiement</p>
            {view.methods.length ? (
              <div className="grid gap-2">
                {view.methods.map((x, i) => (
                  <label key={`${x.provider}-${x.method}`} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${choice === i ? "border-brand-400 bg-brand-50" : "border-line"}`}>
                    <input type="radio" name="method" checked={choice === i} onChange={() => setChoice(i)} />
                    {x.method === "card" ? <CreditCard className="h-5 w-5 text-brand-600" /> : <Smartphone className="h-5 w-5 text-accent-600" />}
                    <span className="text-sm font-medium">{x.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <Alert tone="warning">Aucun moyen de paiement en ligne n&apos;est disponible pour le moment. Contactez notre service comptable.</Alert>
            )}
            <Field label="Nom du payeur" required>
              <Input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </Field>
            {m?.requires_phone ? (
              <Field label="Numéro Mobile Money à débiter" required help="Vous recevrez une demande de paiement à valider avec votre code secret.">
                <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6 7X XX XX XX" />
              </Field>
            ) : null}
            <Field label="E-mail pour le reçu (facultatif)">
              <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Button variant="accent" size="lg" className="w-full" loading={busy} disabled={!m || name.trim().length < 2 || !phoneOk} onClick={() => void pay()}>
              <Lock className="h-4 w-4" /> Payer {money(view.amount_due, cur)}
            </Button>
            <p className="text-center text-xs text-muted">Paiement réel traité par l&apos;opérateur (MTN, Orange ou banque). Une seule opération est créée, même en cas de double clic.</p>
          </>
        )}
      </div>
    </div>
  );
}
