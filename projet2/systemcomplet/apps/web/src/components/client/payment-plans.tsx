"use client";

import { CalendarClock, CheckCircle2, Clock3, Split } from "lucide-react";
import { useState } from "react";

import { Field, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { OtpDialog } from "@/components/ui/otp-dialog";
import { Alert, Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { date, money } from "@/lib/format";

export interface Installment {
  index: number;
  due_date: string;
  amount: string;
  status: "pending" | "paid" | "late";
  remaining?: string;
}

export interface PaymentPlanRow {
  id: string;
  number: string;
  target_type: "client_invoice" | "funds_call";
  target_id: string;
  target_number: string;
  target_label: string;
  project_id?: string | null;
  total_amount: string;
  currency: string;
  installments: Installment[];
  status: "requested" | "proposed" | "active" | "completed" | "defaulted" | "rejected" | "cancelled";
  reason?: string | null;
  decision_note?: string | null;
  created_at: string;
  accepted_at?: string | null;
}

const STATUS: Record<PaymentPlanRow["status"], { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" | "accent" }> = {
  requested: { label: "Demande à l'étude", tone: "info" },
  proposed: { label: "À accepter", tone: "accent" },
  active: { label: "En cours", tone: "success" },
  completed: { label: "Soldé", tone: "success" },
  defaulted: { label: "Échéance manquée", tone: "danger" },
  rejected: { label: "Non retenu", tone: "neutral" },
  cancelled: { label: "Annulé", tone: "neutral" },
};

export function planStatus(status: PaymentPlanRow["status"]) {
  return STATUS[status] ?? { label: status, tone: "neutral" as const };
}

export function InstallmentTable({ items, currency }: { items: Installment[]; currency: string }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <li
          key={i.index}
          className={`rounded-xl border p-3 text-sm ${i.status === "paid" ? "border-emerald-200 bg-emerald-50/60" : i.status === "late" ? "border-red-200 bg-red-50/60" : "border-line bg-white"}`}
        >
          <p className="flex items-center justify-between text-xs text-muted">
            Échéance {i.index}
            {i.status === "paid" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : i.status === "late" ? <Clock3 className="h-4 w-4 text-red-600" /> : <CalendarClock className="h-4 w-4 text-brand-500" />}
          </p>
          <p className="mt-1 font-title text-lg font-bold tabular-nums text-ink">{money(i.amount, currency)}</p>
          <p className="text-xs text-muted">
            le {date(i.due_date)}
            {i.remaining && i.status !== "paid" && Number(i.remaining) < Number(i.amount) ? ` · reste ${money(i.remaining, currency)}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Demande d'échelonnement d'un appel de fonds ou d'une facture (validation par notre service comptable). */
export function PlanRequestDialog({
  target,
  onClose,
  onDone,
}: {
  target: { type: "funds_call" | "client_invoice"; id: string; label: string; remaining: number; currency: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [count, setCount] = useState("3");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!target) return null;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/client/payment-plans", { body: { target_type: target.type, target_id: target.id, count: Number(count), reason: reason || null } });
      toast.success("Demande envoyée", "Notre service comptable vous répond rapidement ; vous accepterez ensuite l'échéancier par code.");
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
      title="Demander un échéancier"
      description={`${target.label} — reste à régler ${money(target.remaining, target.currency)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            <Split className="h-4 w-4" /> Envoyer la demande
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre d'échéances" help="Une première échéance d'au moins 25 %, puis des échéances mensuelles.">
          <Select value={count} onChange={(e) => setCount(e.target.value)} options={["2", "3", "4"].map((v) => ({ value: v, label: `${v} échéances` }))} />
        </Field>
        <Field label="Votre situation (facultatif)">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. décalage de versement de salaire, attente d'un prêt…" />
        </Field>
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </Modal>
  );
}

/** Mes échéanciers : suivi des échéances et acceptation d'une proposition par code à usage unique. */
export function MyPaymentPlans({ plans, onChange }: { plans: PaymentPlanRow[]; onChange: () => void }) {
  const toast = useToast();
  const [accepting, setAccepting] = useState<PaymentPlanRow | null>(null);
  if (!plans.length) return null;
  return (
    <Card>
      <CardHeader title="Mes échéanciers" subtitle="Rappels automatiques avant chaque échéance, avec lien de paiement en un clic." />
      <ul className="divide-y divide-line">
        {plans.map((p) => {
          const cur = p.currency === "XAF" ? "FCFA" : p.currency;
          const s = planStatus(p.status);
          return (
            <li key={p.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-semibold">{p.number}</span> · {p.target_number} — {p.target_label} · {money(p.total_amount, cur)}
                </p>
                <div className="flex items-center gap-2">
                  <Badge tone={s.tone}>{s.label}</Badge>
                  {p.status === "proposed" ? (
                    <Button size="sm" variant="accent" onClick={() => setAccepting(p)}>
                      Accepter par code
                    </Button>
                  ) : null}
                </div>
              </div>
              <InstallmentTable items={p.installments} currency={cur} />
              {p.decision_note ? <p className="text-xs text-muted">Note du service comptable : {p.decision_note}</p> : null}
            </li>
          );
        })}
      </ul>
      <OtpDialog
        open={accepting !== null}
        onClose={() => setAccepting(null)}
        title="Accepter l'échéancier"
        description={
          accepting ? (
            <span>
              En validant, vous vous engagez à régler les {accepting.installments.length} échéances de l&apos;échéancier {accepting.number}. Votre acceptation
              est horodatée (code à usage unique).
            </span>
          ) : null
        }
        channels={[
          { value: "email", label: "Par e-mail" },
          { value: "sms", label: "Par SMS" },
          { value: "whatsapp", label: "Par WhatsApp" },
        ]}
        request={(channel) => api(`/client/payment-plans/${accepting?.id}/otp`, { method: "POST", query: { channel } })}
        confirm={async (challenge, code) => {
          await api(`/client/payment-plans/${accepting?.id}/accept`, { body: { otp_token: challenge.otp_token, code } });
          toast.success("Échéancier accepté", "Les relances de la pièce sont remplacées par les rappels d'échéance.");
          onChange();
        }}
        confirmLabel="J'accepte l'échéancier"
      />
    </Card>
  );
}
