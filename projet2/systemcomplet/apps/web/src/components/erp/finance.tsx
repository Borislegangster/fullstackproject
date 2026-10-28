"use client";

import { Banknote, Download, FileUp, Plus, ShieldCheck, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { RefSelect } from "@/components/forms/ref-select";
import { SchemaForm } from "@/components/forms/schema-form";
import { BarChartCard, LineChartCard } from "@/components/ui/charts";
import { Field, FileDrop, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Progress, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, apiUrl, errorMessage, newKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS, type RefSource } from "@/lib/refs";

const PAYMENT_STATUSES = ["awaiting_approval", "pending", "processing", "succeeded", "failed", "cancelled", "refunded"];
const METHODS = [
  { value: "bank_transfer", label: "Virement bancaire" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "cheque", label: "Chèque" },
  { value: "cash", label: "Espèces" },
];

/* ----------------------------------------------------------------------------- tableau de bord */

interface CashflowPoint {
  month: string;
  inflow: string;
  outflow: string;
  net: string;
  cumulative: string;
}

interface MarginRow {
  project_id: string;
  code: string;
  name: string;
  revenue: string;
  contract_amount?: string;
  approved_change_orders: string;
  budget: string | null;
  committed: string;
  spent: string;
  forecast_cost: string;
  gross_margin: string;
  gross_margin_pct: number | null;
  lots: { lot_id: string; code: string; name: string; budget: string; committed: string; spent: string; variance: string }[];
}

export function FinanceDashboard() {
  const [months, setMonths] = useState(6);
  const [projectId, setProjectId] = useState<string | null>(null);
  const cash = useApi<{ series: CashflowPoint[] }>("/finance/cashflow", { months, project_id: projectId ?? undefined });
  const margins = useApi<MarginRow[]>("/finance/margins");
  const receivables = useApi<{ id: string; number: string; project_id: string; amount_due: string; due_date: string | null; days_late: number | null }[]>("/finance/receivables");
  const awaiting = useApi<{ total: number }>("/payments", { status: "awaiting_approval", page_size: 1 });
  const series = (cash.data?.series ?? []).map((p) => ({
    month: new Date(`${p.month}-01`).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
    inflow: toNumber(p.inflow),
    outflow: toNumber(p.outflow),
    net: toNumber(p.net),
    cumulative: toNumber(p.cumulative),
  }));
  const totals = (margins.data ?? []).reduce(
    (acc, m) => ({ revenue: acc.revenue + toNumber(m.revenue), cost: acc.cost + toNumber(m.forecast_cost), spent: acc.spent + toNumber(m.spent), committed: acc.committed + toNumber(m.committed) }),
    { revenue: 0, cost: 0, spent: 0, committed: 0 },
  );
  const overdueTotal = (receivables.data ?? []).reduce((s, r) => s + toNumber(r.amount_due), 0);
  const projectName = (id: string) => margins.data?.find((m) => m.project_id === id);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Chiffre d'affaires contracté" value={money(totals.revenue)} hint="Contrats + avenants approuvés" tone="info" icon={<Banknote className="h-5 w-5" />} />
        <Stat label="Marge brute prévisionnelle" value={money(totals.revenue - totals.cost)} hint={totals.revenue ? `${number(((totals.revenue - totals.cost) * 100) / totals.revenue, 1)} %` : undefined} tone={totals.revenue - totals.cost >= 0 ? "success" : "danger"} />
        <Stat label="Engagé / dépensé" value={money(totals.committed)} hint={`Dépensé ${money(totals.spent)}`} />
        <Stat label="Créances en retard" value={money(overdueTotal)} hint={`${receivables.data?.length ?? 0} appel(s) de fonds · ${awaiting.data?.total ?? 0} paiement(s) à approuver`} tone={overdueTotal > 0 ? "danger" : "neutral"} />
      </div>
      <Card>
        <CardHeader
          title="Trésorerie prévisionnelle"
          subtitle="Encaissements attendus (appels de fonds, prévisions pondérées) − décaissements (factures fournisseurs et sous-traitants à échéance)."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-56">
                <RefSelect source={REFS.projects} value={projectId} onChange={setProjectId} placeholder="Tous les projets" />
              </div>
              <Select value={String(months)} onChange={(e) => setMonths(Number(e.target.value))} options={[3, 6, 12, 24].map((m) => ({ value: String(m), label: `${m} mois` }))} aria-label="Horizon" />
            </div>
          }
        />
        <div className="space-y-4 p-4">
          {cash.loading && !cash.data ? (
            <Skeleton className="h-64" />
          ) : cash.error ? (
            <Alert tone="danger">{cash.error}</Alert>
          ) : (
            <>
              <BarChartCard
                data={series}
                x="month"
                series={[
                  { key: "inflow", label: "Encaissements", color: "#16a34a" },
                  { key: "outflow", label: "Décaissements", color: "#dc2626" },
                ]}
              />
              <LineChartCard data={series} x="month" series={[{ key: "cumulative", label: "Trésorerie cumulée", color: "#385AA6" }]} area height={200} />
            </>
          )}
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Marges par projet" subtitle="Coût prévisionnel = max(budget approuvé, engagé, dépensé)." />
          {margins.loading && !margins.data ? (
            <Skeleton className="m-4 h-40" />
          ) : margins.data?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Projet</th>
                    <th className="px-3 py-2 text-right">Contrat</th>
                    <th className="px-3 py-2 text-right">Avenants</th>
                    <th className="px-3 py-2 text-right">Budget</th>
                    <th className="px-3 py-2 text-right">Engagé</th>
                    <th className="px-3 py-2 text-right">Dépensé</th>
                    <th className="px-3 py-2 text-right">Marge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {margins.data.map((m) => (
                    <tr key={m.project_id}>
                      <td className="px-3 py-2">
                        <CellLink href={`/erp/chantiers/${m.project_id}/budget`}>{m.code}</CellLink> <span className="text-muted">{m.name}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(m.contract_amount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(m.approved_change_orders)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.budget !== null ? money(m.budget) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(m.committed)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(m.spent)}</td>
                      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${toNumber(m.gross_margin) < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {money(m.gross_margin)}
                        {m.gross_margin_pct !== null ? <span className="block text-xs font-normal text-muted">{number(m.gross_margin_pct, 1)} %</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState title="Aucun projet" />
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Créances en retard" subtitle="Appels de fonds échus non réglés." />
          <ul className="divide-y divide-line text-sm">
            {(receivables.data ?? []).map((r) => (
              <li key={r.id} className="flex justify-between gap-2 px-5 py-2.5">
                <span>
                  {r.number}
                  <span className="block text-xs text-muted">
                    {projectName(r.project_id)?.code ?? ""} · échéance {date(r.due_date)}
                  </span>
                </span>
                <span className="text-right">
                  <span className="font-semibold tabular-nums">{money(r.amount_due)}</span>
                  <Badge tone="danger" className="ml-2">
                    {r.days_late ?? 0} j
                  </Badge>
                </span>
              </li>
            ))}
            {!receivables.data?.length ? <li className="px-5 py-4 text-muted">Aucune créance en retard.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------- paiements */

const TARGETS: Record<string, { label: string; source: RefSource }> = {
  supplier_invoice: {
    label: "Facture fournisseur",
    source: { path: "/supplier-invoices", query: { status: "approved_for_payment,partially_paid" }, label: (r) => `${r.number} — ${r.supplier_reference}`, sublabel: (r) => `Reste ${money(toNumber(r.total) - toNumber(r.amount_paid) - toNumber(r.amount_credited))}`, paginated: true, searchable: true },
  },
  subcontractor_invoice: {
    label: "Facture sous-traitant",
    source: { path: "/subcontractor-invoices", query: { status: "approved_for_payment,partially_paid" }, label: (r) => `${r.number} — ${r.reference ?? ""}`, sublabel: (r) => `Reste ${money(toNumber(r.amount) - toNumber(r.amount_paid) - toNumber(r.amount_credited))}`, paginated: true, searchable: true },
  },
};

/** Ordre de paiement sortant (idempotent) : il part en approbation (séparation des tâches). */
export function OutgoingPaymentForm({ initial, onDone, onCancel }: { initial?: { target_type?: string; target_id?: string; amount?: number; label?: string }; onDone: (p: Row) => void; onCancel: () => void }) {
  const [targetType, setTargetType] = useState(initial?.target_type ?? "supplier_invoice");
  const [targetId, setTargetId] = useState<string | null>(initial?.target_id ?? null);
  const [outstanding, setOutstanding] = useState<number | null>(initial?.amount ?? null);
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [method, setMethod] = useState("bank_transfer");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newKey);
  return (
    <div className="space-y-4">
      {initial?.target_id ? (
        <Alert tone="info">
          {TARGETS[targetType]?.label} {initial.label ?? ""} — reste à payer {money(initial.amount)}
        </Alert>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pièce à régler" required>
            <Select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                setTargetId(null);
                setOutstanding(null);
              }}
              options={Object.entries(TARGETS).map(([value, t]) => ({ value, label: t.label }))}
            />
          </Field>
          <Field label={TARGETS[targetType].label} required help="Seules les factures validées (bon à payer) sont proposées.">
            <RefSelect
              key={targetType}
              source={TARGETS[targetType].source}
              value={targetId}
              onChange={(id, row) => {
                setTargetId(id);
                const due = row ? (targetType === "supplier_invoice" ? toNumber(row.total) : toNumber(row.amount)) - toNumber(row.amount_paid) - toNumber(row.amount_credited) : null;
                setOutstanding(due);
                setAmount(due !== null ? String(due) : "");
              }}
            />
          </Field>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Montant" help={outstanding !== null ? `Reste à payer : ${money(outstanding)} — laisser vide pour solder.` : undefined}>
          <Input type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Mode de règlement" required>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={!targetId || (amount !== "" && toNumber(amount) <= 0)}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const p = await api<Row>("/payments/outgoing", {
                method: "POST",
                idempotent: key,
                body: { target_type: targetType, target_id: targetId, amount: amount === "" ? null : Number(amount), method, notes: notes || null },
              });
              onDone(p);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer l'ordre de paiement
        </Button>
      </div>
    </div>
  );
}

export function PaymentsList({ projectId }: { projectId?: string }) {
  const { can } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <ResourceView
        embedded
        config={{
          title: "Paiements",
          subtitle:
            "Encaissements clients (en ligne, ou hors ligne saisis depuis la facture / l'appel de fonds avec preuve) et décaissements, approuvés à double regard.",
          path: "/payments",
          query: { project_id: projectId },
          href: (r) => `/erp/finances/paiements/${r.id}`,
          exportDataset: "payments",
          columns: [
            { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/finances/paiements/${r.id}`}>{r.number}</CellLink> },
            { key: "direction", label: "Sens", render: (r) => (r.direction === "in" ? <Badge tone="success">Encaissement</Badge> : <Badge tone="warning">Décaissement</Badge>) },
            { key: "counterparty_label", label: "Tiers" },
            { key: "method", label: "Mode", format: "option", hideOnMobile: true },
            { key: "provider", label: "Canal", format: "option", hideOnMobile: true },
            { key: "amount", label: "Montant", format: "money", align: "right", sortable: true },
            { key: "created_at", label: "Créé le", format: "date", sortable: true },
            { key: "status", label: "Statut", format: "status" },
          ],
          filters: [
            {
              key: "direction",
              label: "Sens",
              options: [
                { value: "in", label: "Encaissements" },
                { value: "out", label: "Décaissements" },
              ],
            },
            { key: "status", label: "Statut", options: PAYMENT_STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) },
          ],
          toolbar: can("finance:pay") ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Ordre de paiement
            </Button>
          ) : undefined,
        }}
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvel ordre de paiement" size="lg">
        <OutgoingPaymentForm onCancel={() => setCreating(false)} onDone={(p) => router.push(`/erp/finances/paiements/${p.id}`)} />
      </Modal>
    </>
  );
}

export function PaymentDetail({ id }: { id: string }) {
  const { can, user, hasRole } = useAuth();
  const toast = useToast();
  const payment = useApi<Row>(`/payments/${id}`);
  const [executing, setExecuting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [blocked, setBlocked] = useState<{ id: string; kind: string; description: string }[] | null>(null);
  const [override, setOverride] = useState("");
  const [proof, setProof] = useState<File[]>([]);
  const [reference, setReference] = useState("");
  const [channel, setChannel] = useState("manual");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const payouts = useApi<{ provider: string; label: string }[]>(can("finance:pay") ? "/payments/payout-providers" : null);
  if (payment.loading && !payment.data) return <Skeleton className="h-96 w-full" />;
  if (!payment.data) return <Alert tone="danger">{payment.error}</Alert>;
  const p = payment.data;
  const cur = p.currency === "XAF" ? "FCFA" : p.currency;
  const selfInitiated = !!user && p.initiated_by_id === user.id;
  // Encaissement hors ligne (virement, espèces, chèque, Mobile Money direct) saisi avec preuve : double regard strict.
  const offline = p.direction === "in" && p.provider === "manual";
  const awaitingOffline = offline && p.status === "awaiting_approval";
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/finances?onglet=paiements" className="hover:underline">Paiements</Link>}
        title={`Paiement ${p.number}`}
        subtitle={`${p.direction === "in" ? "Encaissement" : "Décaissement"} · ${p.counterparty_label ?? optionLabel(p.counterparty_type)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            {p.receipt_file_id ? (
              <a href={apiUrl(`/payments/${id}/receipt`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                <Download className="h-3.5 w-3.5" /> Reçu
              </a>
            ) : null}
            {p.proof_file_id ? (
              <a href={apiUrl(`/payments/${id}/proof`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                <Download className="h-3.5 w-3.5" /> {offline ? "Preuve de l'encaissement" : "Preuve d'exécution"}
              </a>
            ) : null}
            {p.status === "awaiting_approval" && can("finance:approve") ? (
              <Button size="sm" onClick={() => setApproving(true)} disabled={selfInitiated && (offline || !hasRole("ADMIN"))}>
                <ShieldCheck className="h-4 w-4" /> Approuver
              </Button>
            ) : null}
            {awaitingOffline && (can("finance:approve") || selfInitiated) ? (
              <Button size="sm" variant="danger" onClick={() => setRejecting(true)}>
                <XCircle className="h-4 w-4" /> {selfInitiated ? "Retirer la saisie" : "Refuser"}
              </Button>
            ) : null}
            {p.status === "pending" && p.direction === "out" && can("finance:pay") ? (
              <Button size="sm" variant="accent" onClick={() => setExecuting(true)}>
                <Wallet className="h-4 w-4" /> Exécuter
              </Button>
            ) : null}
            {p.status === "processing" ? (
              <Button
                size="sm"
                variant="secondary"
                loading={refreshing}
                onClick={async () => {
                  setRefreshing(true);
                  try {
                    payment.setData({ ...p, ...(await api<Row>(`/payments/${id}/refresh`, { method: "POST" })) });
                    void payment.reload();
                  } catch (err) {
                    toast.error("Relecture impossible", errorMessage(err));
                  } finally {
                    setRefreshing(false);
                  }
                }}
              >
                Actualiser le statut
              </Button>
            ) : null}
          </div>
        }
      />
      {awaitingOffline ? (
        <Alert tone="warning" title="Encaissement à vérifier">
          Contrôlez la preuve (montant, référence, date de valeur) avec le relevé ou la caisse, puis approuvez : la pièce est alors réglée, le reçu émis et le client notifié. La personne qui a
          saisi l&apos;encaissement ne peut pas l&apos;approuver (double regard).
        </Alert>
      ) : p.status === "awaiting_approval" ? (
        <Alert tone="warning" title="Approbation requise">
          {p.approval_role ? `Seuil atteint : approbation réservée au rôle ${optionLabel(p.approval_role)}. ` : ""}
          L'initiateur du paiement ne peut pas l'approuver (séparation des tâches).
        </Alert>
      ) : null}
      {p.failure_reason ? (
        <Alert tone="danger" title={offline && p.status === "cancelled" ? "Encaissement refusé" : "Échec"}>
          {p.failure_reason}
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Montant" value={money(p.amount, cur)} tone="info" />
        <Stat label="Mode" value={optionLabel(p.method)} hint={`Canal ${optionLabel(p.provider)}${p.provider_reference ? ` · réf. ${p.provider_reference}` : ""}`} />
        {offline ? (
          <Stat label="Date de valeur" value={p.value_date ? date(p.value_date) : "—"} hint={p.paid_at ? `Confirmé le ${dateTime(p.paid_at)}` : "Non confirmé"} />
        ) : (
          <Stat label="Payé le" value={p.paid_at ? dateTime(p.paid_at) : "—"} hint={p.confirmed_by ? `Confirmé par ${optionLabel(p.confirmed_by)}` : undefined} />
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pièces réglées" />
          <ul className="divide-y divide-line text-sm">
            {((p.allocations ?? []) as Row[]).map((a) => (
              <li key={a.id} className="flex justify-between gap-2 px-5 py-2.5">
                <span>
                  <span className="text-xs text-muted">{optionLabel(a.target_type)}</span>
                  <span className="block">{a.link ? <CellLink href={a.link}>{a.label ?? a.target_id}</CellLink> : (a.label ?? a.target_id)}</span>
                </span>
                <span className="font-semibold tabular-nums">{money(a.amount, cur)}</span>
              </li>
            ))}
            {!(p.allocations ?? []).length ? <li className="px-5 py-3 text-muted">Aucune imputation.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Historique" />
          <div className="p-5">
            <DescriptionList
              columns={1}
              items={[
                { label: "Créé le", value: `${dateTime(p.created_at)}${p.initiated_by_label ? ` par ${p.initiated_by_label}` : ""}` },
                { label: "Approuvé le", value: p.approved_at ? `${dateTime(p.approved_at)}${p.approved_by_label ? ` par ${p.approved_by_label}` : ""}` : "—" },
                { label: "Notes", value: p.notes ?? "—" },
              ]}
            />
            {((p.transactions ?? []) as Row[]).length ? (
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold uppercase text-muted">Transactions prestataire</p>
                <ul className="space-y-1 text-sm">
                  {(p.transactions as Row[]).map((t) => (
                    <li key={t.id} className="flex justify-between gap-2">
                      <span>
                        {optionLabel(t.provider)} · {dateTime(t.created_at)} {t.provider_transaction_id ? `· ${t.provider_transaction_id}` : ""}
                      </span>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {((p.bank_matches ?? []) as Row[]).length ? (
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold uppercase text-muted">Rapprochement bancaire</p>
                {(p.bank_matches as Row[]).map((b) => (
                  <p key={b.id} className="text-sm">
                    {date(b.value_date)} · {b.label} · {money(b.amount, cur)}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={approving}
        onClose={() => setApproving(false)}
        title={offline ? "Approuver l'encaissement" : "Approuver le paiement"}
        text={
          offline
            ? `Vous confirmez avoir vérifié la réception de ${money(p.amount, cur)} de ${p.counterparty_label ?? "—"} (${optionLabel(p.method)}${p.provider_reference ? `, réf. ${p.provider_reference}` : ""}). La pièce sera réglée, le reçu émis et le client notifié.`
            : `Vous approuvez le décaissement de ${money(p.amount, cur)} au profit de ${p.counterparty_label ?? "—"}.`
        }
        onConfirm={async () => {
          try {
            payment.setData(await api(`/payments/${id}/approve`, { method: "POST" }));
          } catch (err) {
            // contrôle interne (A5) : anomalie grave ouverte → dérogation Direction motivée
            if (err instanceof ApiError && err.code === "CONTROL_BLOCK") {
              setBlocked(((err.details as { anomalies?: { id: string; kind: string; description: string }[] }) ?? {}).anomalies ?? []);
              return;
            }
            throw err;
          }
          void payment.reload();
          toast.success(offline ? "Encaissement approuvé" : "Paiement approuvé", offline ? "Reçu émis et client notifié." : undefined);
        }}
      />
      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={selfInitiated ? "Retirer la saisie" : "Refuser l'encaissement"}
        description="La pièce reste due ; le motif est conservé dans le journal d'audit."
        footer={
          <Button
            variant="danger"
            disabled={rejectReason.trim().length < 5}
            onClick={async () => {
              try {
                payment.setData(await api(`/payments/${id}/reject`, { method: "POST", body: { reason: rejectReason.trim() } }));
                setRejecting(false);
                setRejectReason("");
                void payment.reload();
                toast.success(selfInitiated ? "Saisie retirée" : "Encaissement refusé");
              } catch (err) {
                toast.error("Refus impossible", errorMessage(err));
              }
            }}
          >
            {selfInitiated ? "Retirer" : "Refuser"}
          </Button>
        }
      >
        <Field label="Motif" required help="5 caractères minimum — ex. « Virement absent du relevé BICEC du 14/10 »">
          <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </Field>
      </Modal>
      <Modal
        open={blocked !== null}
        onClose={() => setBlocked(null)}
        title="Paiement bloqué par le contrôle interne"
        description="Une anomalie grave concerne ce paiement : vérifiez-la avant tout décaissement."
        footer={
          hasRole("DIRECTION", "ADMIN") ? (
            <Button
              variant="danger"
              disabled={override.trim().length < 15}
              onClick={async () => {
                try {
                  payment.setData(await api(`/payments/${id}/approve`, { method: "POST", body: { override_reason: override.trim() } }));
                  setBlocked(null);
                  setOverride("");
                  void payment.reload();
                  toast.success("Paiement approuvé par dérogation", "Dérogation tracée dans le journal de sécurité.");
                } catch (err) {
                  toast.error("Approbation impossible", errorMessage(err));
                }
              }}
            >
              Approuver par dérogation
            </Button>
          ) : null
        }
      >
        <ul className="space-y-2">
          {(blocked ?? []).map((a) => (
            <li key={a.id} className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
              <span className="font-semibold">{optionLabel(a.kind)}</span> — {a.description}
            </li>
          ))}
        </ul>
        {hasRole("DIRECTION", "ADMIN") ? (
          <Field label="Justification de la dérogation" required help="15 caractères minimum — ex. « Numéro confirmé par contre-appel au gérant »" className="mt-4">
            <Textarea rows={3} value={override} onChange={(e) => setOverride(e.target.value)} />
          </Field>
        ) : (
          <p className="mt-4 text-sm text-muted">Seule la Direction peut déroger, avec une justification tracée. Contactez-la ou traitez l&apos;anomalie.</p>
        )}
      </Modal>
      <Modal
        open={executing}
        onClose={() => setExecuting(false)}
        title="Exécuter le paiement"
        footer={
          <Button
            loading={busy}
            disabled={channel === "manual" && !proof.length}
            onClick={async () => {
              setBusy(true);
              const viaProvider = channel !== "manual";
              try {
                const fd = new FormData();
                if (reference) fd.append("bank_reference", reference);
                if (viaProvider) fd.append("provider", channel);
                if (!viaProvider && proof[0]) fd.append("proof", proof[0]);
                await api(`/payments/${id}/execute`, { method: "POST", form: fd });
                setExecuting(false);
                setProof([]);
                toast.success(
                  viaProvider ? "Transfert transmis au prestataire" : "Paiement exécuté",
                  viaProvider ? "Le statut est confirmé par l'opérateur (rappel signé ou relecture automatique)." : "Le reçu est disponible.",
                );
                void payment.reload();
              } catch (err) {
                toast.error("Exécution impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmer l'exécution
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Canal d'exécution">
            <Select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              options={[
                { value: "manual", label: "Virement / Mobile Money effectué hors plateforme (preuve jointe)" },
                ...(payouts.data ?? []).map((o) => ({ value: o.provider, label: `Transfert automatique — ${o.label}` })),
              ]}
            />
          </Field>
          {channel === "manual" ? (
            <>
              <Field label="Référence bancaire / Mobile Money">
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="VIR-…" />
              </Field>
              <Field label="Preuve d'exécution" required help="Ordre de virement signé, reçu Mobile Money…">
                <FileDrop files={proof} onChange={setProof} accept=".pdf,image/*" maxSizeMb={20} />
              </Field>
            </>
          ) : (
            <Alert tone="info">
              {channel === "mtn_momo"
                ? "Le numéro MTN Mobile Money enregistré sur la fiche du bénéficiaire est crédité ; le paiement passe « en cours » jusqu'à confirmation par MTN."
                : "Les coordonnées de paiement enregistrées du bénéficiaire sont utilisées ; le paiement passe « en cours » jusqu'à confirmation."}
            </Alert>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- engagements, prévisions */

export function CommitmentsList() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Engagements",
        subtitle: "Bons de commande et marchés engagés, consommés au fil des factures validées.",
        path: "/commitments",
        columns: [
          { key: "label", label: "Engagement" },
          { key: "source_type", label: "Origine", format: "option" },
          { key: "category", label: "Catégorie", format: "option", hideOnMobile: true },
          { key: "amount", label: "Montant", format: "money", align: "right" },
          { key: "consumed", label: "Consommé", render: (r) => <Progress value={toNumber(r.amount) ? (toNumber(r.consumed) * 100) / toNumber(r.amount) : 0} className="w-28" label={money(r.consumed)} /> },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: ["open", "partially_consumed", "closed", "cancelled"].map((v) => ({ value: v, label: optionLabel(v) })) }],
      }}
    />
  );
}

export function CashForecastList() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Prévisions de trésorerie",
        subtitle: "Encaissements et décaissements attendus hors factures (pondérés par leur probabilité).",
        path: "/cash-forecast-entries",
        columns: [
          { key: "expected_date", label: "Date prévue", format: "date", sortable: true },
          { key: "label", label: "Libellé" },
          { key: "direction", label: "Sens", render: (r) => (r.direction === "in" ? <Badge tone="success">Entrée</Badge> : <Badge tone="warning">Sortie</Badge>) },
          { key: "amount", label: "Montant", format: "money", align: "right" },
          { key: "probability", label: "Probabilité", render: (r) => `${r.probability ?? 100} %` },
        ],
        filters: [
          {
            key: "direction",
            label: "Sens",
            options: [
              { value: "in", label: "Entrées" },
              { value: "out", label: "Sorties" },
            ],
          },
        ],
        create: {
          endpoint: "POST /cash-forecast-entries",
          label: "Nouvelle prévision",
          perms: ["finance:write"],
          fields: {
            direction: {
              options: [
                { value: "in", label: "Entrée" },
                { value: "out", label: "Sortie" },
              ],
            },
            details: { hidden: true },
          },
        },
        update: { endpoint: "PATCH /cash-forecast-entries/{item_id}", perms: ["finance:write"], fields: { details: { hidden: true } } },
        remove: { path: (r) => `/cash-forecast-entries/${r.id}`, perms: ["finance:write"] },
      }}
    />
  );
}

/* ----------------------------------------------------------------------------- banque */

function BankTransactions({ account }: { account: Row }) {
  const toast = useToast();
  const [status, setStatus] = useState("unmatched");
  const rows = useApi<{ items: Row[]; total: number }>(`/bank-accounts/${account.id}/transactions`, { status: status || undefined, page_size: 100 });
  const [matching, setMatching] = useState<Row | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [file, setFile] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-line p-4">
        <p className="mb-2 text-sm font-medium">Importer un relevé (CSV : date ; libellé ; référence ; montant)</p>
        <FileDrop files={file} onChange={setFile} accept=".csv,text/csv" maxSizeMb={10} label="Relevé bancaire CSV" />
        <Button
          size="sm"
          className="mt-2"
          disabled={!file.length}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const fd = new FormData();
              fd.append("file", file[0]);
              const res = await api<Record<string, number>>(`/bank-accounts/${account.id}/import`, { method: "POST", form: fd });
              toast.success("Relevé importé", `${res.created ?? 0} ligne(s) importée(s) · ${res.matched ?? 0} rapprochée(s) automatiquement · ${res.duplicates ?? 0} doublon(s) ignoré(s)`);
              setFile([]);
              void rows.reload();
            } catch (err) {
              toast.error("Import impossible", errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <FileUp className="h-4 w-4" /> Importer et rapprocher
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Opérations ({rows.data?.total ?? 0})</p>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "unmatched", label: "Non rapprochées" },
            { value: "matched", label: "Rapprochées" },
            { value: "", label: "Toutes" },
          ]}
          aria-label="Filtre"
        />
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line text-sm">
        {(rows.data?.items ?? []).map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span>
              {date(t.value_date)} · {t.label}
              {t.reference ? <span className="block text-xs text-muted">Réf. {t.reference}</span> : null}
            </span>
            <span className="flex items-center gap-2">
              <span className={`font-semibold tabular-nums ${toNumber(t.amount) < 0 ? "text-red-600" : "text-emerald-700"}`}>{money(t.amount)}</span>
              {t.status === "unmatched" ? (
                <Button size="sm" variant="secondary" onClick={() => setMatching(t)}>
                  Rapprocher
                </Button>
              ) : (
                <StatusBadge status={t.status} />
              )}
            </span>
          </li>
        ))}
        {!rows.data?.items?.length ? <li className="px-3 py-4 text-muted">Aucune opération.</li> : null}
      </ul>
      <Modal
        open={!!matching}
        onClose={() => setMatching(null)}
        title="Rapprochement manuel"
        footer={
          <Button
            disabled={!paymentId}
            onClick={async () => {
              try {
                await api(`/bank-transactions/${matching?.id}/match`, { method: "POST", body: { payment_id: paymentId } });
                setMatching(null);
                setPaymentId(null);
                void rows.reload();
                toast.success("Opération rapprochée");
              } catch (err) {
                toast.error("Rapprochement impossible", errorMessage(err));
              }
            }}
          >
            Rapprocher
          </Button>
        }
      >
        <p className="mb-3 text-sm">
          {date(matching?.value_date)} · {matching?.label} · <strong>{money(matching?.amount)}</strong>
        </p>
        <RefSelect
          source={{ path: "/payments", query: { direction: toNumber(matching?.amount) < 0 ? "out" : "in" }, label: (r) => `${r.number} — ${r.counterparty_label ?? ""}`, sublabel: (r) => `${money(r.amount)} · ${optionLabel(r.status)}`, paginated: true, searchable: true }}
          value={paymentId}
          onChange={setPaymentId}
        />
      </Modal>
    </div>
  );
}

export function BankAccountsView() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Comptes bancaires et Mobile Money",
        subtitle: "Import des relevés, rapprochement automatique (référence + montant) puis manuel.",
        path: "/bank-accounts",
        columns: [
          { key: "name", label: "Compte" },
          { key: "bank_name", label: "Établissement" },
          { key: "kind", label: "Type", format: "option" },
          { key: "currency", label: "Devise" },
          { key: "is_active", label: "Actif", format: "bool" },
        ],
        create: {
          endpoint: "POST /bank-accounts",
          label: "Nouveau compte",
          perms: ["finance:reconcile"],
          fields: {
            kind: {
              options: [
                { value: "bank", label: "Banque" },
                { value: "mobile_money", label: "Mobile Money" },
                { value: "provider", label: "Prestataire de paiement" },
              ],
            },
            account_number: { help: "Chiffré au repos ; jamais réaffiché en clair." },
          },
        },
        update: { endpoint: "PATCH /bank-accounts/{item_id}", perms: ["finance:reconcile"] },
        detail: (r) => <BankTransactions account={r} />,
      }}
    />
  );
}

/* ----------------------------------------------------------------------------- petites caisses */

function PettyCashFund({ fund, reload }: { fund: Row; reload: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const txs = useApi<{ items: Row[]; total: number }>(`/petty-cash-funds/${fund.id}/transactions`, { page_size: 100 });
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Solde" value={money(fund.balance)} tone={toNumber(fund.balance) < 0 ? "danger" : "info"} />
        <Stat label="Plafond" value={money(fund.ceiling)} />
      </div>
      <Button size="sm" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4" /> Déclarer un mouvement
      </Button>
      <ul className="divide-y divide-line rounded-xl border border-line text-sm">
        {(txs.data?.items ?? []).map((t) => (
          <li key={t.id} className="px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {date(t.transaction_date)} · {t.purpose}
                <span className="block text-xs text-muted">{optionLabel(t.category)}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`font-semibold tabular-nums ${t.kind === "out" ? "text-red-600" : "text-emerald-700"}`}>
                  {t.kind === "out" ? "−" : "+"}
                  {money(t.amount)}
                </span>
                <StatusBadge status={t.status} />
              </span>
            </div>
            {t.status === "pending" && can("finance:approve") ? (
              <div className="mt-1 flex gap-2">
                {[true, false].map((approve) => (
                  <Button
                    key={String(approve)}
                    size="sm"
                    variant={approve ? "primary" : "ghost"}
                    onClick={async () => {
                      try {
                        await api(`/petty-cash-transactions/${t.id}/validate`, { method: "POST", body: { approve } });
                        void txs.reload();
                        reload();
                      } catch (err) {
                        toast.error("Action impossible", errorMessage(err));
                      }
                    }}
                  >
                    {approve ? "Valider" : "Refuser"}
                  </Button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
        {!txs.data?.items?.length ? <li className="px-3 py-4 text-muted">Aucun mouvement.</li> : null}
      </ul>
      <Modal open={adding} onClose={() => setAdding(false)} title="Mouvement de caisse">
        <SchemaForm
          endpoint="POST /petty-cash-funds/{fund_id}/transactions"
          params={{ fund_id: fund.id }}
          initial={{ kind: "out", transaction_date: new Date().toISOString().slice(0, 10) }}
          fields={{
            kind: {
              options: [
                { value: "out", label: "Sortie (dépense)" },
                { value: "in", label: "Entrée (réapprovisionnement)" },
              ],
            },
            category: { options: ["materiaux", "main_oeuvre", "transport", "restauration", "carburant", "petit_outillage", "autre"].map((v) => ({ value: v, label: optionLabel(v) })) },
            lot_id: { ref: { ...REFS.lots, query: fund.project_id ? { project_id: fund.project_id } : undefined, dependsOn: undefined } },
            receipt: { help: "Justificatif (photo du ticket, facture) : obligatoire pour une sortie.", requiredIf: (v) => v.kind === "out" },
          }}
          onCancel={() => setAdding(false)}
          onSuccess={() => {
            setAdding(false);
            void txs.reload();
            reload();
            toast.success("Mouvement déclaré", "En attente de validation.");
          }}
          columns={1}
        />
      </Modal>
    </div>
  );
}

/** Caisses dont l'utilisateur est le gestionnaire : déclaration des mouvements sans droit finance, validation par la finance. */
export function MyPettyCash() {
  const funds = useApi<Row[]>("/petty-cash/me");
  return (
    <div className="space-y-5">
      <PageTitle title="Ma petite caisse" subtitle="Déclarez vos dépenses et réapprovisionnements avec le reçu : la finance les valide, le solde et le budget du projet suivent." />
      {funds.loading && !funds.data ? <Skeleton className="h-40 w-full" /> : null}
      {funds.error ? <Alert tone="danger">{funds.error}</Alert> : null}
      {funds.data && !funds.data.length ? <EmptyState title="Aucune caisse à votre nom" text="La finance vous désigne comme gestionnaire à la création d'une petite caisse." /> : null}
      {(funds.data ?? []).map((fund) => (
        <Card key={fund.id} className="space-y-3 p-5">
          <p className="font-semibold text-brand-800">
            {fund.name} {toNumber(fund.pending_count) > 0 ? <Badge tone="warning">{fund.pending_count} en attente de validation</Badge> : null}
          </p>
          <PettyCashFund fund={fund} reload={() => void funds.reload()} />
        </Card>
      ))}
    </div>
  );
}

export function PettyCashView() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Petites caisses de chantier",
        subtitle: "Déclaration des dépenses avec justificatif, validation, solde et plafond.",
        path: "/petty-cash-funds",
        columns: [
          { key: "name", label: "Caisse" },
          { key: "balance", label: "Solde", format: "money", align: "right" },
          { key: "ceiling", label: "Plafond", format: "money", align: "right" },
          { key: "is_active", label: "Active", format: "bool" },
        ],
        create: { endpoint: "POST /petty-cash-funds", label: "Nouvelle caisse", perms: ["finance:write"], fields: { custodian_id: { ref: "users", label: "Gestionnaire" } } },
        update: { endpoint: "PATCH /petty-cash-funds/{item_id}", perms: ["finance:write"], fields: { custodian_id: { ref: "users", label: "Gestionnaire" } } },
        detail: (r, reload) => <PettyCashFund fund={r} reload={reload} />,
      }}
    />
  );
}

export function FinanceHub({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  return (
    <div className="space-y-5">
      <PageTitle title="Finances" subtitle="Budgets, engagements, trésorerie, paiements à double regard, rapprochement bancaire, petites caisses." />
      <Tabs
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "pilotage", label: "Pilotage" },
          { key: "paiements", label: "Paiements" },
          { key: "engagements", label: "Engagements" },
          { key: "previsions", label: "Prévisions" },
          { key: "banque", label: "Banque" },
          { key: "caisses", label: "Petites caisses" },
        ]}
      />
      {tab === "pilotage" ? <FinanceDashboard /> : null}
      {tab === "paiements" ? <PaymentsList /> : null}
      {tab === "engagements" ? <CommitmentsList /> : null}
      {tab === "previsions" ? <CashForecastList /> : null}
      {tab === "banque" ? <BankAccountsView /> : null}
      {tab === "caisses" ? <PettyCashView /> : null}
    </div>
  );
}
