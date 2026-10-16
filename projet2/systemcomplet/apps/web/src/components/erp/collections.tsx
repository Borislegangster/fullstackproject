"use client";

import { Plus, Split, Trash2, X } from "lucide-react";
import { useState } from "react";

import { InstallmentTable, planStatus, type PaymentPlanRow } from "@/components/client/payment-plans";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, money, toInputDate } from "@/lib/format";
import { useApi } from "@/lib/hooks";

const FILTERS = [
  { key: "requested", label: "À étudier" },
  { key: "proposed", label: "Proposés" },
  { key: "active", label: "En cours" },
  { key: "defaulted", label: "En défaut" },
  { key: "", label: "Tous" },
];

function ProposeDialog({ plan, onClose, onDone }: { plan: PaymentPlanRow; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState(() => plan.installments.map((i) => ({ due_date: toInputDate(i.due_date), amount: String(Number(i.amount)) })));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cur = plan.currency === "XAF" ? "FCFA" : plan.currency;
  const sum = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const total = Number(plan.total_amount);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/payment-plans/${plan.id}/propose`, { body: { installments: rows.map((r) => ({ due_date: r.due_date, amount: String(Number(r.amount).toFixed(2)) })), note: note || null } });
      toast.success("Échéancier proposé au client", "Il l'accepte par code depuis son espace.");
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Proposer l'échéancier ${plan.number}`}
      description={`${plan.target_number} — ${plan.target_label} · reste dû ${money(plan.total_amount, cur)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={busy} disabled={Math.abs(sum - total) > 0.005 || rows.some((r) => !r.due_date || !(Number(r.amount) > 0))} onClick={() => void submit()}>
            Proposer au client
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {plan.reason ? <Alert tone="info" title="Motif du client">{plan.reason}</Alert> : null}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-3">
            <span className="pb-2 text-sm font-semibold text-muted">{i + 1}.</span>
            <Field label={i === 0 ? "Date" : undefined}>
              <Input type="date" value={r.due_date} onChange={(e) => setRows((cur2) => cur2.map((x, j) => (j === i ? { ...x, due_date: e.target.value } : x)))} />
            </Field>
            <Field label={i === 0 ? "Montant" : undefined}>
              <Input type="number" min={1} value={r.amount} onChange={(e) => setRows((cur2) => cur2.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
            </Field>
            <Button variant="ghost" size="sm" aria-label="Retirer" disabled={rows.length <= 1} onClick={() => setRows((cur2) => cur2.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setRows((cur2) => [...cur2, { due_date: "", amount: "" }])}>
          <Plus className="h-4 w-4" /> Ajouter une échéance
        </Button>
        <p className={`text-sm font-semibold ${Math.abs(sum - total) > 0.005 ? "text-red-600" : "text-emerald-700"}`}>
          Total des échéances : {money(sum, cur)} / {money(total, cur)}
        </p>
        <Field label="Note au client (facultatif)">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </Modal>
  );
}

/** Échéanciers clients (A6) : étude des demandes, proposition, suivi des échéances et des défauts. */
export function PaymentPlansPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState("requested");
  const plans = useApi<PaymentPlanRow[]>("/payment-plans", filter ? { status: filter } : undefined, [filter]);
  const [proposing, setProposing] = useState<PaymentPlanRow | null>(null);
  const [rejecting, setRejecting] = useState<PaymentPlanRow | null>(null);
  const [note, setNote] = useState("");
  return (
    <div className="space-y-5">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <Split className="h-7 w-7 text-brand-600" /> Échéanciers clients
          </span>
        }
        subtitle="Demandes d'échelonnement : validation finance, acceptation du client par code, rappels et liens de paiement automatiques par échéance."
      />
      <Tabs value={filter} onChange={setFilter} tabs={FILTERS} />
      {plans.loading && !plans.data ? (
        <Skeleton className="h-64 w-full" />
      ) : plans.data?.length ? (
        <div className="space-y-4">
          {plans.data.map((p) => {
            const cur = p.currency === "XAF" ? "FCFA" : p.currency;
            const s = planStatus(p.status);
            return (
              <Card key={p.id} className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">
                      {p.number} <Badge tone={s.tone}>{s.label}</Badge>
                    </p>
                    <p className="text-sm text-muted">
                      {p.target_number} — {p.target_label} · {money(p.total_amount, cur)} · demandé le {date(p.created_at)}
                      {p.accepted_at ? ` · accepté le ${date(p.accepted_at)}` : ""}
                    </p>
                    {p.reason ? <p className="mt-1 text-sm italic text-ink">« {p.reason} »</p> : null}
                  </div>
                  {can("billing:write") && ["requested", "proposed"].includes(p.status) ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setProposing(p)}>
                        {p.status === "requested" ? "Étudier et proposer" : "Modifier la proposition"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejecting(p)}>
                        <X className="h-4 w-4" /> Refuser
                      </Button>
                    </div>
                  ) : null}
                </div>
                <InstallmentTable items={p.installments} currency={cur} />
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Aucun échéancier" text="Les demandes déposées par les clients depuis leur espace apparaissent ici." />
      )}
      {proposing ? <ProposeDialog key={proposing.id} plan={proposing} onClose={() => setProposing(null)} onDone={() => void plans.reload()} /> : null}
      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Refuser la demande"
        footer={
          <Button
            variant="danger"
            disabled={note.trim().length < 5}
            onClick={async () => {
              try {
                await api(`/payment-plans/${rejecting?.id}/reject`, { body: { note } });
                toast.success("Demande refusée", "Le client est informé avec votre motif.");
                setRejecting(null);
                setNote("");
                void plans.reload();
              } catch (err) {
                toast.error("Refus impossible", errorMessage(err));
              }
            }}
          >
            Refuser
          </Button>
        }
      >
        <Field label="Motif communiqué au client" required>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
