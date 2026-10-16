"use client";

import { Banknote, Check, Gift, Plus, Power, PowerOff, Settings2, UserX, X } from "lucide-react";
import { useState } from "react";

import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Badge, Button, Card, EmptyState, PageTitle, Skeleton, Stat } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, newKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, money } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface Ambassador {
  id: string;
  code: string;
  kind: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  share_url: string;
  has_payout: boolean;
  momo_hint?: string | null;
  stats: { referrals: number; signed: number; earned: string; pending: string; paid: string };
  created_at: string;
}

interface Referral {
  id: string;
  number: string;
  referee: string;
  status: string;
  amount: string;
  amount_paid: string;
  contract_amount: string;
  rejection_reason?: string | null;
  created_at: string;
  signed_at?: string | null;
  paid_at?: string | null;
  lead_id?: string | null;
  captured_via: string;
  ambassador?: { id: string; name: string; code: string } | null;
}

const REF_TABS = [
  { key: "signed", label: "Primes à valider" },
  { key: "approved", label: "À payer" },
  { key: "captured", label: "En cours" },
  { key: "paid", label: "Payées" },
  { key: "rejected", label: "Non éligibles" },
  { key: "", label: "Toutes" },
];

interface Program {
  enabled: boolean;
  reward_type: "percent" | "fixed";
  reward_pct: number;
  reward_fixed: number;
  reward_cap: number;
  min_contract_amount: number;
  attribution_days: number;
  signature_window_days: number;
  referee_benefit: string;
}

/** Ouverture du programme (désactivé par défaut) : conditionne le menu « Parrainage » de l'espace client. */
function ProgramCard({ program, onChange }: { program: Program; onChange: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [rules, setRules] = useState<Program | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async (values: Partial<Program>, ok: string) => {
    setSaving(true);
    try {
      await api("/ambassadors/program", { method: "PUT", body: values });
      toast.success(ok);
      setRules(null);
      onChange();
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const reward =
    program.reward_type === "percent"
      ? `${program.reward_pct} % du contrat signé (plafond ${money(program.reward_cap)})`
      : `${money(program.reward_fixed)} par contrat signé`;
  return (
    <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          {program.enabled ? <Power className="h-5 w-5 text-emerald-600" /> : <PowerOff className="h-5 w-5 text-muted" />}
          Programme {program.enabled ? "ouvert" : "fermé"}
          <Badge tone={program.enabled ? "success" : "neutral"}>{program.enabled ? "Visible des clients" : "Masqué des clients"}</Badge>
        </p>
        <p className="text-sm text-muted">
          {program.enabled
            ? "Le menu « Parrainage » apparaît dans l'espace client ; adhésions, liens et attributions sont actifs."
            : "Fermé par défaut : le menu « Parrainage » est masqué dans l'espace client et aucune adhésion ni attribution n'est possible."}
        </p>
        <p className="text-xs text-muted">
          Prime : {reward} · contrat minimum {money(program.min_contract_amount)} · lien suivi {program.attribution_days} j · signature sous{" "}
          {program.signature_window_days} j{program.referee_benefit ? ` · filleul : ${program.referee_benefit}` : ""}
        </p>
      </div>
      {can("settings:write") ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setRules({ ...program })}>
            <Settings2 className="h-4 w-4" /> Règles
          </Button>
          <Button variant={program.enabled ? "danger" : "accent"} onClick={() => setConfirm(true)}>
            {program.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />} {program.enabled ? "Fermer le programme" : "Ouvrir le programme"}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={program.enabled ? "Fermer le programme" : "Ouvrir le programme"}
        text={
          program.enabled
            ? "Le menu « Parrainage » disparaît de l'espace client ; plus aucune adhésion ni attribution de nouvelle recommandation. Les recommandations déjà enregistrées et les primes dues continuent d'être traitées."
            : "Le menu « Parrainage » devient visible pour tous les clients : ils peuvent adhérer, partager leur lien et recommander GLOBUS selon les règles affichées."
        }
        tone={program.enabled ? "danger" : "accent"}
        confirmLabel={program.enabled ? "Fermer" : "Ouvrir"}
        onConfirm={() => save({ enabled: !program.enabled }, program.enabled ? "Programme fermé" : "Programme ouvert aux clients")}
      />
      <Modal
        open={rules !== null}
        onClose={() => setRules(null)}
        title="Règles du programme"
        footer={
          <Button loading={saving} onClick={() => rules && void save({ ...rules, enabled: undefined }, "Règles enregistrées")}>
            Enregistrer
          </Button>
        }
      >
        {rules ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type de prime">
              <Select
                value={rules.reward_type}
                onChange={(e) => setRules({ ...rules, reward_type: e.target.value as Program["reward_type"] })}
                options={[
                  { value: "percent", label: "Pourcentage du contrat" },
                  { value: "fixed", label: "Montant fixe" },
                ]}
              />
            </Field>
            {rules.reward_type === "percent" ? (
              <Field label="Pourcentage (%)">
                <Input type="number" min={0} max={20} step="0.1" value={rules.reward_pct} onChange={(e) => setRules({ ...rules, reward_pct: Number(e.target.value) })} />
              </Field>
            ) : (
              <Field label="Montant fixe (FCFA)">
                <Input type="number" min={0} value={rules.reward_fixed} onChange={(e) => setRules({ ...rules, reward_fixed: Number(e.target.value) })} />
              </Field>
            )}
            <Field label="Plafond de prime (FCFA)">
              <Input type="number" min={0} value={rules.reward_cap} onChange={(e) => setRules({ ...rules, reward_cap: Number(e.target.value) })} />
            </Field>
            <Field label="Montant minimum du contrat (FCFA)">
              <Input type="number" min={0} value={rules.min_contract_amount} onChange={(e) => setRules({ ...rules, min_contract_amount: Number(e.target.value) })} />
            </Field>
            <Field label="Durée de suivi du lien (jours)">
              <Input type="number" min={1} max={730} value={rules.attribution_days} onChange={(e) => setRules({ ...rules, attribution_days: Number(e.target.value) })} />
            </Field>
            <Field label="Délai de signature du contrat (jours)">
              <Input type="number" min={1} max={1095} value={rules.signature_window_days} onChange={(e) => setRules({ ...rules, signature_window_days: Number(e.target.value) })} />
            </Field>
            <Field label="Avantage proposé au filleul" className="sm:col-span-2">
              <Input maxLength={300} value={rules.referee_benefit} onChange={(e) => setRules({ ...rules, referee_benefit: e.target.value })} />
            </Field>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}

const STATUS_TONE: Record<string, "info" | "accent" | "success" | "neutral"> = { captured: "info", signed: "accent", approved: "success", paid: "success", rejected: "neutral" };

/** Programme ambassadeurs (I6) : recommandations, validation des primes, paiement par le circuit finance. */
export function AmbassadorsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("signed");
  const [view, setView] = useState<"referrals" | "ambassadors">("referrals");
  const referrals = useApi<Referral[]>("/referrals", tab ? { status: tab } : undefined, [tab]);
  const ambassadors = useApi<Ambassador[]>(view === "ambassadors" ? "/ambassadors" : null);
  const program = useApi<Program>("/ambassadors/program");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ kind: "partner", full_name: "", email: "", phone: "", momo_number: "", momo_operator: "mtn", notes: "" });
  const [rejecting, setRejecting] = useState<Referral | null>(null);
  const [reason, setReason] = useState("");

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      void referrals.reload();
      void ambassadors.reload();
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <Gift className="h-7 w-7 text-accent-500" /> Programme ambassadeurs
          </span>
        }
        subtitle="Clients et prescripteurs recommandent GLOBUS ; la prime est calculée à la signature du contrat, validée ici, puis payée par Mobile Money via le circuit finance."
        actions={
          can("crm:write") ? (
            <Button onClick={() => setCreating(true)} disabled={!program.data?.enabled} title={program.data?.enabled ? undefined : "Ouvrez d'abord le programme"}>
              <Plus className="h-4 w-4" /> Nouveau prescripteur
            </Button>
          ) : null
        }
      />
      {program.data ? <ProgramCard program={program.data} onChange={() => void program.reload()} /> : <Skeleton className="h-24 w-full" />}
      <Tabs
        value={view}
        onChange={(v) => setView(v as "referrals" | "ambassadors")}
        tabs={[
          { key: "referrals", label: "Recommandations" },
          { key: "ambassadors", label: "Ambassadeurs" },
        ]}
      />
      {view === "referrals" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {REF_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${tab === t.key ? "bg-brand-600 text-white" : "bg-white text-muted ring-1 ring-line hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {referrals.loading && !referrals.data ? (
            <Skeleton className="h-64 w-full" />
          ) : referrals.data?.length ? (
            <Card>
              <ul className="divide-y divide-line">
                {referrals.data.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {r.referee} <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{optionLabel(r.status)}</Badge>
                      </p>
                      <p className="text-xs text-muted">
                        {r.number} · par {r.ambassador?.name ?? "—"} ({r.ambassador?.code}) · le {date(r.created_at)}
                        {r.signed_at ? ` · contrat de ${money(r.contract_amount)} signé le ${date(r.signed_at)}` : ""}
                        {r.rejection_reason ? ` · ${r.rejection_reason}` : ""}
                      </p>
                      {r.lead_id ? (
                        <a href={`/erp/crm/leads/${r.lead_id}`} className="text-xs font-semibold text-brand-600 hover:underline">
                          Voir le lead
                        </a>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {Number(r.amount) > 0 ? <span className="font-title text-lg font-bold tabular-nums">{money(r.amount)}</span> : null}
                      {r.status === "signed" && can("crm:contracts") ? (
                        <>
                          <Button size="sm" onClick={() => void act(() => api(`/referrals/${r.id}/approve`, { method: "POST" }), "Prime validée")}>
                            <Check className="h-4 w-4" /> Valider
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRejecting(r)}>
                            <X className="h-4 w-4" /> Refuser
                          </Button>
                        </>
                      ) : null}
                      {r.status === "approved" && can("finance:pay") ? (
                        <Button
                          size="sm"
                          variant="accent"
                          onClick={() =>
                            void act(
                              () => api("/payments/outgoing", { idempotent: `referral-${r.id}-${newKey()}`, body: { target_type: "referral_reward", target_id: r.id, method: "mobile_money" } }),
                              "Paiement créé — à approuver puis exécuter dans Finances › Paiements",
                            )
                          }
                        >
                          <Banknote className="h-4 w-4" /> Initier le paiement
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState title="Aucune recommandation dans cette catégorie" />
          )}
        </>
      ) : ambassadors.loading && !ambassadors.data ? (
        <Skeleton className="h-64 w-full" />
      ) : ambassadors.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ambassadors.data.map((a) => (
            <Card key={a.id} className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{a.full_name}</p>
                  <p className="text-xs text-muted">
                    {optionLabel(a.kind)} · code <span className="font-mono font-semibold text-brand-700">{a.code}</span>
                  </p>
                </div>
                <Badge tone={a.status === "active" ? "success" : "neutral"}>{a.status === "active" ? "Actif" : "Suspendu"}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Recomm." value={a.stats.referrals} />
                <Stat label="Signés" value={a.stats.signed} />
                <Stat label="Versé" value={money(a.stats.paid)} />
              </div>
              <p className="text-xs text-muted">{a.has_payout ? `Mobile Money ${a.momo_hint}` : "Aucun numéro de versement"}</p>
              {can("crm:write") ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void act(
                      () => api(`/ambassadors/${a.id}`, { method: "PATCH", body: { status: a.status === "active" ? "suspended" : "active" } }),
                      a.status === "active" ? "Ambassadeur suspendu" : "Ambassadeur réactivé",
                    )
                  }
                >
                  <UserX className="h-4 w-4" /> {a.status === "active" ? "Suspendre" : "Réactiver"}
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Aucun ambassadeur" text="Les clients adhèrent depuis leur espace ; inscrivez ici vos prescripteurs (architectes, notaires, agents, relais diaspora)." />
      )}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nouveau prescripteur"
        footer={
          <Button
            disabled={form.full_name.trim().length < 2}
            onClick={() =>
              void act(async () => {
                await api("/ambassadors", {
                  body: {
                    kind: form.kind,
                    full_name: form.full_name,
                    email: form.email || null,
                    phone: form.phone || null,
                    momo_number: form.momo_number || null,
                    momo_operator: form.momo_number ? form.momo_operator : null,
                    notes: form.notes || null,
                  },
                });
                setCreating(false);
              }, "Prescripteur inscrit — son code est actif")
            }
          >
            Inscrire
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} options={[{ value: "partner", label: "Partenaire prescripteur" }, { value: "employee", label: "Collaborateur" }]} />
          </Field>
          <Field label="Nom complet" required>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Téléphone">
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Numéro Mobile Money">
            <Input type="tel" value={form.momo_number} onChange={(e) => setForm({ ...form, momo_number: e.target.value })} />
          </Field>
          <Field label="Opérateur">
            <Select value={form.momo_operator} onChange={(e) => setForm({ ...form, momo_operator: e.target.value })} options={[{ value: "mtn", label: "MTN" }, { value: "orange", label: "Orange" }]} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Refuser la prime"
        footer={
          <Button
            variant="danger"
            disabled={reason.trim().length < 5}
            onClick={() =>
              void act(async () => {
                await api(`/referrals/${rejecting?.id}/reject`, { body: { reason } });
                setRejecting(null);
                setReason("");
              }, "Prime refusée")
            }
          >
            Refuser
          </Button>
        }
      >
        <Field label="Motif (visible par l'ambassadeur)" required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
