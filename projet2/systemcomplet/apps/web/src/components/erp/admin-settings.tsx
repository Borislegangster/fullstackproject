"use client";

import { CheckCircle2, Database, Eraser, KeyRound, Play, Plus, RotateCcw, Send, ShieldAlert, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RolePicker } from "@/components/cms/form-editor";
import type { Row } from "@/components/erp/resource";
import { RefSelect } from "@/components/forms/ref-select";
import { CheckGroup, RowsEditor, ValueEditor } from "@/components/forms/structured-fields";
import { Checkbox, Field, Input, Select, TagInput, Textarea, type Option } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, PageTitle, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, fileSize, number, relative } from "@/lib/format";
import { useApi, useList } from "@/lib/hooks";
import { fieldLabel, optionLabel } from "@/lib/labels";
import type { RefSource } from "@/lib/refs";

/* ----------------------------------------------------------------------------- paramètres généraux */

/** Aperçu lisible d'une valeur de paramètre (texte, oui/non, liste, groupe de réglages). */
function summary(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (Array.isArray(v)) return v.length ? v.map(summary).join(", ") : "Liste vide";
  if (typeof v === "object") return Object.entries(v).map(([k, x]) => `${fieldLabel(k)} : ${summary(x)}`).join(" · ") || "—";
  return String(v);
}

export function GeneralSettings() {
  const { can } = useAuth();
  const toast = useToast();
  const settings = useApi<Row[]>("/admin/settings");
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<{ value: unknown; category: string; is_public: boolean; description: string }>({ value: null, category: "general", is_public: false, description: "" });
  const grouped = (settings.data ?? []).reduce<Record<string, Row[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});
  const open = (s: Row | null) => {
    setEditing(s ?? { key: "", value: null });
    setDraft({ value: s ? (s.value ?? null) : "", category: s?.category ?? "general", is_public: !!s?.is_public, description: s?.description ?? "" });
  };
  return (
    <div className="space-y-4">
      {can("settings:write") ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => open(null)}>
            <Plus className="h-4 w-4" /> Paramètre
          </Button>
        </div>
      ) : null}
      {settings.loading && !settings.data ? (
        <Skeleton className="h-48" />
      ) : (
        Object.entries(grouped).map(([category, rows]) => (
          <Card key={category}>
            <CardHeader title={optionLabel(category)} />
            <ul className="divide-y divide-line text-sm">
              {rows.map((s) => (
                <li key={s.key} className="flex flex-wrap items-start justify-between gap-2 px-5 py-2.5">
                  <span className="min-w-0">
                    <span className="font-mono text-xs font-semibold">{s.key}</span> {s.is_public ? <Badge tone="info">public</Badge> : null}
                    {s.description ? <span className="block text-xs text-muted">{s.description}</span> : null}
                    <span className="mt-1 block max-w-2xl truncate text-xs text-muted">{summary(s.value)}</span>
                  </span>
                  {can("settings:write") ? (
                    <Button size="sm" variant="ghost" onClick={() => open(s)}>
                      Modifier
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.key ? `Paramètre ${editing.key}` : "Nouveau paramètre"}
        size="lg"
        footer={
          <Button
            disabled={!editing?.key}
            onClick={async () => {
              try {
                await api(`/admin/settings/${encodeURIComponent(editing?.key ?? "")}`, { method: "PUT", body: { value: draft.value, category: draft.category, is_public: draft.is_public, description: draft.description || null } });
                setEditing(null);
                void settings.reload();
                toast.success("Paramètre enregistré");
              } catch (err) {
                toast.error("Enregistrement impossible", errorMessage(err));
              }
            }}
          >
            Enregistrer
          </Button>
        }
      >
        {editing ? (
          <div className="space-y-3">
            {!settings.data?.some((s) => s.key === editing.key) ? (
              <Field label="Clé" help="Lettres, chiffres, points et soulignés.">
                <Input value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value.replace(/[^A-Za-z0-9_.]/g, "") })} />
              </Field>
            ) : null}
            <fieldset className="min-w-0">
              <legend className="mb-1 block text-sm font-medium text-ink">Valeur</legend>
              <ValueEditor key={editing.key} value={draft.value} onChange={(value) => setDraft({ ...draft, value })} />
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Catégorie">
                <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              </Field>
              <div className="flex items-end pb-2">
                <Checkbox label="Exposé publiquement (lecture sans connexion)" checked={draft.is_public} onChange={(c) => setDraft({ ...draft, is_public: c })} />
              </div>
            </div>
            <Field label="Description">
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- fonctionnalités */

export function FeatureFlags() {
  const { can } = useAuth();
  const toast = useToast();
  const flags = useApi<Row[]>("/admin/feature-flags");
  const [editing, setEditing] = useState<Row | null>(null);
  const save = async (key: string, body: Row) => {
    try {
      await api(`/admin/feature-flags/${encodeURIComponent(key)}`, { method: "PUT", body });
      void flags.reload();
    } catch (err) {
      toast.error("Modification impossible", errorMessage(err));
    }
  };
  return (
    <Card>
      <CardHeader title="Fonctionnalités" subtitle="Activation progressive (rôles ciblés, pourcentage d'utilisateurs)." actions={can("settings:write") ? <Button size="sm" variant="secondary" onClick={() => setEditing({ key: "", enabled: false, roles: [], percentage: 100, description: "" })}><Plus className="h-4 w-4" /> Fonctionnalité</Button> : null} />
      <ul className="divide-y divide-line text-sm">
        {(flags.data ?? []).map((f) => (
          <li key={f.key} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
            <span>
              <span className="font-mono text-xs font-semibold">{f.key}</span>
              {f.description ? <span className="block text-xs text-muted">{f.description}</span> : null}
              <span className="block text-xs text-muted">
                {f.percentage < 100 ? `${f.percentage} % des utilisateurs` : "Tous les utilisateurs"}
                {(f.roles ?? []).length ? ` · rôles ${(f.roles as string[]).join(", ")}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {can("settings:write") ? (
                <>
                  <Checkbox label={f.enabled ? "Activée" : "Désactivée"} checked={!!f.enabled} onChange={(c) => void save(f.key, { enabled: c, description: f.description, roles: f.roles ?? [], percentage: f.percentage ?? 100 })} />
                  <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                    Régler
                  </Button>
                </>
              ) : (
                <StatusBadge status={f.enabled ? "active" : "inactive"} />
              )}
            </span>
          </li>
        ))}
        {!flags.loading && !flags.data?.length ? <li className="px-5 py-4 text-muted">Aucune fonctionnalité pilotable.</li> : null}
      </ul>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.key ? `Fonctionnalité ${editing.key}` : "Nouvelle fonctionnalité"}
        footer={
          <Button
            disabled={!editing?.key}
            onClick={async () => {
              if (!editing) return;
              await save(editing.key, { enabled: !!editing.enabled, description: editing.description || null, roles: editing.roles ?? [], percentage: Number(editing.percentage ?? 100) });
              setEditing(null);
            }}
          >
            Enregistrer
          </Button>
        }
      >
        {editing ? (
          <div className="space-y-3">
            <Field label="Clé">
              <Input value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value.replace(/[^a-z0-9_.-]/gi, "") })} disabled={!!flags.data?.some((f) => f.key === editing.key)} />
            </Field>
            <Field label="Description">
              <Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <fieldset className="min-w-0">
              <legend className="mb-1 block text-sm font-medium text-ink">Rôles ciblés (aucun = tous)</legend>
              <RolePicker value={editing.roles ?? []} onChange={(roles) => setEditing({ ...editing, roles })} />
            </fieldset>
            <Field label="Pourcentage d'utilisateurs">
              <Input type="number" min={0} max={100} value={editing.percentage ?? 100} onChange={(e) => setEditing({ ...editing, percentage: Number(e.target.value) })} />
            </Field>
            <Checkbox label="Activée" checked={!!editing.enabled} onChange={(c) => setEditing({ ...editing, enabled: c })} />
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}

/* ----------------------------------------------------------------------------- notifications */

const CHANNELS = ["in_app", "email", "push", "sms", "whatsapp"];

const PROJECT_ROLES: Option[] = [
  { value: "chef_projet", label: "Chef de projet" },
  { value: "conducteur_travaux", label: "Conducteur de travaux" },
  { value: "chef_chantier", label: "Chef de chantier" },
  { value: "ingenieur", label: "Ingénieur" },
  { value: "architecte", label: "Architecte" },
  { value: "bim_manager", label: "BIM manager" },
  { value: "acheteur", label: "Acheteur" },
  { value: "qhse", label: "QHSE" },
  { value: "comptable", label: "Comptable" },
  { value: "partenaire", label: "Partenaire" },
  { value: "membre", label: "Membre" },
];
/** Personnes désignées par l'événement (champ technique → libellé lisible). */
const PAYLOAD_USERS: Record<string, string> = {
  ambassador_user_id: "Ambassadeur concerné",
  approver_ids: "Approbateurs",
  assigned_to_id: "Personne affectée",
  assignee_id: "Personne assignée",
  created_by_id: "Créateur",
  handled_by_id: "Personne en charge",
  invited_user_ids: "Personnes invitées",
  manager_id: "Responsable hiérarchique",
  offline_user_ids: "Utilisateurs hors ligne",
  owner_id: "Propriétaire du dossier",
  party_user_ids: "Parties prenantes",
  po_created_by_id: "Auteur du bon de commande",
  requested_by_id: "Demandeur",
  requester_id: "Demandeur (ticket)",
  responsible_id: "Responsable de l'action",
  signer_ids: "Signataires",
  site_manager_id: "Chef de chantier du site",
  subcontractor_user_ids: "Utilisateurs du sous-traitant",
  uploaded_by_id: "Auteur du dépôt",
  user_id: "Utilisateur concerné",
  user_ids: "Utilisateurs concernés",
};
const PERMISSIONS: RefSource = { path: "/permissions", label: (r) => r.label ?? r.code, sublabel: (r) => r.code, paginated: false };

/** Destinataires d'une règle : rôles internes, rôles sur le projet, personnes citées par l'événement, client… */
function AudienceEditor({ value, onChange, payloadKeys }: { value: Row; onChange: (v: Row) => void; payloadKeys: string[] }) {
  const set = (patch: Row) => onChange({ ...value, ...patch });
  const flag = (key: string, on: boolean) => {
    const next = { ...value };
    if (on) next[key] = true;
    else delete next[key];
    onChange(next);
  };
  return (
    <div className="space-y-4 rounded-xl border border-line p-3">
      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-1 block text-sm font-medium text-ink">Rôles internes</legend>
        <RolePicker value={Array.isArray(value.roles) ? value.roles : []} onChange={(roles) => set({ roles })} />
        <Checkbox label="Seulement les membres du projet concerné (hors rôles à portée globale)" checked={!!value.project_scoped} onChange={(on) => flag("project_scoped", on)} />
      </fieldset>
      <CheckGroup legend="Rôles sur le projet concerné" options={PROJECT_ROLES} value={value.project_roles ?? []} onChange={(project_roles) => set({ project_roles })} />
      <CheckGroup legend="Personnes citées dans l'événement" help="Ex. le demandeur, la personne affectée, les approbateurs." options={payloadKeys.map((k) => ({ value: k, label: PAYLOAD_USERS[k] ?? fieldLabel(k) }))} value={value.payload_users ?? []} onChange={(payload_users) => set({ payload_users })} />
      <Field label="Détenteurs d'une permission (facultatif)">
        <RefSelect source={PERMISSIONS} value={value.permission ?? null} onChange={(permission) => set({ permission: permission ?? undefined })} />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Checkbox label="Tous les membres internes du projet" checked={!!value.project_members} onChange={(on) => flag("project_members", on)} />
        <Checkbox label="Le client du projet" checked={!!value.client} onChange={(on) => flag("client", on)} />
        <Checkbox label="Prévenir aussi l'auteur de l'action" checked={!!value.include_actor} onChange={(on) => flag("include_actor", on)} />
      </div>
    </div>
  );
}

/** Valeurs acceptées d'une condition ; les valeurs non textuelles déjà enregistrées gardent leur type. */
function ConditionValues({ value, onChange }: { value: unknown; onChange: (v: unknown[]) => void }) {
  const list = Array.isArray(value) ? value : [];
  const text = (v: unknown) => (v === null || v === undefined ? "(vide)" : String(v));
  return <TagInput value={list.map(text)} onChange={(tags) => onChange(tags.map((t) => list.find((v) => text(v) === t) ?? (t === "(vide)" ? null : t)))} placeholder="Valeur puis Entrée" />;
}

/** Conditions `{ information: [valeurs acceptées] }` et modèle d'e-mail dédié (`email_template`). */
function ConditionsEditor({ value, onChange }: { value: Row; onChange: (v: Row) => void }) {
  const { email_template: emailTemplate, ...rest } = value;
  // Lignes locales : une condition en cours de saisie (information vide) reste affichée.
  const [rows, setRows] = useState<Row[]>(() => Object.entries(rest).map(([field, allowed]) => ({ field, allowed: Array.isArray(allowed) ? allowed : [allowed] })));
  const emit = (next: Row[], template: unknown = emailTemplate) => {
    setRows(next);
    const out: Row = Object.fromEntries(next.filter((r) => String(r.field ?? "").trim()).map((r) => [String(r.field).trim(), r.allowed ?? []]));
    if (template) out.email_template = template;
    onChange(out);
  };
  return (
    <div className="space-y-3">
      <RowsEditor
        value={rows}
        onChange={(next) => emit(next)}
        sortable={false}
        itemLabel="Condition"
        title={(r, i) => (r.field ? `Si « ${fieldLabel(String(r.field))} » vaut…` : `Condition ${i + 1}`)}
        fields={[
          { key: "field", label: "Information de l'événement", placeholder: "Ex. severity", help: "Nom technique transmis par l'événement." },
          { key: "allowed", label: "Valeurs acceptées", wide: true, render: (row, set) => <ConditionValues value={row.allowed} onChange={(allowed) => set({ allowed })} /> },
        ]}
        newRow={() => ({ field: "", allowed: [] })}
        addLabel="Condition"
        empty="Aucune condition : la règle s'applique à chaque événement."
      />
      <Field label="Modèle d'e-mail dédié (facultatif)" help="Code d'un modèle d'e-mail à utiliser à la place du modèle de la règle.">
        <Input value={typeof emailTemplate === "string" ? emailTemplate : ""} list="template-codes" onChange={(e) => emit(rows, e.target.value || undefined)} />
      </Field>
    </div>
  );
}

export function NotificationsAdmin() {
  const toast = useToast();
  const templates = useApi<Row[]>("/admin/notification-templates");
  const rules = useApi<Row[]>("/admin/notification-rules");
  const stats = useApi<Row>("/admin/notification-stats", { days: 30 });
  const [tab, setTab] = useState("regles");
  const [template, setTemplate] = useState<Row | null>(null);
  const [rule, setRule] = useState<Row | null>(null);
  const [audience, setAudience] = useState<Row>({});
  const [conditions, setConditions] = useState<Row>({});
  const payloadKeys = Array.from(new Set([...Object.keys(PAYLOAD_USERS), ...(rules.data ?? []).flatMap((r) => (Array.isArray(r.audience?.payload_users) ? (r.audience.payload_users as string[]) : []))])).sort((a, b) => (PAYLOAD_USERS[a] ?? a).localeCompare(PAYLOAD_USERS[b] ?? b, "fr"));
  const deliveries = useList<Row>("/admin/notification-deliveries", { pageSize: 30 });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {CHANNELS.map((c) => {
          const s = (stats.data?.by_channel?.[c] ?? {}) as Record<string, number>;
          const total = Object.values(s).reduce((a, b) => a + b, 0);
          return <Stat key={c} label={optionLabel(c)} value={number(total)} hint={Object.entries(s).map(([k, v]) => `${optionLabel(k)} ${v}`).join(" · ") || "30 derniers jours"} tone={(s.failed ?? 0) > 0 ? "warning" : "neutral"} />;
        })}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "regles", label: "Règles de diffusion", count: rules.data?.length ?? null },
          { key: "modeles", label: "Modèles de messages", count: templates.data?.length ?? null },
          { key: "envois", label: "Journal des envois" },
        ]}
      />
      {tab === "regles" ? (
        <Card>
          <CardHeader
            title="Qui est notifié, sur quel canal, pour quel événement"
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setRule({ event_type: "", name: "", channels: ["in_app"], template_code: "", category: "general", priority: "normal", is_active: true });
                  setAudience({ roles: [] });
                  setConditions({});
                }}
              >
                <Plus className="h-4 w-4" /> Règle
              </Button>
            }
          />
          <ul className="divide-y divide-line text-sm">
            {(rules.data ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span>
                  <span className="font-medium">{r.name}</span> <span className="font-mono text-xs text-muted">{r.event_type}</span>
                  <span className="block text-xs text-muted">
                    {(r.channels ?? []).map((c: string) => optionLabel(c)).join(", ")} · modèle {r.template_code} · priorité {optionLabel(r.priority)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {r.is_system ? <Badge tone="info">Système</Badge> : null}
                  <StatusBadge status={r.is_active ? "active" : "inactive"} />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRule(r);
                      setAudience(r.audience ?? {});
                      setConditions(r.conditions ?? {});
                    }}
                  >
                    Modifier
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {tab === "modeles" ? (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {(templates.data ?? []).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span>
                  <span className="font-mono text-xs font-semibold">{t.code}</span> · {optionLabel(t.channel)} · v{t.version}
                  {t.subject ? <span className="block text-xs text-muted">{t.subject}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={t.is_active ? "active" : "inactive"} />
                  <Button size="sm" variant="ghost" onClick={() => setTemplate(t)}>
                    Modifier
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {tab === "envois" ? (
        <Card>
          <div className="flex flex-wrap gap-2 border-b border-line p-3">
            <Select value={deliveries.state.filters.channel ?? ""} onChange={(e) => deliveries.setFilter("channel", e.target.value)} options={[{ value: "", label: "Tous canaux" }, ...CHANNELS.map((c) => ({ value: c, label: optionLabel(c) }))]} aria-label="Canal" />
            <Select value={deliveries.state.filters.status ?? ""} onChange={(e) => deliveries.setFilter("status", e.target.value)} options={[{ value: "", label: "Tous statuts" }, ...["pending", "sent", "delivered", "failed", "skipped"].map((s) => ({ value: s, label: optionLabel(s) }))]} aria-label="Statut" />
          </div>
          <ul className="divide-y divide-line text-sm">
            {deliveries.items.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2">
                <span>
                  {dateTime(d.created_at)} · {optionLabel(d.channel)} · {d.recipient}
                  {d.error ? <span className="block text-xs text-red-600">{d.error}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  {d.provider ? <span className="text-xs text-muted">{d.provider}</span> : null}
                  <StatusBadge status={d.status} />
                </span>
              </li>
            ))}
            {!deliveries.loading && !deliveries.items.length ? <li className="px-5 py-4 text-muted">Aucun envoi.</li> : null}
          </ul>
        </Card>
      ) : null}

      <Modal
        open={!!template}
        onClose={() => setTemplate(null)}
        title={`Modèle ${template?.code ?? ""} (${optionLabel(template?.channel)})`}
        size="lg"
        footer={
          <Button
            onClick={async () => {
              try {
                await api(`/admin/notification-templates/${template?.id}`, { method: "PUT", body: { subject: template?.subject || null, body: template?.body, whatsapp_template: template?.whatsapp_template || null, is_active: template?.is_active !== false } });
                setTemplate(null);
                void templates.reload();
                toast.success("Modèle enregistré (nouvelle version)");
              } catch (err) {
                toast.error("Enregistrement impossible", errorMessage(err));
              }
            }}
          >
            Enregistrer
          </Button>
        }
      >
        {template ? (
          <div className="space-y-3">
            {template.channel === "email" ? (
              <Field label="Objet">
                <Input value={template.subject ?? ""} onChange={(e) => setTemplate({ ...template, subject: e.target.value })} />
              </Field>
            ) : null}
            <Field label="Contenu" help="Variables Jinja2 (environnement isolé) : {{ number }}, {{ title }}, {{ link }}…">
              <Textarea value={template.body ?? ""} onChange={(e) => setTemplate({ ...template, body: e.target.value })} rows={10} className="font-mono text-xs" />
            </Field>
            {template.channel === "whatsapp" ? (
              <Field label="Modèle WhatsApp approuvé (Meta)">
                <Input value={template.whatsapp_template ?? ""} onChange={(e) => setTemplate({ ...template, whatsapp_template: e.target.value })} />
              </Field>
            ) : null}
            <Checkbox label="Actif" checked={template.is_active !== false} onChange={(c) => setTemplate({ ...template, is_active: c })} />
          </div>
        ) : null}
      </Modal>
      <Modal
        open={!!rule}
        onClose={() => setRule(null)}
        title={rule?.id ? `Règle ${rule.name}` : "Nouvelle règle"}
        size="lg"
        footer={
          <Button
            disabled={!rule?.event_type || !rule?.template_code || (rule?.name ?? "").length < 3}
            onClick={async () => {
              if (!rule) return;
              const body = { event_type: rule.event_type, name: rule.name, audience, channels: rule.channels, template_code: rule.template_code, category: rule.category, priority: rule.priority, conditions, is_active: rule.is_active !== false };
              try {
                await api(rule.id ? `/admin/notification-rules/${rule.id}` : "/admin/notification-rules", { method: rule.id ? "PUT" : "POST", body });
                setRule(null);
                void rules.reload();
                toast.success("Règle enregistrée");
              } catch (err) {
                toast.error("Enregistrement impossible", errorMessage(err));
              }
            }}
          >
            Enregistrer
          </Button>
        }
      >
        {rule ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nom">
                <Input value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} />
              </Field>
              <Field label="Événement déclencheur">
                <Input value={rule.event_type} onChange={(e) => setRule({ ...rule, event_type: e.target.value })} placeholder="payment.awaiting_approval" />
              </Field>
              <Field label="Code du modèle">
                <Input value={rule.template_code} onChange={(e) => setRule({ ...rule, template_code: e.target.value })} list="template-codes" />
                <datalist id="template-codes">
                  {Array.from(new Set((templates.data ?? []).map((t) => t.code))).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Priorité">
                <Select value={rule.priority} onChange={(e) => setRule({ ...rule, priority: e.target.value })} options={["low", "normal", "high", "critical"].map((p) => ({ value: p, label: optionLabel(p) }))} />
              </Field>
              <Field label="Catégorie (préférences utilisateur)">
                <Input value={rule.category} onChange={(e) => setRule({ ...rule, category: e.target.value })} />
              </Field>
            </div>
            <Field label="Canaux">
              <div className="flex flex-wrap gap-3">
                {CHANNELS.map((c) => (
                  <Checkbox key={c} label={optionLabel(c)} checked={(rule.channels ?? []).includes(c)} onChange={(on) => setRule({ ...rule, channels: on ? [...(rule.channels ?? []), c] : (rule.channels ?? []).filter((x: string) => x !== c) })} />
                ))}
              </div>
            </Field>
            <fieldset className="min-w-0">
              <legend className="mb-1 block text-sm font-medium text-ink">Destinataires</legend>
              <AudienceEditor value={audience} onChange={setAudience} payloadKeys={payloadKeys} />
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mb-1 block text-sm font-medium text-ink">Conditions d'envoi (facultatives)</legend>
              <ConditionsEditor key={`c-${rule.id ?? "new"}`} value={conditions} onChange={setConditions} />
            </fieldset>
            <Checkbox label="Active" checked={rule.is_active !== false} onChange={(c) => setRule({ ...rule, is_active: c })} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- intégrations */

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-slate-400" />;
}

export function IntegrationsAdmin() {
  const toast = useToast();
  const status = useApi<Row>("/admin/integrations");
  const secrets = useApi<Row[]>("/admin/secrets");
  const webhooks = useApi<Row[]>("/admin/webhooks");
  const events = useApi<{ type: string; label: string }[]>("/admin/webhooks/events");
  const [secret, setSecret] = useState<Row | null>(null);
  const [secretValue, setSecretValue] = useState("");
  const [hook, setHook] = useState<Row | null>(null);
  const [deliveriesOf, setDeliveriesOf] = useState<Row | null>(null);
  const deliveries = useApi<{ items: Row[] }>(deliveriesOf ? `/admin/webhooks/${deliveriesOf.id}/deliveries` : null, { page_size: 30 });
  const s = status.data ?? {};
  const cards: [string, boolean, string][] = [
    ["E-mail", !!s.email?.configured, s.email?.provider ?? ""],
    ["WhatsApp Business", !!s.whatsapp?.available, s.whatsapp?.provider ?? ""],
    ["SMS", !!s.sms?.configured, s.sms?.provider ?? ""],
    ["Paiements", ((s.payments?.methods ?? []) as Row[]).length > 0, (s.payments?.providers ?? []).join(", ")],
    ["Notifications push web", !!s.push?.webpush, "navigateur et ordinateur"],
    ["Notifications push mobile", !!s.push?.fcm, "applications Android / iOS (Firebase)"],
    ["Autodesk APS (BIM)", !!s.bim_aps?.configured, s.bim_aps?.region ?? ""],
    ["IA (Claude)", !!s.ai?.configured, s.ai?.model ?? ""],
    ["Reconnaissance vocale serveur", !!s.speech_to_text?.server, ""],
    ["Antivirus des fichiers", !!s.storage?.antivirus, s.storage?.private ?? ""],
    ["Temps réel multi-serveurs (Redis)", !!s.realtime?.redis, ""],
    ["Relais d'appels (TURN)", !!s.realtime?.turn, ""],
  ];
  return (
    <div className="space-y-6">
      {status.loading && !status.data ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, ok, detail]) => (
            <div key={label} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
              <StatusDot ok={ok} />
              <span className="min-w-0">
                {label}
                {detail ? <span className="block truncate text-xs text-muted">{detail}</span> : null}
              </span>
            </div>
          ))}
        </div>
      )}
      {((s.payments?.details ?? []) as Row[]).length ? (
        <Card>
          <CardHeader
            title="Prestataires de paiement"
            subtitle="Paiements réels uniquement : activez un prestataire via PAYMENT_PROVIDERS puis renseignez ses clés ci-dessous. Les environnements de test (MTN « sandbox », Orange « dev ») sont refusés en production."
          />
          <ul className="divide-y divide-line text-sm">
            {(s.payments.details as Row[]).map((d) => (
              <li key={d.provider} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span>
                  <span className="font-medium">{d.label}</span>
                  <span className="block text-xs text-muted">
                    {d.enabled ? "Activé" : "Non activé"} · {d.flow === "push" ? "validation sur le téléphone du payeur" : "page sécurisée de l'opérateur"}
                    {d.environment ? ` · environnement ${d.environment}` : ""}
                    {d.payouts ? ` · paiements sortants ${d.payouts_configured === false ? "non configurés" : "disponibles"}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <StatusDot ok={!!d.enabled && !!d.configured} />
                  {d.configured ? "Clés présentes" : "Clés manquantes"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Clés et secrets des prestataires" subtitle="Chiffrés au repos (AES-256-GCM), jamais réaffichés ; seule l'empreinte est visible. Saisie protégée par la double authentification." />
        <ul className="divide-y divide-line text-sm">
          {(secrets.data ?? []).map((x) => (
            <li key={x.name} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <span>
                {x.label ?? x.name} <span className="font-mono text-xs text-muted">{x.name}</span>
                <span className="block text-xs text-muted">{x.configured ? `${x.source === "vault" ? "Coffre" : "Variable d'environnement"}${x.fingerprint ? ` · empreinte ${x.fingerprint}` : ""}${x.version ? ` · v${x.version}` : ""}${x.rotated_at ? ` · renouvelé ${relative(x.rotated_at)}` : ""}` : "Non configuré"}</span>
              </span>
              <span className="flex items-center gap-2">
                <StatusDot ok={!!x.configured} />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSecret(x);
                    setSecretValue("");
                  }}
                >
                  <KeyRound className="h-4 w-4" /> {x.configured ? "Renouveler" : "Définir"}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Webhooks sortants" subtitle="Événements métier signés (HMAC-SHA256) vers vos outils (comptabilité, BI…)." actions={<Button size="sm" variant="secondary" onClick={() => setHook({ name: "", url: "https://", events: [], secret: "", is_active: true })}><Plus className="h-4 w-4" /> Webhook</Button>} />
        <ul className="divide-y divide-line text-sm">
          {(webhooks.data ?? []).map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <span className="min-w-0">
                <span className="font-medium">{w.name}</span> <span className="block truncate font-mono text-xs text-muted">{w.url}</span>
                <span className="block text-xs text-muted">{(w.events ?? []).join(", ")}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge status={w.is_active ? "active" : "inactive"} />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const d = await api<Row>(`/admin/webhooks/${w.id}/test`, { method: "POST" });
                      toast.success("Envoi de test", `Statut ${optionLabel(d.status)}${d.response_code ? ` · HTTP ${d.response_code}` : ""}`);
                    } catch (err) {
                      toast.error("Test impossible", errorMessage(err));
                    }
                  }}
                >
                  <Send className="h-4 w-4" /> Tester
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeliveriesOf(w)}>
                  Journal
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setHook({ ...w, secret: "" })}>
                  Modifier
                </Button>
              </span>
            </li>
          ))}
          {!webhooks.loading && !webhooks.data?.length ? <li className="px-5 py-4 text-muted">Aucun webhook.</li> : null}
        </ul>
      </Card>

      <Modal
        open={!!secret}
        onClose={() => setSecret(null)}
        title={`${secret?.configured ? "Renouveler" : "Définir"} — ${secret?.label ?? secret?.name ?? ""}`}
        footer={
          <Button
            disabled={secretValue.length < 4}
            onClick={async () => {
              try {
                await api(`/admin/secrets/${secret?.name}`, { method: "PUT", body: { value: secretValue } });
                setSecretValue("");
                setSecret(null);
                void secrets.reload();
                void status.reload();
                toast.success("Secret enregistré", "La valeur n'est plus jamais affichée.");
              } catch (err) {
                toast.error("Enregistrement impossible", errorMessage(err));
              }
            }}
          >
            Enregistrer
          </Button>
        }
      >
        <div className="space-y-3">
          <Alert tone="warning">La valeur est chiffrée immédiatement et l'opération est tracée (criticité maximale).</Alert>
          <Field label="Valeur">
            <Input type="password" autoComplete="off" value={secretValue} onChange={(e) => setSecretValue(e.target.value)} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={!!hook}
        onClose={() => setHook(null)}
        title={hook?.id ? `Webhook ${hook.name}` : "Nouveau webhook"}
        size="lg"
        footer={
          <Button
            disabled={!hook?.events?.length || (!hook?.id && ((hook?.secret ?? "").length < 16 || (hook?.name ?? "").length < 2))}
            onClick={async () => {
              if (!hook) return;
              try {
                if (hook.id) await api(`/admin/webhooks/${hook.id}`, { method: "PATCH", body: { events: hook.events, is_active: hook.is_active, ...(hook.secret ? { secret: hook.secret } : {}) } });
                else await api("/admin/webhooks", { method: "POST", body: { name: hook.name, url: hook.url, events: hook.events, secret: hook.secret, is_active: hook.is_active } });
                setHook(null);
                void webhooks.reload();
                toast.success("Webhook enregistré");
              } catch (err) {
                toast.error("Enregistrement impossible", errorMessage(err));
              }
            }}
          >
            Enregistrer
          </Button>
        }
      >
        {hook ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nom">
                <Input value={hook.name} onChange={(e) => setHook({ ...hook, name: e.target.value })} disabled={!!hook.id} />
              </Field>
              <Field label="URL (HTTPS)">
                <Input value={hook.url} onChange={(e) => setHook({ ...hook, url: e.target.value })} disabled={!!hook.id} />
              </Field>
              <Field label={hook.id ? "Nouveau secret de signature (facultatif)" : "Secret de signature (16 caractères min.)"} className="sm:col-span-2">
                <Input type="password" autoComplete="off" value={hook.secret} onChange={(e) => setHook({ ...hook, secret: e.target.value })} />
              </Field>
            </div>
            <Field label="Événements">
              <div className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
                {(events.data ?? []).map((ev) => (
                  <Checkbox key={ev.type} label={`${ev.label} (${ev.type})`} checked={(hook.events ?? []).includes(ev.type)} onChange={(c) => setHook({ ...hook, events: c ? [...(hook.events ?? []), ev.type] : (hook.events ?? []).filter((x: string) => x !== ev.type) })} />
                ))}
              </div>
            </Field>
            <Checkbox label="Actif" checked={!!hook.is_active} onChange={(c) => setHook({ ...hook, is_active: c })} />
          </div>
        ) : null}
      </Modal>
      <Modal open={!!deliveriesOf} onClose={() => setDeliveriesOf(null)} title={`Journal — ${deliveriesOf?.name ?? ""}`} size="lg">
        <ul className="divide-y divide-line text-sm">
          {(deliveries.data?.items ?? []).map((d) => (
            <li key={d.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                {dateTime(d.created_at)} · {d.event_type}
                {d.last_error ? <span className="block text-xs text-red-600">{d.last_error}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                {d.attempts > 1 ? <span className="text-xs text-muted">{d.attempts} tentatives</span> : null}
                {d.response_code ? <span className="text-xs text-muted">HTTP {d.response_code}</span> : null}
                <StatusBadge status={d.status} />
              </span>
            </li>
          ))}
          {!deliveries.loading && !deliveries.data?.items?.length ? <li className="py-3 text-muted">Aucun envoi.</li> : null}
        </ul>
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- maintenance */

export function MaintenanceAdmin() {
  const { can } = useAuth();
  const toast = useToast();
  const state = useApi<Row>("/admin/maintenance");
  const [message, setMessage] = useState("");
  const [until, setUntil] = useState("");
  const [confirm, setConfirm] = useState(false);
  const on = !!state.data?.enabled;
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-3">
        <ShieldAlert className={`h-6 w-6 ${on ? "text-red-600" : "text-muted"}`} />
        <div>
          <p className="font-semibold">{on ? "Maintenance en cours" : "Plateforme ouverte"}</p>
          {on ? (
            <p className="text-sm text-muted">
              {state.data?.message} {state.data?.until ? `· fin prévue ${dateTime(state.data.until)}` : ""} · depuis {dateTime(state.data?.since)}
            </p>
          ) : (
            <p className="text-sm text-muted">Pendant une maintenance, seuls les administrateurs accèdent à l'API ; les autres utilisateurs voient le message ci-dessous.</p>
          )}
        </div>
      </div>
      {can("maintenance:manage") ? (
        on ? (
          <Button
            onClick={async () => {
              await api("/admin/maintenance", { method: "PUT", body: { enabled: false } });
              void state.reload();
              toast.success("Plateforme rouverte");
            }}
          >
            Terminer la maintenance
          </Button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_14rem_auto]">
            <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message affiché aux utilisateurs" />
            <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="Fin prévue" />
            <Button variant="accent" disabled={message.length < 5} onClick={() => setConfirm(true)}>
              Activer
            </Button>
          </div>
        )
      ) : null}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Activer la maintenance"
        text="Les utilisateurs non administrateurs seront déconnectés de l'API jusqu'à la fin de la maintenance."
        tone="danger"
        onConfirm={async () => {
          await api("/admin/maintenance", { method: "PUT", body: { enabled: true, message, until: until ? new Date(until).toISOString() : null } });
          void state.reload();
        }}
      />
    </Card>
  );
}

export function SettingsHub() {
  const { can, canAny } = useAuth();
  const [tab, setTab] = useState("parametres");
  return (
    <div className="space-y-5">
      <PageTitle
        title="Paramètres"
        subtitle="Paramètres applicatifs, fonctionnalités, notifications, intégrations, maintenance."
        actions={
          can("settings:read") ? (
            <Link href="/erp/parametres/systeme" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
              <Database className="h-4 w-4" /> Système et sauvegardes
            </Link>
          ) : null
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "parametres", label: "Paramètres", hidden: !can("settings:read") },
          { key: "fonctionnalites", label: "Fonctionnalités", hidden: !can("settings:read") },
          { key: "notifications", label: "Notifications", hidden: !can("notifications:manage") },
          { key: "integrations", label: "Intégrations", hidden: !can("integrations:manage") },
          { key: "maintenance", label: "Maintenance", hidden: !canAny("settings:read", "maintenance:manage") },
        ]}
      />
      {tab === "parametres" ? <GeneralSettings /> : null}
      {tab === "fonctionnalites" ? <FeatureFlags /> : null}
      {tab === "notifications" ? <NotificationsAdmin /> : null}
      {tab === "integrations" ? <IntegrationsAdmin /> : null}
      {tab === "maintenance" ? <MaintenanceAdmin /> : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------- système et sauvegardes */

// Libellés propres aux sauvegardes (« full » signifie ailleurs « Pleine largeur »).
const BACKUP_KINDS: Record<string, string> = { full: "Complète", database: "Base de données", files: "Fichiers", pre_destructive: "Sauvegarde de sécurité" };
const BACKUP_TRIGGERS: Record<string, string> = { manual: "Manuelle", schedule: "Planifiée", pre_destructive: "Avant restauration", reset: "Avant remise à zéro" };

/** Remise à zéro des données d'exploitation (avant la mise en service ou après une recette) : sauvegarde complète
 * préalable, comptes / projets / données métier supprimés, site, CMS, médiathèque, paramètres et intégrations conservés. */
function ResetPlatformCard() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const preview = useApi<Row>(open ? "/admin/reset/preview" : null);
  const [form, setForm] = useState({ email: "contact@globus-engineering-sarl.com", first_name: "GLOBUS", last_name: "ENGINEERING", justification: "", code: "", confirmation: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Row | null>(null);
  const expected = preview.data?.confirmation ?? "REMETTRE A ZERO";
  const ready = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && !!form.first_name.trim() && !!form.last_name.trim() && form.justification.trim().length >= 20 && form.code.length >= 6 && form.confirmation === expected;
  return (
    <Card className="border-red-200">
      <CardHeader
        title="Remise à zéro des données d'exploitation"
        subtitle="Avant la mise en service ou après une recette : supprime tous les comptes, projets et données métier ; conserve le site, le CMS, la médiathèque, les paramètres et les intégrations. Une sauvegarde complète est faite juste avant."
        actions={
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            <Eraser className="h-4 w-4" /> Préparer la remise à zéro
          </Button>
        }
      />
      <Modal
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title="Remise à zéro des données d'exploitation"
        size="lg"
        footer={
          done ? (
            <Button
              onClick={() => {
                window.location.href = "/connexion";
              }}
            >
              Aller à la connexion
            </Button>
          ) : (
            <Button
              variant="accent"
              loading={busy}
              disabled={!ready}
              onClick={async () => {
                setBusy(true);
                try {
                  const grant = await api<Row>("/admin/break-glass", { method: "POST", body: { scope: "purge", justification: form.justification.trim(), code: form.code } });
                  const res = await api<Row>("/admin/reset", { method: "POST", body: { break_glass_id: grant.id, confirmation: form.confirmation, admin_email: form.email.trim(), admin_first_name: form.first_name.trim(), admin_last_name: form.last_name.trim() } });
                  setDone(res);
                } catch (err) {
                  toast.error("Remise à zéro refusée", errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Eraser className="h-4 w-4" /> Remettre à zéro
            </Button>
          )
        }
      >
        {done ? (
          <div className="space-y-3">
            <Alert tone="success" title="Remise à zéro effectuée">
              {number(done.deleted_rows)} enregistrements supprimés. Une sauvegarde complète de l&apos;état précédent a été faite juste avant. Une invitation a été envoyée à <strong>{done.admin_email}</strong> : ouvrez-la pour choisir le mot de passe du nouvel administrateur, puis activez sa double authentification.
            </Alert>
            <p className="text-sm text-muted">Votre compte a été supprimé avec les autres : vous allez être déconnecté.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert tone="danger" title="Opération irréversible sur la production">
              Tous les comptes (y compris le vôtre), projets, clients, devis, factures, paiements, achats, stocks, sous-traitants, données RH et QHSE, documents, messages et notifications sont définitivement supprimés, ainsi que les envois de formulaires, commentaires, abonnés et statistiques du site. Le journal d&apos;audit et la numérotation repartent de zéro.
            </Alert>
            {preview.loading && !preview.data ? (
              <Skeleton className="h-32" />
            ) : preview.data ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-red-700">Sera supprimé</p>
                  <ul className="space-y-0.5 text-sm">
                    {(preview.data.deleted as Row[]).map((g) => (
                      <li key={g.label} className="flex justify-between gap-2">
                        <span>{g.label}</span>
                        <span className="font-semibold">{number(g.count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">Sera conservé</p>
                  <ul className="space-y-0.5 text-sm">
                    {(preview.data.kept as Row[]).map((g) => (
                      <li key={g.label} className="flex justify-between gap-2">
                        <span>{g.label}</span>
                        <span className="font-semibold">{number(g.count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            <Field label="E-mail du nouvel administrateur" help="Il recevra une invitation pour choisir son mot de passe ; la double authentification lui sera demandée.">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom de l'administrateur" required>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} autoComplete="off" />
              </Field>
              <Field label="Nom de l'administrateur" required>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} autoComplete="off" />
              </Field>
            </div>
            <Field label="Justification (20 caractères minimum)">
              <Textarea value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} rows={2} placeholder="Base propre avant la recette / avant la mise en service" />
            </Field>
            <Field label="Votre code MFA">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.trim() })} inputMode="numeric" autoComplete="one-time-code" />
            </Field>
            <Field label={`Tapez ${expected} pour confirmer`}>
              <Input value={form.confirmation} onChange={(e) => setForm({ ...form, confirmation: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </Card>
  );
}

export function SystemAdmin() {
  const { can, canAny, hasRole } = useAuth();
  const toast = useToast();
  const system = useApi<Row>("/admin/system");
  const jobs = useApi<Row[]>("/admin/jobs");
  const backups = useList<Row>(canAny("backups:run") ? "/admin/backups" : null, { pageSize: 20 });
  const conflicts = useApi<Row[]>("/sync/conflicts");
  const [kind, setKind] = useState("full");
  const [restore, setRestore] = useState<Row | null>(null);
  const [glass, setGlass] = useState({ justification: "", code: "", confirmation: "" });
  const s = system.data;
  return (
    <div className="space-y-6">
      <PageTitle title="Système" subtitle="État de la plateforme, tâches planifiées, sauvegardes chiffrées et restaurations contrôlées." />
      {s ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Environnement" value={optionLabel(s.environment)} hint={`Version ${s.version}`} tone="info" />
          <Stat label="Base de données" value={fileSize(s.database_size_bytes)} />
          <Stat label="Événements en attente" value={number(s.outbox_pending)} tone={s.outbox_pending > 100 ? "warning" : "neutral"} />
          <Stat label="Événements en échec" value={number(s.outbox_failed)} tone={s.outbox_failed ? "danger" : "success"} />
          <Stat label="Dernière sauvegarde" value={s.last_backup ? relative(s.last_backup.at) : "Aucune"} hint={s.last_backup ? `${BACKUP_KINDS[s.last_backup.kind] ?? optionLabel(s.last_backup.kind)} · ${fileSize(s.last_backup.size)}` : undefined} tone={s.last_backup ? "success" : "danger"} />
        </div>
      ) : (
        <Skeleton className="h-24" />
      )}
      <Card>
        <CardHeader title="Tâches planifiées" />
        <ul className="divide-y divide-line text-sm">
          {(jobs.data ?? []).map((j) => (
            <li key={j.name} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <span>
                <span className="font-mono text-xs font-semibold">{j.name}</span>
                <span className="block text-xs text-muted">
                  {j.description} · {j.every_seconds ? `toutes les ${Math.round(j.every_seconds / 60)} min` : j.daily_at ? `chaque jour à ${j.daily_at}${j.weekday !== null && j.weekday !== undefined ? ` (jour ${j.weekday})` : ""}` : ""}
                </span>
                {j.last_run ? (
                  <span className="block text-xs text-muted">
                    Dernière exécution {relative(j.last_run.started_at)} · <StatusBadge status={j.last_run.status} />
                    {j.last_run.error ? <span className="text-red-600"> {j.last_run.error}</span> : null}
                  </span>
                ) : null}
              </span>
              {can("maintenance:manage") ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const res = await api<Row>(`/admin/jobs/${j.name}/run`, { method: "POST" });
                      toast.success(`Tâche ${j.name} exécutée`, JSON.stringify(res).slice(0, 140));
                      void jobs.reload();
                    } catch (err) {
                      toast.error("Exécution impossible", errorMessage(err));
                    }
                  }}
                >
                  <Play className="h-4 w-4" /> Lancer
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
      {canAny("backups:run") ? (
        <Card>
          <CardHeader
            title="Sauvegardes"
            subtitle="Chiffrées, signées, copiées hors site ; vérification d'intégrité et restauration de contrôle dans une base isolée."
            actions={
              <div className="flex gap-2">
                <Select value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "full", label: "Complète" }, { value: "database", label: "Base de données" }, { value: "files", label: "Fichiers" }]} aria-label="Type" />
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await api("/admin/backups", { method: "POST", body: { kind } });
                      toast.success("Sauvegarde demandée", "Elle s'exécute en arrière-plan.");
                      void backups.reload();
                    } catch (err) {
                      toast.error("Demande impossible", errorMessage(err));
                    }
                  }}
                >
                  Sauvegarder maintenant
                </Button>
              </div>
            }
          />
          <ul className="divide-y divide-line text-sm">
            {backups.items.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span>
                  {BACKUP_KINDS[b.kind] ?? optionLabel(b.kind)} · {dateTime(b.created_at)} · {BACKUP_TRIGGERS[b.trigger] ?? optionLabel(b.trigger)}
                  <span className="block text-xs text-muted">
                    {b.size_bytes ? fileSize(b.size_bytes) : ""} {b.encrypted ? "· chiffrée" : ""} {b.remote_copy_status ? `· copie distante ${optionLabel(b.remote_copy_status)}` : ""} {b.checksum ? `· ${String(b.checksum).slice(0, 12)}…` : ""}
                  </span>
                  {b.error ? <span className="block text-xs text-red-600">{b.error}</span> : null}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={b.status} />
                  {b.status === "success" && ["database", "full", "files", "pre_destructive"].includes(b.kind) ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            const r = await api<Row>(`/admin/backups/${b.id}/verify`, { method: "POST" });
                            if (r.ok) toast.success("Sauvegarde intègre", `Empreinte ${String(r.checksum ?? "").slice(0, 16)}… · signature valide`);
                            else toast.error("Sauvegarde non conforme", r.reason);
                          } catch (err) {
                            toast.error("Vérification impossible", errorMessage(err));
                          }
                        }}
                      >
                        Vérifier
                      </Button>
                      {can("backups:restore") ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await api(`/admin/backups/${b.id}/restore-test`, { method: "POST" });
                                toast.success("Restauration de contrôle lancée", "Dans une base isolée, sans impact sur la production.");
                                void backups.reload();
                              } catch (err) {
                                toast.error("Lancement impossible", errorMessage(err));
                              }
                            }}
                          >
                            <RotateCcw className="h-4 w-4" /> Test de restauration
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRestore(b)}>
                            Restaurer
                          </Button>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </span>
              </li>
            ))}
            {!backups.loading && !backups.items.length ? <li className="px-5 py-4 text-muted">Aucune sauvegarde.</li> : null}
          </ul>
        </Card>
      ) : null}
      {can("backups:restore") && hasRole("ADMIN") ? <ResetPlatformCard /> : null}
      {conflicts.data?.length ? (
        <Card>
          <CardHeader title="Mes conflits de synchronisation (hors ligne)" />
          <ul className="divide-y divide-line text-sm">
            {conflicts.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span>
                  {optionLabel(c.entity)} · {optionLabel(c.operation)} · reçu {dateTime(c.received_at)}
                  {(c.conflict?.fields ?? []).length ? <span className="block text-xs text-muted">Champs en conflit : {(c.conflict.fields as string[]).join(", ")}</span> : null}
                </span>
                <span className="flex gap-2">
                  {(["server_wins", "client_wins"] as const).map((res) => (
                    <Button
                      key={res}
                      size="sm"
                      variant={res === "server_wins" ? "secondary" : "ghost"}
                      onClick={async () => {
                        try {
                          await api(`/sync/conflicts/${c.id}/resolve`, { method: "POST", body: { resolution: res } });
                          void conflicts.reload();
                        } catch (err) {
                          toast.error("Résolution impossible", errorMessage(err));
                        }
                      }}
                    >
                      {res === "server_wins" ? "Garder la version serveur" : "Garder ma version"}
                    </Button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Modal
        open={!!restore}
        onClose={() => setRestore(null)}
        title="Restauration de production"
        footer={
          <Button
            variant="accent"
            disabled={glass.justification.trim().length < 20 || glass.code.length < 6 || glass.confirmation !== "RESTAURER"}
            onClick={async () => {
              try {
                const grant = await api<Row>("/admin/break-glass", { method: "POST", body: { scope: "restore", justification: glass.justification.trim(), code: glass.code } });
                await api(`/admin/backups/${restore?.id}/restore`, { method: "POST", body: { break_glass_id: grant.id, confirmation: glass.confirmation } });
                toast.success("Restauration programmée", "Une sauvegarde de sécurité est prise juste avant ; la direction est alertée.");
                setRestore(null);
                setGlass({ justification: "", code: "", confirmation: "" });
                void backups.reload();
              } catch (err) {
                toast.error("Restauration refusée", errorMessage(err));
              }
            }}
          >
            Restaurer
          </Button>
        }
      >
        <div className="space-y-3">
          <Alert tone="danger" title="Opération irréversible sur la production">
            Les données saisies depuis le {dateTime(restore?.created_at)} seront perdues. Accès d'urgence : justification, code MFA et confirmation écrite.
          </Alert>
          <Field label="Justification (20 caractères minimum)">
            <Textarea value={glass.justification} onChange={(e) => setGlass({ ...glass, justification: e.target.value })} rows={3} />
          </Field>
          <Field label="Votre code MFA">
            <Input value={glass.code} onChange={(e) => setGlass({ ...glass, code: e.target.value.trim() })} inputMode="numeric" autoComplete="one-time-code" />
          </Field>
          <Field label="Tapez RESTAURER pour confirmer">
            <Input value={glass.confirmation} onChange={(e) => setGlass({ ...glass, confirmation: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
