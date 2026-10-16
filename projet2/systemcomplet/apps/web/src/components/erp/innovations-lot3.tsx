"use client";

import { BadgeCheck, BookOpenCheck, CalendarPlus, Check, Download, FilePlus2, Landmark, Lock, Pencil, ScanEye, ShieldCheck, Sun, Trash2, Unlock, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ESCROW_STATUS, EscrowEvidence, type EscrowItemRow, type EscrowOverview } from "@/components/client/escrow-panel";
import { SchemaForm } from "@/components/forms/schema-form";
import { PlannedVsObserved, type TwinObservation } from "@/components/innovations/twin";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, download, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateLong, dateTime, money, number, toNumber } from "@/lib/format";
import { useApi, useList } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

// ============================================================================ I2 — bâtiment et maintenance
interface EquipmentRow {
  id: string;
  category: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  location?: string | null;
  installed_on?: string | null;
  warranty_until?: string | null;
  last_service_on?: string | null;
  maintenance_interval_days?: number | null;
  zone_id?: string | null;
  notes?: string | null;
  client_visible: boolean;
  manual_url?: string | null;
  next_task?: { id: string; title: string; due_on: string } | null;
}

interface MaintenanceTaskRow {
  id: string;
  equipment_id?: string | null;
  title: string;
  instructions?: string | null;
  due_on: string;
  recurrence_days?: number | null;
  performer: string;
  status: string;
  done_on?: string | null;
  ticket_id?: string | null;
  overdue: boolean;
}

const EQUIPMENT_SCHEMA = "app__modules__maintenance__router__EquipmentIn";
const CATEGORIES = ["climatisation", "plomberie", "pompe", "fosse", "electricite", "solaire", "groupe_electrogene", "toiture", "menuiserie", "peinture", "autre"];

export function ProjectBuildingTab({ projectId, projectCode }: { projectId: string; projectCode: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const equipment = useApi<EquipmentRow[]>(`/projects/${projectId}/equipment`);
  const tasks = useApi<MaintenanceTaskRow[]>(`/projects/${projectId}/maintenance-tasks`);
  const [editing, setEditing] = useState<EquipmentRow | "new" | null>(null);
  const [removing, setRemoving] = useState<EquipmentRow | null>(null);
  const [booking, setBooking] = useState<MaintenanceTaskRow | null>(null);
  const writable = can("projects:write");
  const reload = () => {
    void equipment.reload();
    void tasks.reload();
  };
  const fields = {
    category: { options: CATEGORIES.map((c) => ({ value: c, label: optionLabel(c) })) },
    zone_id: { ref: { ...REFS.zones, path: `/projects/${projectId}/bim/zones`, dependsOn: [] } },
    maintenance_interval_days: { help: "Vide : carnet d'entretien type de la catégorie." },
    notes: { span: 2 as const },
  };
  const uploadManual = async (row: EquipmentRow, file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    try {
      await api(`/equipment/${row.id}/manual`, { method: "POST", form });
      toast.success("Notice ajoutée", "Consultable par le client dans « Mon bâtiment ».");
      reload();
    } catch (err) {
      toast.error("Envoi impossible", errorMessage(err));
    }
  };
  const complete = async (task: MaintenanceTaskRow) => {
    try {
      await api(`/maintenance-tasks/${task.id}/complete`, { body: {} });
      toast.success("Entretien réalisé", "L'occurrence suivante est programmée.");
      reload();
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    }
  };
  const nameOf = (id?: string | null) => equipment.data?.find((e) => e.id === id)?.name;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <BookOpenCheck className="h-5 w-5 text-brand-600" /> Passeport du bâtiment
            </span>
          }
          subtitle="Équipements installés, notices, garanties et carnet d'entretien : remis au client à la réception, certifié et transmissible en cas de revente."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void download(`/projects/${projectId}/building-passport.pdf`, `passeport-batiment-${projectCode}.pdf`).catch((err) => toast.error("Génération impossible", errorMessage(err)))
                }
              >
                <Download className="h-4 w-4" /> Passeport certifié (PDF)
              </Button>
              {writable ? (
                <Button size="sm" onClick={() => setEditing("new")}>
                  <FilePlus2 className="h-4 w-4" /> Ajouter un équipement
                </Button>
              ) : null}
            </div>
          }
        />
        {equipment.loading && !equipment.data ? <Skeleton className="m-5 h-32" /> : null}
        <ul className="divide-y divide-line">
          {(equipment.data ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {e.name} <span className="text-xs font-normal text-muted">· {optionLabel(e.category)}</span>
                  {!e.client_visible ? (
                    <Badge tone="neutral" className="ml-2">
                      Interne
                    </Badge>
                  ) : null}
                </p>
                <p className="text-xs text-muted">
                  {[e.brand, e.model, e.serial_number ? `n° ${e.serial_number}` : null, e.location].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="text-xs text-muted">
                  Posé le {date(e.installed_on)} · garantie jusqu&apos;au {date(e.warranty_until)}
                  {e.next_task ? ` · prochain entretien ${date(e.next_task.due_on)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {e.manual_url ? (
                  <a href={e.manual_url} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50">
                    Notice
                  </a>
                ) : null}
                {writable ? (
                  <>
                    <label className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50">
                      {e.manual_url ? "Remplacer la notice" : "Ajouter la notice"}
                      <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(ev) => void uploadManual(e, ev.target.files?.[0])} />
                    </label>
                    <Button size="sm" variant="ghost" aria-label="Modifier" onClick={() => setEditing(e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Supprimer" onClick={() => setRemoving(e)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
          {equipment.data && !equipment.data.length ? <li className="px-5 py-4 text-sm text-muted">Aucun équipement inventorié.</li> : null}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Carnet d'entretien" subtitle="Rappels automatiques au client (J-14 et veille) ; « Planifier une intervention » ouvre un ticket SAV pré-rempli." />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2.5">Échéance</th>
                <th className="px-4 py-2.5">Entretien</th>
                <th className="px-4 py-2.5">Équipement</th>
                <th className="px-4 py-2.5">Par</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(tasks.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td className={`px-4 py-2.5 ${t.overdue ? "font-semibold text-red-600" : ""}`}>{date(t.due_on)}</td>
                  <td className="px-4 py-2.5">
                    {t.title}
                    {t.recurrence_days ? <span className="block text-xs text-muted">tous les {t.recurrence_days} jours</span> : null}
                  </td>
                  <td className="px-4 py-2.5">{nameOf(t.equipment_id) ?? "—"}</td>
                  <td className="px-4 py-2.5">{optionLabel(t.performer)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={t.overdue ? "overdue" : t.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {writable && ["planned", "booked"].includes(t.status) ? (
                      <span className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => void complete(t)}>
                          <Check className="h-4 w-4" /> Fait
                        </Button>
                        {t.status === "planned" && can("support:write") ? (
                          <Button size="sm" variant="ghost" onClick={() => setBooking(t)}>
                            <CalendarPlus className="h-4 w-4" /> Intervention
                          </Button>
                        ) : null}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
              {tasks.data && !tasks.data.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted">
                    Le carnet se remplit à l&apos;ajout des équipements.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nouvel équipement" : "Modifier l'équipement"} size="xl">
        {editing ? (
          <SchemaForm
            schema={EQUIPMENT_SCHEMA}
            initial={editing === "new" ? { client_visible: true } : { ...editing }}
            fields={fields}
            onSubmit={(payload) =>
              editing === "new" ? api(`/projects/${projectId}/equipment`, { method: "POST", body: payload }) : api(`/equipment/${editing.id}`, { method: "PATCH", body: payload })
            }
            onCancel={() => setEditing(null)}
            onSuccess={() => {
              toast.success(editing === "new" ? "Équipement ajouté" : "Équipement mis à jour", "Carnet d'entretien programmé.");
              setEditing(null);
              reload();
            }}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Supprimer l'équipement"
        text={`« ${removing?.name ?? ""} » et ses entretiens programmés seront supprimés.`}
        tone="danger"
        confirmLabel="Supprimer"
        onConfirm={async () => {
          await api(`/equipment/${removing?.id}`, { method: "DELETE" });
          toast.success("Équipement supprimé");
          reload();
        }}
      />
      <ConfirmDialog
        open={booking !== null}
        onClose={() => setBooking(null)}
        title="Planifier une intervention"
        text={`Un ticket SAV est ouvert pour « ${booking?.title ?? ""} ».`}
        reasonLabel="Précisions pour le technicien (facultatif)"
        reasonMin={0}
        confirmLabel="Ouvrir le ticket"
        onConfirm={async (note) => {
          const res = await api<{ ticket_number: string }>(`/maintenance-tasks/${booking?.id}/book`, { body: { note: note || null } });
          toast.success("Intervention planifiée", `Ticket ${res.ticket_number}`);
          reload();
        }}
      />
    </div>
  );
}

// ============================================================================ R1 — séquestre par jalon
interface FundsCallRef {
  id: string;
  number: string;
  label: string;
  amount: string;
  amount_paid: string;
  status: string;
}

export function ProjectEscrowTab({ projectId, currency }: { projectId: string; currency: string }) {
  const toast = useToast();
  const { can, hasRole } = useAuth();
  const overview = useApi<EscrowOverview>(`/projects/${projectId}/escrow`);
  const calls = useList<FundsCallRef>("/funds-calls", { pageSize: 200 }, { project_id: projectId });
  const milestones = useList<{ id: string; name: string; status: string }>("/milestones", { pageSize: 200 }, { project_id: projectId });
  const pvs = useList<{ id: string; code: string; title: string }>("/documents", { pageSize: 100 }, { project_id: projectId, doc_type: "pv" });
  const [setup, setSetup] = useState(false);
  const [activating, setActivating] = useState(false);
  const [attach, setAttach] = useState({ funds_call_id: "", milestone_id: "" });
  const [requesting, setRequesting] = useState<EscrowItemRow | null>(null);
  const [pv, setPv] = useState("");
  const [releasing, setReleasing] = useState<EscrowItemRow | null>(null);
  const [reference, setReference] = useState("");
  const [resolving, setResolving] = useState<EscrowItemRow | null>(null);
  const [decision, setDecision] = useState("release");
  const [busy, setBusy] = useState(false);
  const director = hasRole("DIRECTION", "ADMIN");
  const run = async (fn: () => Promise<unknown>, success: string | null, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      after?.();
      void overview.reload();
      void calls.reload();
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  if (overview.loading && !overview.data) return <Skeleton className="h-64 w-full" />;
  if (overview.error) return <Alert tone="danger">{overview.error}</Alert>;
  const account = overview.data?.account;
  const attached = new Set((overview.data?.items ?? []).map((i) => i.funds_call?.id));
  const attachable = calls.items.filter((c) => !attached.has(c.id) && toNumber(c.amount_paid) === 0 && c.status !== "cancelled");
  return (
    <div className="space-y-6">
      {!account ? (
        <EmptyState
          icon={<Lock className="h-8 w-8" />}
          title="Aucun séquestre sur ce projet"
          text="Les versements du client peuvent être détenus par une banque ou un notaire partenaire et libérés jalon par jalon, sur preuve et accord du client."
          action={can("finance:approve") ? <Button onClick={() => setSetup(true)}>Configurer le séquestre</Button> : undefined}
        />
      ) : (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-brand-600" /> Séquestre — {account.partner_name}
                <StatusBadge status={account.status} />
              </span>
            }
            subtitle={`Convention ${account.partner_reference ?? "à renseigner"} · délai de réponse du client ${account.review_days} jours${account.activated_at ? ` · actif depuis le ${date(account.activated_at)}` : ""}`}
            actions={
              <div className="flex gap-2">
                {can("finance:approve") ? (
                  <Button size="sm" variant="ghost" onClick={() => setSetup(true)}>
                    <Pencil className="h-4 w-4" /> Convention
                  </Button>
                ) : null}
                {account.status !== "active" && director ? (
                  <Button size="sm" onClick={() => setActivating(true)}>
                    <Unlock className="h-4 w-4" /> Activer
                  </Button>
                ) : null}
              </div>
            }
          />
          <div className="space-y-4 p-5">
            {account.status !== "active" ? (
              <Alert tone="warning" title="Séquestre inactif">
                Activation par la Direction après signature de la convention avec le partenaire (référence obligatoire). D&apos;ici là, aucun fonds n&apos;est réputé sous séquestre.
              </Alert>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Sous séquestre" value={money(account.balance_held, currency)} />
              <Stat label="Libéré" value={money(account.balance_released, currency)} tone="success" />
              <Stat label="Restitué au client" value={money(account.balance_refunded, currency)} />
            </div>
            {can("finance:write") ? (
              <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-surface p-4 ring-1 ring-line">
                <Field label="Appel de fonds (non réglé)" className="min-w-[14rem] flex-1">
                  <Select
                    value={attach.funds_call_id}
                    onChange={(e) => setAttach((a) => ({ ...a, funds_call_id: e.target.value }))}
                    placeholder="Choisir…"
                    options={attachable.map((c) => ({ value: c.id, label: `${c.number} — ${c.label} (${money(c.amount, currency)})` }))}
                  />
                </Field>
                <Field label="Jalon déclencheur" className="min-w-[14rem] flex-1">
                  <Select value={attach.milestone_id} onChange={(e) => setAttach((a) => ({ ...a, milestone_id: e.target.value }))} placeholder="Choisir…" options={milestones.items.map((m) => ({ value: m.id, label: m.name }))} />
                </Field>
                <Button
                  disabled={!attach.funds_call_id || !attach.milestone_id}
                  loading={busy}
                  onClick={() => void run(() => api(`/projects/${projectId}/escrow/items`, { body: attach }), "Appel de fonds placé sous séquestre", () => setAttach({ funds_call_id: "", milestone_id: "" }))}
                >
                  <Lock className="h-4 w-4" /> Placer sous séquestre
                </Button>
              </div>
            ) : null}
            <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
              {(overview.data?.items ?? []).map((item) => {
                const s = ESCROW_STATUS[item.status] ?? { label: item.status, tone: "neutral" as const };
                return (
                  <li key={item.id} className="p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {item.number} · {item.milestone?.name ?? "Jalon"} <span className="text-xs font-normal text-muted">({optionLabel(item.milestone?.status)})</span>
                        </p>
                        <p className="text-xs text-muted">
                          {item.funds_call ? `${item.funds_call.number} — ${item.funds_call.label} · ` : ""}
                          {money(item.held_amount, currency)} détenus / {money(item.amount, currency)}
                        </p>
                      </div>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </div>
                    <EscrowEvidence evidence={item.evidence} />
                    {item.client_decision ? (
                      <p className="mt-2 text-xs text-muted">
                        Client : {item.client_decision.decision === "approved" ? "libération validée" : "contestation"} par {item.client_decision.by} le {dateTime(item.client_decision.at)}
                      </p>
                    ) : null}
                    {item.dispute_reason ? <p className="mt-1 text-xs text-red-700">Motif : {item.dispute_reason}</p> : null}
                    {item.approvals?.length ? (
                      <p className="mt-1 text-xs text-muted">
                        Validations internes : {item.approvals.map((a) => `${a.name} (${a.role}, ${dateTime(a.at)})`).join(" · ")}
                      </p>
                    ) : null}
                    {item.release_reference ? <p className="mt-1 text-xs text-emerald-700">Ordre de libération {item.release_reference} · {dateTime(item.released_at)}</p> : null}
                    {item.resolution_note ? <p className="mt-1 text-xs text-muted">Médiation : {item.resolution_note}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.status === "held" && can("projects:write") && account.status === "active" ? (
                        <Button size="sm" variant="secondary" onClick={() => setRequesting(item)}>
                          <ShieldCheck className="h-4 w-4" /> Demander la libération
                        </Button>
                      ) : null}
                      {item.status === "approved" && can("finance:approve") ? (
                        <Button size="sm" onClick={() => setReleasing(item)}>
                          <BadgeCheck className="h-4 w-4" /> Valider la libération ({item.approvals?.length ?? 0}/2)
                        </Button>
                      ) : null}
                      {item.status === "disputed" && director ? (
                        <Button size="sm" variant="danger" onClick={() => setResolving(item)}>
                          Médiation
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
              {!overview.data?.items.length ? <li className="p-4 text-sm text-muted">Aucun appel de fonds sous séquestre.</li> : null}
            </ul>
          </div>
        </Card>
      )}
      <Modal open={setup} onClose={() => setSetup(false)} title="Convention de séquestre" size="lg">
        <SchemaForm
          endpoint="PUT /projects/{project_id}/escrow"
          params={{ project_id: projectId }}
          initial={account ? { partner_name: account.partner_name, partner_reference: account.partner_reference, review_days: account.review_days, terms: account.terms } : { review_days: 10 }}
          fields={{ partner_name: { help: "Banque ou notaire tiers de confiance" }, partner_reference: { help: "N° du compte ou de la convention (requis pour l'activation)" }, terms: { span: 2 } }}
          onCancel={() => setSetup(false)}
          onSuccess={() => {
            setSetup(false);
            toast.success("Convention enregistrée");
            void overview.reload();
          }}
        />
      </Modal>
      <ConfirmDialog
        open={activating}
        onClose={() => setActivating(false)}
        title="Activer le séquestre"
        text="Confirmez la signature de la convention avec le partenaire : les versements du client sur les appels rattachés seront comptabilisés sous séquestre."
        confirmLabel="Activer"
        onConfirm={async () => {
          await api(`/projects/${projectId}/escrow/activate`, { method: "POST" });
          toast.success("Séquestre actif");
          void overview.reload();
        }}
      />
      <Modal
        open={requesting !== null}
        onClose={() => setRequesting(null)}
        title="Demande de libération"
        footer={
          <Button
            loading={busy}
            disabled={!pv}
            onClick={() => void run(() => api(`/escrow/items/${requesting?.id}/request-release`, { body: { pv_document_id: pv } }), "Demande envoyée au client", () => setRequesting(null))}
          >
            Envoyer au client
          </Button>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Le jalon doit être déclaré atteint ; le PV publié et les photos certifiées des 21 derniers jours sont joints automatiquement comme preuves.
        </p>
        <Field label="Procès-verbal publié (type PV)" required>
          <Select value={pv} onChange={(e) => setPv(e.target.value)} placeholder="Choisir…" options={pvs.items.map((d) => ({ value: d.id, label: `${d.code} — ${d.title}` }))} />
        </Field>
      </Modal>
      <Modal
        open={releasing !== null}
        onClose={() => setReleasing(null)}
        title="Valider la libération"
        footer={
          <Button
            loading={busy}
            onClick={() =>
              void run(
                async () => {
                  const res = await api<{ released: boolean }>(`/escrow/items/${releasing?.id}/release`, { body: { reference: reference || null } });
                  if (res.released) toast.success("Fonds libérés", "Le client et l'équipe sont notifiés.");
                  else toast.info("Première validation enregistrée", "Une seconde personne (Finance ou Direction) doit valider.");
                },
                null,
                () => {
                  setReleasing(null);
                  setReference("");
                },
              )
            }
          >
            Valider
          </Button>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Double validation (deux personnes distinctes). La seconde exécute la libération : saisissez alors la référence de l&apos;ordre transmis au partenaire.
        </p>
        <Field label="Référence de l'ordre de libération">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </Modal>
      <ConfirmDialog
        open={resolving !== null}
        onClose={() => setResolving(null)}
        title="Médiation de la contestation"
        reasonLabel="Compte rendu de la médiation"
        reasonMin={10}
        tone={decision === "refund" ? "danger" : "primary"}
        confirmLabel={decision === "refund" ? "Restituer au client" : "Reprendre la libération"}
        onConfirm={async (note) => {
          await api(`/escrow/items/${resolving?.id}/resolve`, { body: { decision, note } });
          toast.success("Médiation enregistrée");
          void overview.reload();
        }}
      >
        <Field label="Décision">
          <Select value={decision} onChange={(e) => setDecision(e.target.value)} options={[{ value: "release", label: "Reprendre le circuit de libération" }, { value: "refund", label: "Restituer les fonds au client" }]} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}

// ============================================================================ I1 — jumeau numérique
const CONFIDENCE: Record<string, string> = { faible: "faible", moyenne: "moyenne", bonne: "bonne" };

function ObservationCard({ o, onChange }: { o: TwinObservation; onChange: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = o.status === "pending" && can("projects:write");
  const validate = async () => {
    setBusy(true);
    try {
      const adjustments: Record<string, number> = {};
      Object.entries(values).forEach(([k, v]) => {
        if (v !== "") adjustments[k] = Math.round(Number(v));
      });
      await api(`/twin/observations/${o.id}/validate`, { body: { adjustments, note: note || null } });
      toast.success("Avancement validé et certifié", "Les tâches et le client sont mis à jour.");
      onChange();
    } catch (err) {
      toast.error("Validation impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Mesure du {dateLong(o.observed_on)} <StatusBadge status={o.status} />
          </span>
        }
        subtitle={o.overall_observed_pct ? `Avancement observé global : ${number(toNumber(o.overall_observed_pct), 0)} %` : undefined}
        actions={
          o.proof_code ? (
            <a href={`/verification/${o.proof_code}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
              <ShieldCheck className="h-4 w-4" /> Certifiée
            </a>
          ) : null
        }
      />
      <div className="space-y-3 p-5">
        {o.summary ? <p className="text-sm">{o.summary}</p> : null}
        {o.anomalies?.length ? (
          <Alert tone="warning" title="Points d'attention">
            <ul className="list-disc pl-4">
              {o.anomalies.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-3">Tâche</th>
                <th className="py-2 pr-3">Prévu</th>
                <th className="py-2 pr-3">Déclaré</th>
                <th className="py-2 pr-3">Observé (IA)</th>
                <th className="py-2 pr-3">Justification</th>
                {pending ? <th className="py-2">Retenu</th> : <th className="py-2">Validé</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {o.results.map((r) => (
                <tr key={r.task_id ?? r.title} className={r.flag ? "bg-amber-50" : ""}>
                  <td className="py-2 pr-3">
                    {r.title}
                    <div className="mt-1 w-40">
                      <PlannedVsObserved planned={r.planned_pct} observed={r.observed_pct} />
                    </div>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{number(r.planned_pct, 0)} %</td>
                  <td className="py-2 pr-3 tabular-nums">{number(r.declared_pct ?? 0, 0)} %</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {r.observed_pct === null ? "—" : `${r.observed_pct} %`}
                    {r.confidence ? <span className="block text-xs text-muted">confiance {CONFIDENCE[r.confidence] ?? r.confidence}</span> : null}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted">{r.evidence}</td>
                  <td className="py-2">
                    {pending && r.task_id ? (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="w-20"
                        aria-label={`Avancement retenu — ${r.title}`}
                        placeholder={r.observed_pct === null ? "—" : String(r.observed_pct)}
                        value={values[r.task_id] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [r.task_id as string]: e.target.value }))}
                      />
                    ) : r.validated_pct !== undefined && r.validated_pct !== null ? (
                      `${r.validated_pct} %`
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {o.decision_note ? <p className="text-xs text-muted">Note : {o.decision_note}</p> : null}
        {pending ? (
          <div className="space-y-2">
            <Field label="Note de validation (facultatif)">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <p className="text-xs text-muted">Champ « Retenu » vide = valeur observée par l&apos;IA. Les tâches non visibles restent inchangées.</p>
            <div className="flex gap-2">
              <Button loading={busy} onClick={() => void validate()}>
                <BadgeCheck className="h-4 w-4" /> Valider et certifier
              </Button>
              <Button variant="ghost" onClick={() => setRejecting(true)}>
                <X className="h-4 w-4" /> Rejeter
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Rejeter la mesure"
        reasonLabel="Motif"
        reasonMin={5}
        tone="danger"
        confirmLabel="Rejeter"
        onConfirm={async (reason) => {
          await api(`/twin/observations/${o.id}/reject`, { body: { note: reason } });
          toast.success("Mesure rejetée");
          onChange();
        }}
      />
    </Card>
  );
}

export function ProjectTwinTab({ projectId }: { projectId: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const list = useApi<TwinObservation[]>(`/projects/${projectId}/twin`);
  const zones = useApi<{ id: string; code: string; name: string }[]>(can("bim:read") ? `/projects/${projectId}/bim/zones` : null);
  const [zone, setZone] = useState("");
  const [busy, setBusy] = useState(false);
  const analyze = async () => {
    setBusy(true);
    try {
      await api(`/projects/${projectId}/twin/analyze`, { body: { zone_id: zone || null } });
      toast.success("Mesure proposée", "Vérifiez puis validez l'avancement observé.");
      void list.reload();
    } catch (err) {
      toast.error("Mesure impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ScanEye className="h-5 w-5 text-brand-600" /> Jumeau numérique — avancement par l&apos;image
            </span>
          }
          subtitle="Les photos récentes sont confrontées au planning et à la maquette ; un responsable valide ou corrige, puis la mesure est certifiée et partagée au client."
        />
        {can("projects:write", "ai:use") ? (
          <div className="flex flex-wrap items-end gap-3 p-5">
            {zones.data?.length ? (
              <Field label="Zone (facultatif)" className="min-w-[14rem]">
                <Select value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Tout le chantier" options={zones.data.map((z) => ({ value: z.id, label: `${z.code} — ${z.name}` }))} />
              </Field>
            ) : null}
            <Button loading={busy} onClick={() => void analyze()}>
              <ScanEye className="h-4 w-4" /> Mesurer l&apos;avancement
            </Button>
            <p className="text-xs text-muted">Nécessite l&apos;IA configurée et des photos datées de moins de 14 jours.</p>
          </div>
        ) : (
          <p className="p-5 text-sm text-muted">Mesure réservée aux responsables disposant de l&apos;IA.</p>
        )}
      </Card>
      {list.loading && !list.data ? <Skeleton className="h-48 w-full" /> : null}
      {(list.data ?? []).map((o) => (
        <ObservationCard key={o.id} o={o} onChange={() => void list.reload()} />
      ))}
      {list.data && !list.data.length ? <EmptyState icon={<ScanEye className="h-8 w-8" />} title="Aucune mesure" text="Lancez une première mesure après la publication de photos de chantier." /> : null}
    </div>
  );
}

// ============================================================================ I3 — énergie et confort
interface EnergyStudyRow {
  id: string;
  title: string;
  status: string;
  inputs: Record<string, unknown> & { measures?: string[] };
  results: {
    before?: { bill_month: number; kwh_year: number };
    after?: { bill_month: number; kwh_year: number };
    measures?: { key: string; label: string; cost: number; saving_year: number }[];
    investment?: number;
    savings_year?: number;
    payback_years?: number | null;
    autonomy_hours?: number;
    comfort_gain_degrees?: number;
  };
  created_at: string;
}

export function ProjectEnergyTab({ projectId }: { projectId: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const studies = useApi<EnergyStudyRow[]>(`/projects/${projectId}/energy/studies`);
  const quoted = async (id: string) => {
    try {
      await api(`/energy/studies/${id}/quoted`, { method: "POST" });
      toast.success("Étude marquée chiffrée");
      void studies.reload();
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    }
  };
  if (studies.loading && !studies.data) return <Skeleton className="h-48 w-full" />;
  if (!studies.data?.length)
    return <EmptyState icon={<Sun className="h-8 w-8" />} title="Aucune étude énergie" text="Le client simule isolation, protections solaires, inverter, solaire et batterie depuis son espace ; ses demandes apparaissent ici." />;
  return (
    <div className="space-y-4">
      {studies.data.map((s) => (
        <Card key={s.id}>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                {s.title} <StatusBadge status={s.status} />
              </span>
            }
            subtitle={`Créée le ${dateTime(s.created_at)}`}
            actions={
              s.status === "requested" && can("projects:write") ? (
                <div className="flex gap-2">
                  <Link href={`/erp/chantiers/${projectId}?onglet=avenants`} className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-50">
                    <Wrench className="h-4 w-4" /> Préparer l&apos;avenant
                  </Link>
                  <Button size="sm" variant="secondary" onClick={() => void quoted(s.id)}>
                    Marquer chiffrée
                  </Button>
                </div>
              ) : null
            }
          />
          <div className="grid gap-3 p-5 sm:grid-cols-4">
            <Stat label="Facture actuelle / mois" value={money(s.results.before?.bill_month)} />
            <Stat label="Facture après / mois" value={money(s.results.after?.bill_month)} tone="success" />
            <Stat label="Investissement" value={money(s.results.investment)} />
            <Stat label="Retour sur investissement" value={s.results.payback_years ? `${number(s.results.payback_years, 1)} ans` : "—"} hint={`Économie ${money(s.results.savings_year)} / an`} />
          </div>
          <ul className="space-y-1 px-5 pb-5 text-sm">
            {(s.results.measures ?? []).map((m) => (
              <li key={m.key} className="flex justify-between gap-3">
                <span>{m.label}</span>
                <span className="text-muted">
                  {money(m.cost)} · {money(m.saving_year)} / an
                </span>
              </li>
            ))}
            {s.results.autonomy_hours ? <li className="text-xs text-muted">Autonomie délestage : {number(s.results.autonomy_hours, 1)} h</li> : null}
          </ul>
        </Card>
      ))}
    </div>
  );
}
