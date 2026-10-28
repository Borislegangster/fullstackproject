"use client";

import { CreditCard, Download, FileText, Lock, Receipt, Smartphone } from "lucide-react";
import { useState } from "react";

import { WithProject } from "@/components/client/client-project";
import { EscrowPanel } from "@/components/client/escrow-panel";
import { MyPaymentPlans, PlanRequestDialog, type PaymentPlanRow } from "@/components/client/payment-plans";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Button, Card, CardHeader, PageTitle, Progress, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { api, errorMessage, newKey } from "@/lib/api";
import { date, money, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface Finances {
  summary: { contract_amount?: string | null; approved_changes: string; total_with_changes?: string; called: string; paid: string; due: string; overdue_count: number; remaining_to_call: string; currency: string };
  funds_calls: { id: string; number: string; label: string; amount: string; amount_paid: string; due_date?: string | null; status: string; invoice_id?: string | null }[];
  invoices: { id: string; number: string; title?: string | null; total: string; amount_paid: string; status: string; issue_date?: string | null; due_date?: string | null; pdf_url?: string | null }[];
  payments: { id: string; number: string; amount: string; status: string; method?: string | null; provider?: string | null; paid_at?: string | null; value_date?: string | null; receipt_url?: string | null }[];
  payment_methods: { provider: string; method: string; label: string; flow: "redirect" | "push"; requires_phone: boolean }[];
}

interface PayTarget {
  type: "funds_call" | "client_invoice";
  id: string;
  label: string;
  remaining: number;
}

function PayDialog({ target, methods, currency, onClose }: { target: PayTarget | null; methods: Finances["payment_methods"]; currency: string; onClose: () => void }) {
  const { user } = useAuth();
  const [choice, setChoice] = useState(0);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(() => newKey());
  if (!target) return null;
  const value = amount ? Number(amount) : target.remaining;
  const selected = methods[choice];
  const phoneOk = !selected?.requires_phone || phone.replace(/\D/g, "").length >= 9;
  const pay = async () => {
    const m = methods[choice];
    if (!m) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ checkout_url: string; transaction_id: string }>("/client/checkout", {
        method: "POST",
        idempotent: `${key}-${m.provider}-${m.method}-${value}-${m.requires_phone ? phone : ""}`,
        body: {
          target_type: target.type,
          target_id: target.id,
          provider: m.provider,
          method: m.method,
          amount: value < target.remaining ? value : null,
          payer_phone: m.requires_phone ? phone : null,
        },
      });
      const url = new URL(res.checkout_url, window.location.origin);
      window.location.href = url.origin === window.location.origin ? `${url.pathname}${url.search}` : res.checkout_url;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Paiement en ligne"
      description={target.label}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="accent" onClick={pay} loading={busy} disabled={!methods.length || !(value > 0) || value > target.remaining || !phoneOk}>
            <Lock className="h-4 w-4" /> Payer {money(value, currency)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {methods.length ? (
          <div className="grid gap-2">
            {methods.map((m, i) => (
              <label key={`${m.provider}-${m.method}`} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${choice === i ? "border-brand-400 bg-brand-50" : "border-line"}`}>
                <input type="radio" name="method" checked={choice === i} onChange={() => setChoice(i)} />
                {m.method === "card" ? <CreditCard className="h-5 w-5 text-brand-600" /> : <Smartphone className="h-5 w-5 text-accent-600" />}
                <span className="text-sm font-medium">{m.label}</span>
                <span className="ml-auto text-xs text-muted">{m.flow === "push" ? "Validation sur votre téléphone" : "Page sécurisée de l'opérateur"}</span>
              </label>
            ))}
          </div>
        ) : (
          <Alert tone="warning">Aucun moyen de paiement en ligne n'est activé. Contactez votre chargé d'affaires.</Alert>
        )}
        {selected?.requires_phone ? (
          <Field label="Numéro Mobile Money à débiter" help="Vous recevrez une demande de paiement à valider avec votre code secret.">
            <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6 7X XX XX XX" />
          </Field>
        ) : null}
        <Field label="Montant" help={`Reste à régler : ${money(target.remaining, currency)} — paiement partiel possible.`}>
          <Input type="number" min={1} max={target.remaining} value={amount} placeholder={String(target.remaining)} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Lock className="h-3.5 w-3.5" /> Paiement réel sécurisé par l'opérateur (MTN, Orange ou banque) ; une seule opération est créée même en cas de double clic.
        </p>
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </Modal>
  );
}

function FinancesContent({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const { data, error, loading, reload } = useApi<Finances>(`/client/projects/${projectId}/finances`);
  const plans = useApi<PaymentPlanRow[]>("/client/payment-plans");
  const [target, setTarget] = useState<PayTarget | null>(null);
  const [planTarget, setPlanTarget] = useState<PayTarget | null>(null);
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <Alert tone="danger">{error}</Alert>;
  const cur = data.summary.currency === "XAF" ? "FCFA" : data.summary.currency;
  const contract = toNumber(data.summary.contract_amount);
  const canPay = can("client:pay");
  const myPlans = (plans.data ?? []).filter((p) => p.project_id === projectId);
  const openPlan = (id: string) => myPlans.some((p) => p.target_id === id && ["requested", "proposed", "active"].includes(p.status));
  const refresh = () => {
    void reload();
    void plans.reload();
  };
  return (
    <div className="space-y-6">
      <PageTitle title="Finances" subtitle="Budget, appels de fonds, factures, paiements et reçus." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Montant du contrat (avenants non inclus)" value={money(contract, cur)} />
        <Stat label="Avenants approuvés" value={money(data.summary.approved_changes, cur)} hint="Facturés séparément du contrat" />
        <Stat label="Appelé" value={money(data.summary.called, cur)} hint={`Reste à appeler ${money(data.summary.remaining_to_call, cur)}`} />
        <Stat label="Payé" value={money(data.summary.paid, cur)} tone="success" />
        <Stat label="À régler" value={money(data.summary.due, cur)} tone={data.summary.overdue_count ? "danger" : "warning"} hint={data.summary.overdue_count ? `${data.summary.overdue_count} appel(s) en retard` : undefined} />
      </div>
      {contract > 0 ? (
        <Card className="p-5">
          <Progress value={(toNumber(data.summary.paid) / contract) * 100} label="Part du contrat réglée (appels de fonds, avenants non inclus)" tone="success" />
        </Card>
      ) : null}
      <MyPaymentPlans plans={myPlans} onChange={refresh} />
      <EscrowPanel projectId={projectId} currency={cur} onChange={refresh} />
      <Card>
        <CardHeader title="Appels de fonds" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2.5">N°</th>
                <th className="px-4 py-2.5">Objet</th>
                <th className="px-4 py-2.5">Échéance</th>
                <th className="px-4 py-2.5 text-right">Montant</th>
                <th className="px-4 py-2.5 text-right">Payé</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.funds_calls.map((c) => {
                const remaining = toNumber(c.amount) - toNumber(c.amount_paid);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 font-medium">{c.number}</td>
                    <td className="px-4 py-2.5">{c.label}</td>
                    <td className="px-4 py-2.5">{date(c.due_date)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(c.amount, cur)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(c.amount_paid, cur)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {canPay && remaining > 0 && ["issued", "partially_paid", "overdue"].includes(c.status) ? (
                        <span className="inline-flex gap-2">
                          {!openPlan(c.id) ? (
                            <Button size="sm" variant="ghost" onClick={() => setPlanTarget({ type: "funds_call", id: c.id, label: `${c.number} — ${c.label}`, remaining })}>
                              Échelonner
                            </Button>
                          ) : null}
                          <Button size="sm" variant="accent" onClick={() => setTarget({ type: "funds_call", id: c.id, label: `${c.number} — ${c.label}`, remaining })}>
                            Payer
                          </Button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!data.funds_calls.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">
                    Aucun appel de fonds émis.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Factures" />
          <ul className="divide-y divide-line">
            {data.invoices.map((i) => {
              const remaining = toNumber(i.total) - toNumber(i.amount_paid);
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-500" />
                    <span>
                      <span className="font-medium">{i.number}</span> {i.title ? `— ${i.title}` : ""}
                      <span className="block text-xs text-muted">
                        {money(i.total, cur)} · émise le {date(i.issue_date)} · échéance {date(i.due_date)}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={i.status} />
                    {i.pdf_url ? (
                      <a href={i.pdf_url} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50" aria-label="Télécharger la facture">
                        <Download className="h-4 w-4" />
                      </a>
                    ) : null}
                    {canPay && remaining > 0 && ["issued", "sent", "partially_paid", "overdue"].includes(i.status) ? (
                      <>
                        {!openPlan(i.id) ? (
                          <Button size="sm" variant="ghost" onClick={() => setPlanTarget({ type: "client_invoice", id: i.id, label: `Facture ${i.number}`, remaining })}>
                            Échelonner
                          </Button>
                        ) : null}
                        <Button size="sm" variant="secondary" onClick={() => setTarget({ type: "client_invoice", id: i.id, label: `Facture ${i.number}`, remaining })}>
                          Payer
                        </Button>
                      </>
                    ) : null}
                  </span>
                </li>
              );
            })}
            {!data.invoices.length ? <li className="px-5 py-4 text-sm text-muted">Aucune facture.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Paiements et reçus" />
          <ul className="divide-y divide-line">
            {data.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-brand-500" />
                  <span>
                    <span className="font-medium">{p.number}</span>
                    <span className="block text-xs text-muted">
                      {money(p.amount, cur)} · {optionLabel(p.method)} · {date(p.value_date ?? p.paid_at)}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  {p.receipt_url ? (
                    <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 underline">
                      Reçu
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
            {!data.payments.length ? <li className="px-5 py-4 text-sm text-muted">Aucun paiement.</li> : null}
          </ul>
        </Card>
      </div>
      <PayDialog target={target} methods={data.payment_methods} currency={cur} onClose={() => setTarget(null)} />
      <PlanRequestDialog target={planTarget ? { ...planTarget, currency: cur } : null} onClose={() => setPlanTarget(null)} onDone={refresh} />
    </div>
  );
}

export default function ClientFinancesPage() {
  return <WithProject>{(p) => <FinancesContent projectId={p.id} />}</WithProject>;
}
