"use client";

import { BadgeCheck, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Field, Textarea } from "@/components/ui/form";
import { OtpDialog } from "@/components/ui/otp-dialog";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, Stat } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { date, dateTime, money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export interface EscrowItemRow {
  id: string;
  number: string;
  funds_call?: { id: string; number: string; label: string; status: string } | null;
  milestone?: { id: string; name: string; status: string; due_date?: string | null } | null;
  amount: string;
  held_amount: string;
  status: string;
  evidence?: {
    milestone?: string;
    pv_title?: string;
    pv_proof_code?: string | null;
    photo_proofs?: { number: string; code: string; photos: number }[];
  } | null;
  requested_at?: string | null;
  client_decision?: { decision?: string; at?: string; by?: string } | null;
  dispute_reason?: string | null;
  released_at?: string | null;
  approvals?: { user_id: string; name: string; role: string; at: string }[];
  release_reference?: string | null;
  resolution_note?: string | null;
}

export interface EscrowOverview {
  account: {
    id: string;
    partner_name: string;
    partner_reference?: string | null;
    status: string;
    review_days: number;
    balance_held: string;
    balance_released: string;
    balance_refunded: string;
    terms?: string | null;
    activated_at?: string | null;
  } | null;
  items: EscrowItemRow[];
}

export const ESCROW_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" | "accent" }> = {
  awaiting_payment: { label: "En attente du versement", tone: "neutral" },
  held: { label: "Fonds sécurisés", tone: "info" },
  release_requested: { label: "Libération demandée", tone: "warning" },
  approved: { label: "Validée par le client", tone: "accent" },
  disputed: { label: "Contestée", tone: "danger" },
  released: { label: "Libérée", tone: "success" },
  refunded: { label: "Restituée", tone: "neutral" },
};

/** Preuves jointes à la demande de libération : PV certifié et journées photo horodatées. */
export function EscrowEvidence({ evidence }: { evidence: EscrowItemRow["evidence"] }) {
  if (!evidence?.pv_title) return null;
  return (
    <div className="mt-2 space-y-1 rounded-xl bg-surface p-3 text-xs">
      <p className="font-semibold text-ink">Preuves de l&apos;atteinte du jalon</p>
      <p>
        PV : {evidence.pv_title}
        {evidence.pv_proof_code ? (
          <a href={`/verification/${evidence.pv_proof_code}`} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
            <ShieldCheck className="h-3.5 w-3.5" /> vérifier
          </a>
        ) : null}
      </p>
      {(evidence.photo_proofs ?? []).map((p) => (
        <p key={p.code}>
          Photos certifiées {p.number} ({p.photos})
          <a href={`/verification/${p.code}`} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
            <ShieldCheck className="h-3.5 w-3.5" /> vérifier
          </a>
        </p>
      ))}
    </div>
  );
}

/** Séquestre par jalon (R1) côté client : fonds détenus par le partenaire, libérés sur preuve et accord du client. */
export function EscrowPanel({ projectId, currency, onChange }: { projectId: string; currency: string; onChange?: () => void }) {
  const toast = useToast();
  const { data, reload } = useApi<EscrowOverview>(`/client/projects/${projectId}/escrow`);
  const [approving, setApproving] = useState<EscrowItemRow | null>(null);
  const [disputing, setDisputing] = useState<EscrowItemRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data?.account) return null;
  const { account } = data;
  const refresh = () => {
    void reload();
    onChange?.();
  };
  const dispute = async () => {
    if (!disputing) return;
    setBusy(true);
    try {
      await api(`/client/escrow/items/${disputing.id}/dispute`, { body: { reason } });
      toast.success("Contestation enregistrée", "La Direction organise une médiation ; les fonds restent bloqués.");
      setDisputing(null);
      setReason("");
      refresh();
    } catch (err) {
      toast.error("Contestation impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-brand-600" /> Séquestre par jalon
          </span>
        }
        subtitle={
          account.status === "active"
            ? `Vos versements sont détenus par ${account.partner_name} et ne sont libérés qu'à l'atteinte prouvée de chaque jalon, avec votre accord.`
            : `Dès son activation, vos versements seront détenus par ${account.partner_name} et libérés jalon par jalon, sur preuve et avec votre accord.`
        }
      />
      <div className="space-y-4 p-5">
        {account.status !== "active" ? (
          <Alert tone="warning" title="Séquestre en cours de mise en place">
            La convention avec {account.partner_name} est en cours de signature : tant qu&apos;elle n&apos;est pas active, vos versements suivent le circuit
            habituel. Nous vous informons dès l&apos;activation.
          </Alert>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Fonds sécurisés" value={money(account.balance_held, currency)} />
          <Stat label="Libérés à l'entreprise" value={money(account.balance_released, currency)} tone="success" />
          <Stat label="Restitués" value={money(account.balance_refunded, currency)} />
        </div>
        <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
          {data.items.map((item) => {
            const s = ESCROW_STATUS[item.status] ?? { label: item.status, tone: "neutral" as const };
            return (
              <li key={item.id} className="p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {item.milestone?.name ?? "Jalon"} <span className="text-xs font-normal text-muted">· {item.number}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {item.funds_call ? `${item.funds_call.number} — ${item.funds_call.label} · ` : ""}
                      {money(item.held_amount, currency)} sécurisés sur {money(item.amount, currency)}
                    </p>
                  </div>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <EscrowEvidence evidence={item.evidence} />
                {item.status === "release_requested" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => setApproving(item)}>
                      <BadgeCheck className="h-4 w-4" /> Valider la libération
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDisputing(item)}>
                      <TriangleAlert className="h-4 w-4" /> Contester
                    </Button>
                    <span className="text-xs text-muted">
                      Demandée le {date(item.requested_at)} · délai de réponse {account.review_days} jours (aucune libération sans votre accord)
                    </span>
                  </div>
                ) : null}
                {item.status === "disputed" && item.dispute_reason ? <p className="mt-2 text-xs text-red-700">Votre contestation : {item.dispute_reason}</p> : null}
                {item.client_decision?.decision === "approved" && !item.released_at ? (
                  <p className="mt-2 text-xs text-muted">
                    Validée par {item.client_decision.by} le {dateTime(item.client_decision.at)} · virement en cours de double validation
                  </p>
                ) : null}
                {item.released_at ? <p className="mt-2 text-xs text-emerald-700">Libérés le {dateTime(item.released_at)}</p> : null}
              </li>
            );
          })}
          {!data.items.length ? <li className="p-4 text-sm text-muted">Aucun appel de fonds placé sous séquestre pour l&apos;instant.</li> : null}
        </ul>
      </div>
      <OtpDialog
        open={approving !== null}
        onClose={() => setApproving(null)}
        title="Valider la libération des fonds"
        description={
          approving
            ? `Vous confirmez l'atteinte du jalon « ${approving.milestone?.name ?? ""} » : ${money(approving.held_amount, currency)} seront libérés après double validation interne.`
            : undefined
        }
        request={(channel) => api(`/client/escrow/items/${approving?.id}/otp`, { method: "POST", query: { channel } })}
        confirm={async (challenge, code) => {
          await api(`/client/escrow/items/${approving?.id}/approve`, { body: { otp_token: challenge.otp_token, code } });
          toast.success("Libération validée");
          refresh();
        }}
        confirmLabel="Je valide"
      />
      <Modal
        open={disputing !== null}
        onClose={() => setDisputing(null)}
        title="Contester la demande de libération"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisputing(null)}>
              Annuler
            </Button>
            <Button variant="danger" loading={busy} disabled={reason.trim().length < 15} onClick={() => void dispute()}>
              Contester
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">Les fonds restent bloqués chez {account.partner_name} jusqu&apos;à la médiation de la Direction.</p>
        <Field label="Motif (15 caractères minimum)" required>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </Card>
  );
}
