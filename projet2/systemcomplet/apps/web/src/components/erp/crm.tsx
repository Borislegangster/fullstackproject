"use client";

import { Check, Copy, Download, FileSignature, Mail, MessageCircle, Phone, Plus, Send, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { InstantEstimatePanel } from "@/components/erp/instant-estimate-panel";
import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { RolePicker } from "@/components/cms/form-editor";
import { MultiRefSelect, RefSelect } from "@/components/forms/ref-select";
import { SchemaForm, type FieldConfig } from "@/components/forms/schema-form";
import { CheckGroup, RowsEditor } from "@/components/forms/structured-fields";
import { BarChartCard, DonutChart } from "@/components/ui/charts";
import { Checkbox, Field, FileDrop, Input, Select, TagInput, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, PageTitle, Progress, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number, relative, toNumber } from "@/lib/format";
import { useApi, useList } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

const UNIVERSES = ["HOME", "BUSINESS", "PREMIUM", "DIASPORA", "ENGINEERING"];
const LEAD_STATUSES = ["new", "contacted", "qualified", "nurturing", "unqualified", "lost", "converted"];
const LEAD_SOURCES = ["website", "describe_project", "estimator", "phone", "whatsapp", "email", "salon", "referral", "walk_in", "chatbot", "social", "other"];
const STAGES = ["qualification", "discovery", "proposal", "negotiation", "won", "lost"];
const QUOTE_STATUSES = ["draft", "sent", "viewed", "accepted", "rejected", "expired", "superseded"];
const ACTIVITY_KINDS = ["call", "email", "meeting", "whatsapp", "sms", "note", "visit", "task", "follow_up"];
const opts = (values: string[]) => values.map((v) => ({ value: v, label: optionLabel(v) }));

function TemperatureBadge({ temperature, score }: { temperature?: string; score?: number }) {
  const tone = temperature === "hot" ? "danger" : temperature === "warm" ? "accent" : "info";
  return (
    <Badge tone={tone}>
      {optionLabel(temperature)} · {score ?? 0}
    </Badge>
  );
}

function SlaCell({ due, responded }: { due?: string | null; responded?: string | null }) {
  if (responded) return <span className="text-xs text-emerald-700">Répondu {relative(responded)}</span>;
  if (!due) return <span className="text-muted">—</span>;
  const late = new Date(due).getTime() < Date.now();
  return <span className={`text-xs font-semibold ${late ? "text-red-600" : "text-amber-700"}`}>{late ? `SLA dépassé ${relative(due)}` : `Répondre ${relative(due)}`}</span>;
}

/* ----------------------------------------------------------------------------- tableau de bord */

export function CrmDashboard() {
  const [range, setRange] = useState({ start: "", end: "" });
  const funnel = useApi<Row>("/crm/funnel", { start: range.start || undefined, end: range.end || undefined });
  const f = funnel.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Du">
          <Input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
        </Field>
        <Field label="Au">
          <Input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
        </Field>
      </div>
      {funnel.loading && !f ? (
        <Skeleton className="h-64" />
      ) : funnel.error ? (
        <Alert tone="danger">{funnel.error}</Alert>
      ) : f ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Leads" value={number(f.leads)} hint={`${number(f.converted)} converti(s)`} tone="info" />
            <Stat label="Devis envoyés" value={number(f.quotes_sent)} hint={`${number(f.lead_to_quote_rate, 1)} % des leads`} />
            <Stat label="Devis acceptés" value={number(f.quotes_accepted)} hint={`Acceptation ${number(f.quote_acceptance_rate, 1)} %`} tone="success" />
            <Stat label="Contrats signés" value={number(f.contracts_signed)} hint={`Lead → contrat ${number(f.lead_to_contract_rate, 1)} %`} tone="accent" />
            <Stat label="Respect SLA" value={f.sla_respect_rate !== null && f.sla_respect_rate !== undefined ? `${number(f.sla_respect_rate, 1)} %` : "—"} hint={f.avg_quote_cycle_days ? `Cycle devis ${number(f.avg_quote_cycle_days, 1)} j` : undefined} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Pipeline des opportunités" />
              <div className="p-4">
                <BarChartCard
                  data={((f.pipeline ?? []) as Row[]).map((p) => ({ stage: optionLabel(p.stage), count: toNumber(p.count), amount: toNumber(p.amount) }))}
                  x="stage"
                  series={[{ key: "amount", label: "Montant estimé" }]}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Leads par source" />
              <div className="p-4">
                <DonutChart data={((f.by_source ?? []) as Row[]).map((s) => ({ name: optionLabel(s.source), value: toNumber(s.count) }))} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Leads par univers" />
              <div className="p-4">
                <BarChartCard data={((f.by_universe ?? []) as Row[]).map((u) => ({ universe: optionLabel(u.universe ?? "—"), count: toNumber(u.count) }))} x="universe" series={[{ key: "count", label: "Leads" }]} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Leads par statut" />
              <div className="p-4">
                <DonutChart data={((f.by_status ?? []) as Row[]).map((s) => ({ name: optionLabel(s.status), value: toNumber(s.count) }))} />
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------- leads */

function LeadCreate({ onDone, onCancel }: { onDone: (lead: Row) => void; onCancel: () => void }) {
  const [v, setV] = useState<Record<string, any>>({ source: "phone", urgency: "normal", universe: "", country: "Cameroun", marketing_consent: false, whatsapp_consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, value: unknown) => setV((all) => ({ ...all, [k]: value }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" required>
          <Input value={v.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} />
        </Field>
        <Field label="Nom">
          <Input value={v.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} />
        </Field>
        <Field label="Entreprise">
          <Input value={v.company ?? ""} onChange={(e) => set("company", e.target.value)} />
        </Field>
        <Field label="Origine du contact" required>
          <Select value={v.source} onChange={(e) => set("source", e.target.value)} options={opts(LEAD_SOURCES)} />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={v.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Téléphone">
          <Input type="tel" value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+237…" />
        </Field>
        <Field label="WhatsApp">
          <Input type="tel" value={v.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} />
        </Field>
        <Field label="Ville">
          <Input value={v.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Pays de résidence" help="Hors Cameroun : le lead est marqué « diaspora ».">
          <Input value={v.country ?? ""} onChange={(e) => set("country", e.target.value)} />
        </Field>
        <Field label="Univers">
          <Select value={v.universe} onChange={(e) => set("universe", e.target.value)} options={[{ value: "", label: "Non précisé" }, ...opts(UNIVERSES)]} />
        </Field>
        <Field label="Type de projet">
          <Input value={v.project_type ?? ""} onChange={(e) => set("project_type", e.target.value)} placeholder="Villa, immeuble R+4, rénovation…" />
        </Field>
        <Field label="Localisation du projet">
          <Input value={v.project_location ?? ""} onChange={(e) => set("project_location", e.target.value)} />
        </Field>
        <Field label="Budget minimum (FCFA)">
          <Input type="number" min={0} value={v.budget_min ?? ""} onChange={(e) => set("budget_min", e.target.value)} />
        </Field>
        <Field label="Budget maximum (FCFA)">
          <Input type="number" min={0} value={v.budget_max ?? ""} onChange={(e) => set("budget_max", e.target.value)} />
        </Field>
        <Field label="Échéance">
          <Select value={v.timeline ?? ""} onChange={(e) => set("timeline", e.target.value)} options={[{ value: "", label: "Non précisée" }, ...opts(["immediate", "3_months", "6_months", "12_months", "undetermined"])]} />
        </Field>
        <Field label="Urgence">
          <Select value={v.urgency} onChange={(e) => set("urgency", e.target.value)} options={opts(["normal", "urgent"])} />
        </Field>
        <Field label="Besoin exprimé" className="sm:col-span-2">
          <Textarea value={v.message ?? ""} onChange={(e) => set("message", e.target.value)} rows={3} />
        </Field>
      </div>
      <div className="space-y-2 rounded-xl bg-surface p-3 text-sm">
        <p className="text-xs text-muted">Le consentement au recontact est attesté par le commercial (saisie manuelle tracée).</p>
        <Checkbox label="Accepte de recevoir nos actualités (newsletter)" checked={!!v.marketing_consent} onChange={(c) => set("marketing_consent", c)} />
        <Checkbox label="Accepte d'être contacté sur WhatsApp" checked={!!v.whatsapp_consent} onChange={(c) => set("whatsapp_consent", c)} />
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={!v.first_name || !(v.email || v.phone || v.whatsapp)}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const body = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "" && x !== undefined));
              onDone(await api<Row>("/crm/leads", { method: "POST", body }));
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer le lead
        </Button>
      </div>
    </div>
  );
}

export function LeadsList() {
  const { can } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [mine, setMine] = useState(false);
  const [overdue, setOverdue] = useState(false);
  return (
    <>
      <ResourceView
        embedded
        config={{
          title: "Leads",
          subtitle: "Affectation automatique, SLA de première réponse, score et température, attribution marketing.",
          path: "/crm/leads",
          query: { mine: mine || undefined, overdue: overdue || undefined },
          href: (r) => `/erp/crm/leads/${r.id}`,
          exportDataset: "leads",
          columns: [
            { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/crm/leads/${r.id}`}>{r.number}</CellLink> },
            { key: "name", label: "Contact", render: (r) => (
              <span>
                {r.name}
                {r.company ? <span className="block text-xs text-muted">{r.company}</span> : null}
              </span>
            ) },
            { key: "universe", label: "Univers", format: "option", hideOnMobile: true },
            { key: "source", label: "Source", format: "option", hideOnMobile: true },
            { key: "score", label: "Score", sortable: true, render: (r) => <TemperatureBadge temperature={r.temperature} score={r.score} /> },
            { key: "response_due_at", label: "SLA", sortable: true, render: (r) => <SlaCell due={r.response_due_at} responded={r.first_response_at} /> },
            { key: "created_at", label: "Reçu", format: "datetime", sortable: true, hideOnMobile: true },
            { key: "status", label: "Statut", format: "status" },
          ],
          filters: [
            { key: "status", label: "Statut", options: opts(LEAD_STATUSES) },
            { key: "universe", label: "Univers", options: opts(UNIVERSES) },
            { key: "source", label: "Source", options: opts(LEAD_SOURCES) },
            { key: "temperature", label: "Température", options: opts(["hot", "warm", "cold"]) },
          ],
          toolbar: (
            <div className="flex flex-wrap items-center gap-3">
              <Checkbox label="Mes leads" checked={mine} onChange={setMine} />
              <Checkbox label="SLA dépassé" checked={overdue} onChange={setOverdue} />
              {can("crm:write") ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> Nouveau lead
                </Button>
              ) : null}
            </div>
          ),
        }}
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="Saisie d'un lead" size="xl">
        <LeadCreate onCancel={() => setCreating(false)} onDone={(l) => router.push(`/erp/crm/leads/${l.id}`)} />
      </Modal>
    </>
  );
}

function ActivityTimeline({ activities, onChanged, fixed }: { activities: Row[]; onChanged: () => void; fixed: Row }) {
  const { can } = useAuth();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  return (
    <Card>
      <CardHeader
        title="Activités"
        subtitle="Appels, e-mails, WhatsApp, rendez-vous, relances : la première activité arrête le chronomètre SLA."
        actions={
          can("crm:write") ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Activité
            </Button>
          ) : null
        }
      />
      <ol className="space-y-3 p-5">
        {activities.map((a) => (
          <li key={a.id} className="flex gap-3">
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${a.status === "done" ? "bg-emerald-500" : "bg-accent-500"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <strong>{optionLabel(a.kind)}</strong> · {a.subject}
                {a.direction ? <span className="text-muted"> ({a.direction === "in" ? "entrant" : "sortant"})</span> : null}
              </p>
              <p className="text-xs text-muted">
                {dateTime(a.created_at)}
                {a.due_at ? ` · échéance ${dateTime(a.due_at)}` : ""}
                {a.outcome ? ` · résultat : ${a.outcome}` : ""}
              </p>
              {a.body ? <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p> : null}
            </div>
            {a.status !== "done" && can("crm:write") ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await api(`/crm/activities/${a.id}/done`, { method: "POST", body: {} });
                    onChanged();
                  } catch (err) {
                    toast.error("Action impossible", errorMessage(err));
                  }
                }}
              >
                <Check className="h-4 w-4" /> Fait
              </Button>
            ) : null}
          </li>
        ))}
        {!activities.length ? <li className="text-sm text-muted">Aucune activité.</li> : null}
      </ol>
      <Modal open={adding} onClose={() => setAdding(false)} title="Nouvelle activité">
        <SchemaForm
          endpoint="POST /crm/activities"
          fixed={fixed}
          exclude={["lead_id", "contact_id", "opportunity_id"]}
          initial={{ kind: "call", direction: "out" }}
          fields={{ kind: { options: opts(ACTIVITY_KINDS) }, direction: { options: [{ value: "out", label: "Sortant" }, { value: "in", label: "Entrant" }] }, body: { widget: "textarea" } }}
          onCancel={() => setAdding(false)}
          onSuccess={() => {
            setAdding(false);
            onChanged();
          }}
          columns={1}
        />
      </Modal>
    </Card>
  );
}

export function LeadDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const lead = useApi<Row>(`/crm/leads/${id}`);
  const [dialog, setDialog] = useState<null | "status" | "assign" | "convert" | "edit">(null);
  const [converted, setConverted] = useState<Row | null>(null);
  if (lead.loading && !lead.data) return <Skeleton className="h-96 w-full" />;
  if (!lead.data) return <Alert tone="danger">{lead.error}</Alert>;
  const l = lead.data;
  const brief = l.brief as Row | null;
  const phone = (l.whatsapp || l.phone || "").replace(/[^\d]/g, "");
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/crm?onglet=leads" className="hover:underline">Leads</Link>}
        title={`${l.name}${l.company ? ` — ${l.company}` : ""}`}
        subtitle={`${l.number} · ${optionLabel(l.source)} · reçu ${dateTime(l.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TemperatureBadge temperature={l.temperature} score={l.score} />
            <StatusBadge status={l.status} />
            {l.phone ? (
              <a href={`tel:${l.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                <Phone className="h-3.5 w-3.5" /> Appeler
              </a>
            ) : null}
            {phone && (l.whatsapp_consent || l.whatsapp) ? (
              <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            ) : null}
            {l.email ? (
              <a href={`mailto:${l.email}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                <Mail className="h-3.5 w-3.5" /> E-mail
              </a>
            ) : null}
            {can("crm:write") ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setDialog("edit")}>
                  Qualifier
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("status")}>
                  Statut
                </Button>
              </>
            ) : null}
            {can("crm:assign") ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("assign")}>
                <UserPlus className="h-4 w-4" /> Affecter
              </Button>
            ) : null}
            {can("crm:write") && l.status !== "converted" ? (
              <Button size="sm" onClick={() => setDialog("convert")}>
                Convertir en opportunité
              </Button>
            ) : null}
          </div>
        }
      />
      {converted ? (
        <Alert tone="success" title={`Opportunité ${converted.opportunity_number} créée`}>
          Le contact et l'organisation ont été rattachés. <Link href="/erp/crm?onglet=opportunites" className="font-semibold underline">Voir le pipeline</Link>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Première réponse" value={l.first_response_at ? relative(l.first_response_at) : "En attente"} hint={l.response_due_at ? `Échéance SLA ${dateTime(l.response_due_at)}` : undefined} tone={!l.first_response_at && l.response_due_at && new Date(l.response_due_at).getTime() < Date.now() ? "danger" : "neutral"} />
        <Stat label="Budget" value={l.budget_min || l.budget_max ? `${money(l.budget_min ?? 0, l.budget_currency === "XAF" ? "FCFA" : l.budget_currency)} → ${money(l.budget_max ?? 0, l.budget_currency === "XAF" ? "FCFA" : l.budget_currency)}` : "—"} hint={optionLabel(l.timeline)} />
        <Stat label="Univers" value={optionLabel(l.universe)} hint={l.project_type ?? undefined} />
        <Stat label="Escalade" value={l.escalation_level ?? 0} hint={l.escalated_at ? dateTime(l.escalated_at) : "Aucune"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <DescriptionList
              columns={2}
              items={[
                { label: "E-mail", value: l.email },
                { label: "Téléphone / WhatsApp", value: [l.phone, l.whatsapp].filter(Boolean).join(" · ") },
                { label: "Ville / pays", value: [l.city, l.country].filter(Boolean).join(", ") },
                { label: "Diaspora", value: l.is_diaspora ? "Oui" : "Non" },
                { label: "Canal préféré", value: optionLabel(l.preferred_channel) },
                { label: "Localisation du projet", value: l.project_location },
                { label: "Terrain", value: l.has_land === null || l.has_land === undefined ? "—" : l.has_land ? `Oui (${optionLabel(l.land_status)})` : "Non" },
                { label: "Urgence", value: optionLabel(l.urgency) },
              ]}
            />
            {l.message ? <p className="mt-4 whitespace-pre-line rounded-xl bg-surface p-3 text-sm">{l.message}</p> : null}
            {l.lost_reason ? <Alert tone="danger" title="Motif de perte">{l.lost_reason}</Alert> : null}
          </Card>
          {brief ? (
            <Card>
              <CardHeader title="Dossier « Décrire mon projet »" subtitle={`Complétude ${brief.completeness ?? 0} % · soumis ${dateTime(brief.submitted_at)}`} />
              <div className="space-y-3 p-5">
                <Progress value={toNumber(brief.completeness)} />
                <DescriptionList
                  columns={3}
                  items={[
                    { label: "Surface", value: brief.surface_m2 ? `${number(brief.surface_m2)} m²` : "—" },
                    { label: "Niveaux", value: brief.levels ?? "—" },
                    { label: "Style", value: brief.style },
                    { label: "Estimation", value: brief.estimate_min ? `${money(brief.estimate_min)} → ${money(brief.estimate_max)}` : "—" },
                  ]}
                />
                {brief.answers && typeof brief.answers === "object" ? (
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    {Object.entries(brief.answers as Record<string, unknown>).filter(([k]) => k !== "instant_estimate").map(([k, val]) => (
                      <div key={k} className="rounded-lg bg-surface px-3 py-2">
                        <dt className="text-xs text-muted">{optionLabel(k)}</dt>
                        <dd>{Array.isArray(val) ? val.map((x) => optionLabel(x)).join(", ") : typeof val === "boolean" ? (val ? "Oui" : "Non") : optionLabel(val)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </Card>
          ) : null}
          {brief?.answers && typeof brief.answers === "object" && "instant_estimate" in (brief.answers as Record<string, unknown>) ? <InstantEstimatePanel leadId={id} /> : null}
          <ActivityTimeline activities={(l.activities ?? []) as Row[]} fixed={{ lead_id: id }} onChanged={() => void lead.reload()} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Score" subtitle="Règles de scoring (budget, urgence, complétude, univers…)." />
            <ul className="space-y-1 p-5 text-sm">
              {Object.entries((l.score_details ?? {}) as Record<string, unknown>).map(([k, val]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span>{optionLabel(k)}</span>
                  <span className="font-semibold tabular-nums">{String(val)}</span>
                </li>
              ))}
              {!Object.keys(l.score_details ?? {}).length ? <li className="text-muted">Aucun détail.</li> : null}
            </ul>
          </Card>
          {l.ai_summary ? (
            <Card className="p-5">
              <p className="mb-2 text-xs font-semibold uppercase text-muted">Synthèse IA (à vérifier)</p>
              <p className="whitespace-pre-line text-sm">{l.ai_summary}</p>
            </Card>
          ) : null}
          <Card className="p-5">
            <p className="mb-2 text-xs font-semibold uppercase text-muted">Attribution</p>
            <DescriptionList
              columns={1}
              items={[
                { label: "Source / formulaire", value: [optionLabel(l.source), l.form_key].filter(Boolean).join(" · ") },
                { label: "Campagne", value: [l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ") || "—" },
                { label: "Page d'entrée", value: l.landing_page },
                { label: "Référent", value: l.referrer },
                { label: "Offre / service", value: [l.offer_slug, l.service_slug].filter(Boolean).join(" · ") || "—" },
              ]}
            />
          </Card>
          <Card className="p-5">
            <p className="mb-2 text-xs font-semibold uppercase text-muted">Consentements</p>
            <ul className="space-y-1 text-sm">
              <li>Recontact : {l.consent_record_id ? "attesté (preuve horodatée)" : "attesté par le commercial"}</li>
              <li>Newsletter : {l.marketing_consent ? "oui" : "non"}</li>
              <li>WhatsApp : {l.whatsapp_consent ? "oui" : "non"}</li>
            </ul>
          </Card>
        </div>
      </div>

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Qualification du lead" size="lg">
        <SchemaForm
          endpoint="PATCH /crm/leads/{lead_id}"
          params={{ lead_id: id }}
          initial={l}
          partial
          exclude={["status", "lost_reason", "assigned_to_id"]}
          fields={{ universe: { options: opts(UNIVERSES) }, timeline: { options: opts(["immediate", "3_months", "6_months", "12_months", "undetermined"]) }, urgency: { options: opts(["normal", "urgent"]) } }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            void lead.reload();
          }}
        />
      </Modal>
      <Modal open={dialog === "status"} onClose={() => setDialog(null)} title="Statut du lead">
        <SchemaForm
          endpoint="PATCH /crm/leads/{lead_id}"
          params={{ lead_id: id }}
          only={["status", "lost_reason"]}
          initial={{ status: l.status === "converted" ? "qualified" : l.status }}
          fields={{ status: { options: opts(LEAD_STATUSES.filter((s) => s !== "converted")) }, lost_reason: { widget: "textarea", help: "Obligatoire si le lead est perdu." } }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            void lead.reload();
          }}
          columns={1}
        />
      </Modal>
      <Modal open={dialog === "assign"} onClose={() => setDialog(null)} title="Affecter le lead">
        <SchemaForm
          endpoint="PATCH /crm/leads/{lead_id}"
          params={{ lead_id: id }}
          only={["assigned_to_id"]}
          initial={{ assigned_to_id: l.assigned_to_id }}
          fields={{ assigned_to_id: { ref: "users", label: "Commercial" } }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            toast.success("Lead affecté", "Le commercial est notifié avec l'échéance SLA.");
            void lead.reload();
          }}
          columns={1}
        />
      </Modal>
      <Modal open={dialog === "convert"} onClose={() => setDialog(null)} title="Convertir en opportunité">
        <SchemaForm
          endpoint="POST /crm/leads/{lead_id}/convert"
          params={{ lead_id: id }}
          initial={{ title: `${l.project_type ?? "Projet"} — ${l.name}`, amount: l.budget_max ?? l.budget_min ?? undefined, create_organization: !!l.company }}
          onCancel={() => setDialog(null)}
          onSuccess={(res: Row) => {
            setDialog(null);
            setConverted(res);
            void lead.reload();
          }}
          columns={1}
        />
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- opportunités */

export function OpportunitiesBoard() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList<Row>("/crm/opportunities", { pageSize: 200 });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [losing, setLosing] = useState<Row | null>(null);
  const [quoting, setQuoting] = useState<Row | null>(null);
  const router = useRouter();
  const byStage = useMemo(() => Object.fromEntries(STAGES.map((s) => [s, list.items.filter((o) => o.stage === s)])), [list.items]);
  const move = async (o: Row, stage: string, lost_reason?: string) => {
    try {
      await api(`/crm/opportunities/${o.id}/stage`, { method: "POST", body: { stage, lost_reason } });
      void list.reload();
    } catch (err) {
      toast.error("Changement d'étape impossible", errorMessage(err));
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {list.total} opportunité(s) · pondéré {money(list.items.filter((o) => !["won", "lost"].includes(o.stage)).reduce((s, o) => s + (toNumber(o.amount_estimated) * toNumber(o.probability)) / 100, 0))}
        </p>
        {can("crm:write") ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Opportunité
          </Button>
        ) : null}
      </div>
      {list.loading && !list.data ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-6">
          {STAGES.map((stage) => (
            <div key={stage} className="min-w-[15rem] rounded-2xl bg-slate-50 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-semibold uppercase text-muted">{optionLabel(stage)}</p>
                <Badge>{byStage[stage]?.length ?? 0}</Badge>
              </div>
              <div className="space-y-2">
                {(byStage[stage] ?? []).map((o) => (
                  <div key={o.id} className="rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-line">
                    <button type="button" className="text-left font-medium hover:underline" onClick={() => setEditing(o)}>
                      {o.title}
                    </button>
                    <p className="text-xs text-muted">
                      {o.number} · {optionLabel(o.universe)}
                    </p>
                    <p className="mt-1 font-semibold tabular-nums">{money(o.amount_estimated)}</p>
                    <p className="text-xs text-muted">
                      {o.probability} % {o.expected_close_date ? `· clôture ${date(o.expected_close_date)}` : ""}
                    </p>
                    {can("crm:write") ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Select
                          value={o.stage}
                          onChange={(e) => (e.target.value === "lost" ? setLosing(o) : void move(o, e.target.value))}
                          options={opts(STAGES)}
                          aria-label="Étape"
                          className="h-8 text-xs"
                        />
                        {!["won", "lost"].includes(o.stage) ? (
                          <Button size="sm" variant="ghost" onClick={() => setQuoting(o)}>
                            Devis
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle opportunité" size="lg">
        <SchemaForm
          endpoint="POST /crm/opportunities"
          initial={{ stage: "qualification", probability: 20, currency: "XAF" }}
          exclude={["stage", "probability", "lost_reason"]}
          fields={{ universe: { options: opts(UNIVERSES) }, owner_id: { ref: "users" } }}
          onCancel={() => setCreating(false)}
          onSuccess={() => {
            setCreating(false);
            void list.reload();
          }}
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.title ?? ""} size="lg">
        {editing ? (
          <SchemaForm
            endpoint="PATCH /crm/opportunities/{item_id}"
            params={{ item_id: editing.id }}
            initial={editing}
            partial
            exclude={["stage", "probability", "lost_reason", "lead_id"]}
            fields={{ universe: { options: opts(UNIVERSES) }, owner_id: { ref: "users" } }}
            onCancel={() => setEditing(null)}
            onSuccess={() => {
              setEditing(null);
              void list.reload();
            }}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={!!losing}
        onClose={() => setLosing(null)}
        title="Opportunité perdue"
        reasonLabel="Motif de perte (prix, délai, concurrent, projet abandonné…)"
        tone="danger"
        onConfirm={async (reason) => {
          if (losing) await move(losing, "lost", reason);
        }}
      />
      <Modal open={!!quoting} onClose={() => setQuoting(null)} title="Nouveau devis" size="full">
        {quoting ? (
          <QuoteEditor
            initial={{ opportunity_id: quoting.id, organization_id: quoting.organization_id, contact_id: quoting.contact_id, title: quoting.title }}
            onCancel={() => setQuoting(null)}
            onSaved={(q) => router.push(`/erp/crm/devis/${q.id}`)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- devis */

interface QuoteLineDraft {
  section: string;
  lot_code: string;
  designation: string;
  description: string;
  unit: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
}

interface ScheduleDraft {
  label: string;
  pct: string;
  milestone: string;
}

const emptyQuoteLine = (section = ""): QuoteLineDraft => ({ section, lot_code: "", designation: "", description: "", unit: "u", quantity: "1", unit_price: "", discount_pct: "0" });

/** Éditeur de devis : sections, lots, remises, échéancier (100 %), totaux en direct. */
export function QuoteEditor({ quote, initial, onSaved, onCancel }: { quote?: Row; initial?: Row; onSaved: (q: Row) => void; onCancel: () => void }) {
  const src = quote ?? initial ?? {};
  const [head, setHead] = useState({
    title: src.title ?? "",
    opportunity_id: src.opportunity_id ?? null,
    organization_id: src.organization_id ?? null,
    contact_id: src.contact_id ?? null,
    project_id: src.project_id ?? null,
    introduction: src.introduction ?? "",
    terms: src.terms ?? "",
    discount_amount: String(src.discount_amount ?? "0"),
    tax_rate: String(src.tax_rate ?? "19.25"),
    currency: src.currency ?? "XAF",
    valid_until: src.valid_until ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });
  const [lines, setLines] = useState<QuoteLineDraft[]>(
    quote?.lines?.length
      ? (quote.lines as Row[]).map((l) => ({ section: l.section ?? "", lot_code: l.lot_code ?? "", designation: l.designation, description: l.description ?? "", unit: l.unit ?? "u", quantity: String(toNumber(l.quantity)), unit_price: String(toNumber(l.unit_price)), discount_pct: String(toNumber(l.discount_pct)) }))
      : [emptyQuoteLine("Gros œuvre")],
  );
  const [schedule, setSchedule] = useState<ScheduleDraft[]>(((src.payment_schedule ?? []) as Row[]).map((s) => ({ label: s.label ?? "", pct: String(s.pct ?? ""), milestone: s.milestone ?? "" })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cur = head.currency === "XAF" ? "FCFA" : head.currency;
  const lineTotal = (l: QuoteLineDraft) => toNumber(l.quantity) * toNumber(l.unit_price) * (1 - toNumber(l.discount_pct) / 100);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const net = Math.max(0, subtotal - toNumber(head.discount_amount));
  const tax = (net * toNumber(head.tax_rate)) / 100;
  const scheduleTotal = schedule.reduce((s, x) => s + toNumber(x.pct), 0);
  const setLine = (i: number, patch: Partial<QuoteLineDraft>) => setLines((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...head,
        introduction: head.introduction || null,
        terms: head.terms || null,
        valid_until: head.valid_until || null,
        discount_amount: toNumber(head.discount_amount),
        tax_rate: toNumber(head.tax_rate),
        payment_schedule: schedule.filter((s) => s.label && s.pct).map((s) => ({ label: s.label, pct: toNumber(s.pct), milestone: s.milestone || null })),
        lines: lines
          .filter((l) => l.designation.trim())
          .map((l) => ({ section: l.section || null, lot_code: l.lot_code || null, designation: l.designation.trim(), description: l.description || null, unit: l.unit || "u", quantity: toNumber(l.quantity), unit_price: toNumber(l.unit_price), discount_pct: toNumber(l.discount_pct) })),
      };
      const saved = quote ? await api<Row>(`/crm/quotes/${quote.id}`, { method: "PUT", body }) : await api<Row>("/crm/quotes", { method: "POST", body });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Intitulé du devis" required className="md:col-span-2">
          <Input value={head.title} onChange={(e) => setHead({ ...head, title: e.target.value })} />
        </Field>
        <Field label="Valable jusqu'au">
          <Input type="date" value={head.valid_until ?? ""} onChange={(e) => setHead({ ...head, valid_until: e.target.value })} />
        </Field>
        <Field label="Opportunité">
          <RefSelect source={REFS.opportunities} value={head.opportunity_id} onChange={(v) => setHead({ ...head, opportunity_id: v })} />
        </Field>
        <Field label="Client (organisation)">
          <RefSelect source={REFS.organizations} value={head.organization_id} onChange={(v) => setHead({ ...head, organization_id: v })} />
        </Field>
        <Field label="Contact">
          <RefSelect source={REFS.contacts} value={head.contact_id} onChange={(v) => setHead({ ...head, contact_id: v })} />
        </Field>
        <Field label="Devise">
          <Select value={head.currency} onChange={(e) => setHead({ ...head, currency: e.target.value })} options={[{ value: "XAF", label: "FCFA (XAF)" }, { value: "EUR", label: "Euro" }, { value: "USD", label: "Dollar US" }]} />
        </Field>
        <Field label="TVA (%)">
          <Input type="number" min={0} max={100} step="any" value={head.tax_rate} onChange={(e) => setHead({ ...head, tax_rate: e.target.value })} />
        </Field>
        <Field label="Remise globale">
          <Input type="number" min={0} step="any" value={head.discount_amount} onChange={(e) => setHead({ ...head, discount_amount: e.target.value })} />
        </Field>
        <Field label="Introduction" className="md:col-span-3">
          <Textarea value={head.introduction} onChange={(e) => setHead({ ...head, introduction: e.target.value })} rows={2} />
        </Field>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-2 py-2">Section</th>
              <th className="px-2 py-2">Lot</th>
              <th className="px-2 py-2">Désignation</th>
              <th className="px-2 py-2">Unité</th>
              <th className="px-2 py-2">Qté</th>
              <th className="px-2 py-2">PU HT</th>
              <th className="px-2 py-2">Remise %</th>
              <th className="px-2 py-2 text-right">Total HT</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l, i) => (
              <tr key={i} className="align-top">
                <td className="px-2 py-1">
                  <Input className="w-32" value={l.section} onChange={(e) => setLine(i, { section: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <Input className="w-16" value={l.lot_code} onChange={(e) => setLine(i, { lot_code: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <Input className="min-w-[14rem]" value={l.designation} onChange={(e) => setLine(i, { designation: e.target.value })} />
                  <Input className="mt-1 text-xs" placeholder="Description (facultatif)" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <Input className="w-16" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <Input type="number" min={0} step="any" className="w-20" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <Input type="number" min={0} step="any" className="w-28" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <Input type="number" min={0} max={100} step="any" className="w-16" value={l.discount_pct} onChange={(e) => setLine(i, { discount_pct: e.target.value })} />
                </td>
                <td className="px-2 py-1 text-right tabular-nums">{money(lineTotal(l), cur)}</td>
                <td className="px-1 py-1">
                  <button type="button" aria-label="Retirer la ligne" className="rounded p-1.5 text-muted hover:text-red-600" onClick={() => setLines((all) => all.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button size="sm" variant="secondary" onClick={() => setLines((all) => [...all, emptyQuoteLine(all[all.length - 1]?.section ?? "")])}>
          <Plus className="h-4 w-4" /> Ligne
        </Button>
        <dl className="min-w-[16rem] space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Sous-total HT</dt>
            <dd className="tabular-nums">{money(subtotal, cur)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Remise</dt>
            <dd className="tabular-nums">− {money(head.discount_amount, cur)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>TVA {number(head.tax_rate, 2)} %</dt>
            <dd className="tabular-nums">{money(tax, cur)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-1 font-semibold">
            <dt>Total TTC</dt>
            <dd className="tabular-nums">{money(net + tax, cur)}</dd>
          </div>
        </dl>
      </div>
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Échéancier de paiement</p>
          <span className={`text-xs font-semibold ${schedule.length && Math.abs(scheduleTotal - 100) > 0.001 ? "text-red-600" : "text-muted"}`}>Total {number(scheduleTotal, 2)} % {schedule.length ? "(doit faire 100 %)" : ""}</span>
        </div>
        {schedule.map((s, i) => (
          <div key={i} className="mb-2 grid grid-cols-[1fr_6rem_1fr_auto] gap-2">
            <Input placeholder="Acompte à la signature" value={s.label} onChange={(e) => setSchedule((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Input type="number" min={0} max={100} placeholder="%" value={s.pct} onChange={(e) => setSchedule((all) => all.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))} />
            <Input placeholder="Jalon (ex. fin des fondations)" value={s.milestone} onChange={(e) => setSchedule((all) => all.map((x, j) => (j === i ? { ...x, milestone: e.target.value } : x)))} />
            <button type="button" aria-label="Retirer l'échéance" className="rounded p-1.5 text-muted hover:text-red-600" onClick={() => setSchedule((all) => all.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setSchedule((all) => [...all, { label: "", pct: "", milestone: "" }])}>
          <Plus className="h-4 w-4" /> Échéance
        </Button>
      </Card>
      <Field label="Conditions particulières">
        <Textarea value={head.terms} onChange={(e) => setHead({ ...head, terms: e.target.value })} rows={4} />
      </Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button onClick={save} loading={busy} disabled={head.title.trim().length < 2 || (schedule.length > 0 && Math.abs(scheduleTotal - 100) > 0.001)}>
          {quote ? "Enregistrer" : "Créer le devis"}
        </Button>
      </div>
    </div>
  );
}

export function QuotesList() {
  const { can } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <ResourceView
        embedded
        config={{
          title: "Devis",
          subtitle: "Envoi d'un lien sécurisé, suivi de consultation, acceptation par code OTP avec preuve, révisions.",
          path: "/crm/quotes",
          href: (r) => `/erp/crm/devis/${r.id}`,
          columns: [
            { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/crm/devis/${r.id}`}>{`${r.number}${r.revision > 1 ? ` (r${r.revision})` : ""}`}</CellLink> },
            { key: "title", label: "Objet" },
            { key: "total", label: "TTC", format: "money", align: "right", sortable: true },
            { key: "valid_until", label: "Validité", format: "date", hideOnMobile: true },
            { key: "sent_at", label: "Envoyé", format: "datetime", hideOnMobile: true },
            { key: "viewed_at", label: "Consulté", format: "datetime", hideOnMobile: true },
            { key: "status", label: "Statut", format: "status" },
          ],
          filters: [{ key: "status", label: "Statut", options: opts(QUOTE_STATUSES) }],
          toolbar: can("crm:write") ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nouveau devis
            </Button>
          ) : undefined,
        }}
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau devis" size="full">
        <QuoteEditor onCancel={() => setCreating(false)} onSaved={(q) => router.push(`/erp/crm/devis/${q.id}`)} />
      </Modal>
    </>
  );
}

export function QuoteDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const quote = useApi<Row>(`/crm/quotes/${id}`);
  const [dialog, setDialog] = useState<null | "edit" | "reject" | "contract">(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (quote.loading && !quote.data) return <Skeleton className="h-96 w-full" />;
  if (!quote.data) return <Alert tone="danger">{quote.error}</Alert>;
  const q = quote.data;
  const cur = q.currency === "XAF" ? "FCFA" : q.currency;
  const sections = ((q.lines ?? []) as Row[]).reduce<Record<string, Row[]>>((acc, l) => {
    const key = l.section || "Prestations";
    (acc[key] ??= []).push(l);
    return acc;
  }, {});
  const proof = (q.acceptance_proof ?? {}) as Row;
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/crm?onglet=devis" className="hover:underline">Devis</Link>}
        title={`${q.number}${q.revision > 1 ? ` — révision ${q.revision}` : ""}`}
        subtitle={q.title}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={q.status} />
            <a href={apiUrl(`/crm/quotes/${id}/pdf`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
            {can("crm:write") && q.status === "draft" ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("edit")}>
                Modifier
              </Button>
            ) : null}
            {can("crm:write") && ["draft", "sent", "viewed"].includes(q.status) ? (
              <Button
                size="sm"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await api<Row>(`/crm/quotes/${id}/send`, { method: "POST" });
                    quote.setData(res);
                    setPublicUrl(res.public_url ?? null);
                    toast.success("Devis envoyé", "Le client reçoit un lien sécurisé pour le consulter et l'accepter par code OTP.");
                  } catch (err) {
                    toast.error("Envoi impossible", errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Send className="h-4 w-4" /> {q.status === "draft" ? "Envoyer" : "Renvoyer"}
              </Button>
            ) : null}
            {can("crm:write") && ["sent", "viewed", "rejected", "expired"].includes(q.status) ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    const rev = await api<Row>(`/crm/quotes/${id}/revise`, { method: "POST" });
                    router.push(`/erp/crm/devis/${rev.id}`);
                  } catch (err) {
                    toast.error("Révision impossible", errorMessage(err));
                  }
                }}
              >
                Réviser
              </Button>
            ) : null}
            {can("crm:write") && ["sent", "viewed"].includes(q.status) ? (
              <Button size="sm" variant="ghost" onClick={() => setDialog("reject")}>
                Refus client
              </Button>
            ) : null}
            {can("crm:contracts") && q.status === "accepted" ? (
              <Button size="sm" variant="accent" onClick={() => setDialog("contract")}>
                <FileSignature className="h-4 w-4" /> Établir le contrat
              </Button>
            ) : null}
          </div>
        }
      />
      {publicUrl ? (
        <Alert tone="info" title="Lien client">
          <span className="flex flex-wrap items-center gap-2">
            <code className="break-all text-xs">{publicUrl}</code>
            <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(publicUrl).then(() => toast.success("Lien copié"))}>
              <Copy className="h-4 w-4" /> Copier
            </Button>
          </span>
        </Alert>
      ) : null}
      {q.status === "accepted" ? (
        <Alert tone="success" title={`Accepté le ${dateTime(q.accepted_at)} par ${q.accepted_by_name ?? "—"}`}>
          Preuve : {optionLabel(proof.method)} {proof.email ? `· ${proof.email}` : ""} {proof.ip ? `· IP ${proof.ip}` : ""} {proof.document_sha256 ? `· empreinte ${String(proof.document_sha256).slice(0, 16)}…` : ""}
        </Alert>
      ) : null}
      {q.rejected_reason ? <Alert tone="danger" title={`Refusé le ${dateTime(q.rejected_at)}`}>{q.rejected_reason}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total TTC" value={money(q.total, cur)} hint={`HT ${money(q.subtotal, cur)} · TVA ${number(q.tax_rate, 2)} %`} tone="info" />
        <Stat label="Remise" value={money(q.discount_amount, cur)} />
        <Stat label="Validité" value={date(q.valid_until)} />
        <Stat label="Suivi" value={q.viewed_at ? `Consulté ${relative(q.viewed_at)}` : q.sent_at ? `Envoyé ${relative(q.sent_at)}` : "Brouillon"} />
      </div>
      {q.introduction ? <Card className="whitespace-pre-line p-5 text-sm">{q.introduction}</Card> : null}
      <Card>
        <CardHeader title="Détail estimatif" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Désignation</th>
                <th className="px-3 py-2 text-right">Qté</th>
                <th className="px-3 py-2 text-right">PU HT</th>
                <th className="px-3 py-2 text-right">Remise</th>
                <th className="px-3 py-2 text-right">Total HT</th>
              </tr>
            </thead>
            {Object.entries(sections).map(([section, rows]) => (
              <tbody key={section} className="divide-y divide-line">
                <tr className="bg-brand-50/50">
                  <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold uppercase text-brand-700">
                    {section}
                  </td>
                </tr>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-1.5">
                      {l.lot_code ? <span className="mr-1 text-xs text-muted">{l.lot_code}</span> : null}
                      {l.designation}
                      {l.description ? <span className="block text-xs text-muted">{l.description}</span> : null}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {number(l.quantity, 2)} {l.unit}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{money(l.unit_price, cur)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{toNumber(l.discount_pct) ? `${number(l.discount_pct, 1)} %` : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{money(l.total, cur)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Card>
      {((q.payment_schedule ?? []) as Row[]).length ? (
        <Card>
          <CardHeader title="Échéancier" />
          <ul className="divide-y divide-line text-sm">
            {(q.payment_schedule as Row[]).map((s, i) => (
              <li key={i} className="flex justify-between gap-2 px-5 py-2">
                <span>
                  {s.label}
                  {s.milestone ? <span className="block text-xs text-muted">{s.milestone}</span> : null}
                </span>
                <span className="tabular-nums">
                  {number(s.pct, 2)} % · {money((toNumber(q.total) * toNumber(s.pct)) / 100, cur)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {q.terms ? (
        <Card className="p-5">
          <p className="mb-2 font-semibold">Conditions</p>
          <p className="whitespace-pre-line text-sm text-muted">{q.terms}</p>
        </Card>
      ) : null}

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Modifier le devis" size="full">
        <QuoteEditor
          quote={q}
          onCancel={() => setDialog(null)}
          onSaved={(saved) => {
            quote.setData(saved);
            setDialog(null);
          }}
        />
      </Modal>
      <ConfirmDialog
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        title="Enregistrer le refus du client"
        reasonLabel="Motif communiqué par le client"
        tone="danger"
        onConfirm={async (reason) => {
          quote.setData(await api(`/crm/quotes/${id}/reject`, { method: "POST", body: { reason } }));
        }}
      />
      <ConfirmDialog
        open={dialog === "contract"}
        onClose={() => setDialog(null)}
        title="Établir le contrat"
        text="Le contrat reprend le montant, les conditions et l'échéancier du devis accepté."
        onConfirm={async () => {
          const c = await api<Row>(`/crm/quotes/${id}/contract`, { method: "POST" });
          router.push(`/erp/crm/contrats/${c.id}`);
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------------- contrats */

export function CrmContractsList() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Contrats clients",
        path: "/crm/contracts",
        href: (r) => `/erp/crm/contrats/${r.id}`,
        columns: [
          { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/crm/contrats/${r.id}`}>{r.number}</CellLink> },
          { key: "title", label: "Objet" },
          { key: "amount", label: "Montant", format: "money", align: "right", sortable: true },
          { key: "signed_at", label: "Signé le", format: "date" },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: opts(["draft", "sent", "signed", "active", "closed", "cancelled"]) }],
      }}
    />
  );
}

export function CrmContractDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const contract = useApi<Row>(`/crm/contracts/${id}`);
  const [dialog, setDialog] = useState<null | "sign" | "project">(null);
  const [sign, setSign] = useState({ signed_by_name: "", method: "manuscrite_scannee", signed_on: new Date().toISOString().slice(0, 10) });
  const [scan, setScan] = useState<File[]>([]);
  const [proj, setProj] = useState<{ name: string; manager_id: string | null; client_user_ids: string[]; invite_client_email: string }>({ name: "", manager_id: null, client_user_ids: [], invite_client_email: "" });
  const [busy, setBusy] = useState(false);
  if (contract.loading && !contract.data) return <Skeleton className="h-96 w-full" />;
  if (!contract.data) return <Alert tone="danger">{contract.error}</Alert>;
  const c = contract.data;
  const cur = c.currency === "XAF" ? "FCFA" : c.currency;
  const proof = (c.signature_proof ?? {}) as Row;
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/crm?onglet=contrats" className="hover:underline">Contrats</Link>}
        title={`${c.number} — ${c.title}`}
        subtitle={[c.organization?.name, c.contact?.name].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            {proof.evidence_file_id ? (
              <a href={apiUrl(`/crm/contracts/${id}/evidence`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                <Download className="h-3.5 w-3.5" /> Contrat signé
              </a>
            ) : null}
            {can("crm:contracts") && ["draft", "sent"].includes(c.status) ? (
              <Button
                size="sm"
                onClick={() => {
                  setSign((s) => ({ ...s, signed_by_name: c.contact?.name ?? "" }));
                  setDialog("sign");
                }}
              >
                <FileSignature className="h-4 w-4" /> Enregistrer la signature
              </Button>
            ) : null}
            {can("crm:contracts") && can("projects:write") && c.status === "signed" && !c.project_id ? (
              <Button
                size="sm"
                variant="accent"
                onClick={() => {
                  setProj((p) => ({ ...p, name: c.title, invite_client_email: c.contact?.email ?? "" }));
                  setDialog("project");
                }}
              >
                Créer le projet
              </Button>
            ) : null}
            {c.project ? (
              <Link href={`/erp/chantiers/${c.project.id}`} className="inline-flex h-8 items-center rounded-xl bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600">
                Projet {c.project.code}
              </Link>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Montant" value={money(c.amount, cur)} tone="info" />
        <Stat label="Période" value={c.start_date ? `${date(c.start_date)} → ${date(c.end_date)}` : "—"} />
        <Stat label="Signature" value={c.signed_at ? dateTime(c.signed_at) : "En attente"} hint={c.signed_by_name ? `${c.signed_by_name} · ${optionLabel(proof.method)}` : undefined} tone={c.signed_at ? "success" : "warning"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <DescriptionList
            columns={1}
            items={[
              { label: "Devis d'origine", value: c.quote ? <CellLink href={`/erp/crm/devis/${c.quote.id}`}>{`${c.quote.number} (r${c.quote.revision}) · ${money(c.quote.total, cur)}`}</CellLink> : "—" },
              { label: "Client", value: c.organization?.name ?? "—" },
              { label: "Contact", value: c.contact ? [c.contact.name, c.contact.email, c.contact.phone].filter(Boolean).join(" · ") : "—" },
              { label: "Créé le", value: dateTime(c.created_at) },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Échéancier contractuel" />
          <ul className="divide-y divide-line text-sm">
            {((c.payment_schedule ?? []) as Row[]).map((s, i) => (
              <li key={i} className="flex justify-between gap-2 px-5 py-2">
                <span>
                  {s.label}
                  {s.milestone ? <span className="block text-xs text-muted">{s.milestone}</span> : null}
                </span>
                <span className="tabular-nums">
                  {number(s.pct, 2)} % · {money((toNumber(c.amount) * toNumber(s.pct)) / 100, cur)}
                </span>
              </li>
            ))}
            {!(c.payment_schedule ?? []).length ? <li className="px-5 py-3 text-muted">Aucun échéancier.</li> : null}
          </ul>
        </Card>
      </div>
      {c.terms ? (
        <Card className="p-5">
          <p className="mb-2 font-semibold">Conditions</p>
          <p className="whitespace-pre-line text-sm text-muted">{c.terms}</p>
        </Card>
      ) : null}

      <Modal
        open={dialog === "sign"}
        onClose={() => setDialog(null)}
        title="Enregistrer la signature du contrat"
        footer={
          <Button
            loading={busy}
            disabled={sign.signed_by_name.trim().length < 3 || (sign.method === "manuscrite_scannee" && !scan.length)}
            onClick={async () => {
              setBusy(true);
              try {
                let evidence: string | null = null;
                if (scan[0]) {
                  const fd = new FormData();
                  fd.append("file", scan[0]);
                  evidence = (await api<{ file_id: string }>("/crm/files", { method: "POST", form: fd })).file_id;
                }
                contract.setData(await api(`/crm/contracts/${id}/sign`, { method: "POST", body: { ...sign, evidence_file_id: evidence } }));
                void contract.reload();
                setDialog(null);
                toast.success("Signature enregistrée");
              } catch (err) {
                toast.error("Enregistrement impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Enregistrer
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Signataire" required>
            <Input value={sign.signed_by_name} onChange={(e) => setSign({ ...sign, signed_by_name: e.target.value })} />
          </Field>
          <Field label="Mode de signature">
            <Select value={sign.method} onChange={(e) => setSign({ ...sign, method: e.target.value })} options={opts(["manuscrite_scannee", "otp", "electronique"])} />
          </Field>
          <Field label="Date de signature">
            <Input type="date" value={sign.signed_on} onChange={(e) => setSign({ ...sign, signed_on: e.target.value })} />
          </Field>
          <Field label="Contrat signé scanné" required={sign.method === "manuscrite_scannee"}>
            <FileDrop files={scan} onChange={setScan} accept=".pdf,image/*" maxSizeMb={25} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={dialog === "project"}
        onClose={() => setDialog(null)}
        title="Créer le projet à partir du contrat"
        footer={
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await api<Row>(`/crm/contracts/${id}/project`, {
                  method: "POST",
                  body: { name: proj.name || null, manager_id: proj.manager_id, client_user_ids: proj.client_user_ids, invite_client_email: proj.invite_client_email || null },
                });
                toast.success(`Projet ${res.project_code} créé`, res.invitation_id ? "Le client est invité à rejoindre son espace." : undefined);
                router.push(`/erp/chantiers/${res.project_id}`);
              } catch (err) {
                toast.error("Création impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Créer le projet
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Nom du projet">
            <Input value={proj.name} onChange={(e) => setProj({ ...proj, name: e.target.value })} />
          </Field>
          <Field label="Chef de projet">
            <RefSelect source={REFS.users} value={proj.manager_id} onChange={(v) => setProj({ ...proj, manager_id: v })} />
          </Field>
          <Field label="Comptes clients existants à rattacher">
            <MultiRefSelect source={REFS.users} value={proj.client_user_ids} onChange={(v) => setProj({ ...proj, client_user_ids: v })} />
          </Field>
          <Field label="Inviter le client par e-mail" help="Crée son accès à l'espace client, limité à ce projet.">
            <Input type="email" value={proj.invite_client_email} onChange={(e) => setProj({ ...proj, invite_client_email: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- contacts, activités, réglages */

export function ContactsList() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Contacts",
        path: "/crm/contacts",
        columns: [
          { key: "last_name", label: "Nom", sortable: true, render: (r) => [r.first_name, r.last_name].filter(Boolean).join(" ") },
          { key: "job_title", label: "Fonction", hideOnMobile: true },
          { key: "email", label: "E-mail" },
          { key: "phone", label: "Téléphone" },
          { key: "city", label: "Ville", hideOnMobile: true },
          { key: "is_diaspora", label: "Diaspora", format: "bool", hideOnMobile: true },
        ],
        filters: [{ key: "is_diaspora", label: "Diaspora", options: [{ value: "true", label: "Oui" }, { value: "false", label: "Non" }] }],
        create: { endpoint: "POST /crm/contacts", label: "Nouveau contact", perms: ["crm:write"], fields: { tags: { widget: "tags" }, notes: { widget: "textarea" } }, exclude: ["source_lead_id", "user_id"] },
        update: { endpoint: "PATCH /crm/contacts/{item_id}", perms: ["crm:write"], fields: { tags: { widget: "tags" }, notes: { widget: "textarea" } }, exclude: ["source_lead_id", "user_id"] },
        remove: { path: (r) => `/crm/contacts/${r.id}`, perms: ["crm:write"] },
      }}
    />
  );
}

export function ActivitiesList() {
  const [mine, setMine] = useState(true);
  return (
    <ResourceView
      embedded
      config={{
        title: "Activités et relances",
        path: "/crm/activities",
        query: { mine },
        columns: [
          { key: "due_at", label: "Échéance", format: "datetime", sortable: true },
          { key: "kind", label: "Type", format: "option" },
          { key: "subject", label: "Objet" },
          { key: "lead_id", label: "Lead", render: (r) => (r.lead_id ? <CellLink href={`/erp/crm/leads/${r.lead_id}`}>Ouvrir</CellLink> : "—") },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: [{ value: "planned", label: "À faire" }, { value: "done", label: "Faites" }] }],
        toolbar: <Checkbox label="Mes activités uniquement" checked={mine} onChange={setMine} />,
        actions: [
          { key: "done", label: "Marquer faite", path: (r) => `/crm/activities/${r.id}/done`, when: (r) => r.status !== "done", perms: ["crm:write"], reasonLabel: "Résultat", body: (_r, reason) => ({ outcome: reason }), success: "Activité terminée" },
        ],
      }}
    />
  );
}

interface Criteria {
  universes: string[];
  cities: string[];
  countries: string[];
  diaspora: boolean | null;
  sources: string[];
  urgent: boolean | null;
  min_score?: number | null;
}

/** Critères d'une règle d'affectation (vides = tous les leads). */
function CriteriaEditor({ value, onChange }: { value: Partial<Criteria> | null | undefined; onChange: (v: Criteria) => void }) {
  const c: Criteria = { universes: [], cities: [], countries: [], diaspora: null, sources: [], urgent: null, ...(value && typeof value === "object" ? value : {}) };
  const set = (patch: Partial<Criteria>) => onChange({ ...c, ...patch });
  return (
    <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
      <CheckGroup legend="Univers" options={opts(UNIVERSES)} value={c.universes} onChange={(universes) => set({ universes })} className="sm:col-span-2" />
      <CheckGroup legend="Sources" options={opts(LEAD_SOURCES)} value={c.sources} onChange={(sources) => set({ sources })} className="sm:col-span-2" />
      <Field label="Villes">
        <TagInput value={c.cities} onChange={(cities) => set({ cities })} placeholder="Ex. Douala puis Entrée" />
      </Field>
      <Field label="Pays">
        <TagInput value={c.countries} onChange={(countries) => set({ countries })} placeholder="Ex. Cameroun puis Entrée" />
      </Field>
      <Field label="Diaspora">
        <Select
          value={c.diaspora === null || c.diaspora === undefined ? "" : String(c.diaspora)}
          onChange={(e) => set({ diaspora: e.target.value === "" ? null : e.target.value === "true" })}
          options={[
            { value: "", label: "Indifférent" },
            { value: "true", label: "Diaspora uniquement" },
            { value: "false", label: "Résidents uniquement" },
          ]}
        />
      </Field>
      <Field label="Score minimal" help="Vide = pas de seuil.">
        <Input type="number" min={0} max={100} value={c.min_score ?? ""} onChange={(e) => set({ min_score: e.target.value === "" ? null : Number(e.target.value) })} />
      </Field>
      <div className="sm:col-span-2">
        <Checkbox label="Uniquement les demandes urgentes" checked={!!c.urgent} onChange={(on) => set({ urgent: on ? true : null })} />
      </div>
      <p className="text-xs text-muted sm:col-span-2">Un critère laissé vide ne filtre pas : une règle sans critère s'applique à tous les leads.</p>
    </div>
  );
}

/** Paliers d'escalade d'une politique SLA : `[{ after_minutes, notify_roles, reassign }]`. */
function EscalationEditor({ value, onChange }: { value: unknown; onChange: (v: Row[]) => void }) {
  return (
    <RowsEditor
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      itemLabel="Palier"
      title={(_r, i) => (i === 0 ? "Palier 1 — dès le dépassement du délai" : `Palier ${i + 1}`)}
      fields={[
        { key: "after_minutes", label: "Après (minutes de dépassement)", type: "number", min: 0, step: 1 },
        { key: "notify_roles", label: "Rôles à prévenir", wide: true, render: (row, set) => <RolePicker value={Array.isArray(row.notify_roles) ? row.notify_roles : []} onChange={(notify_roles) => set({ notify_roles })} /> },
        { key: "reassign", label: "Réaffectation", wide: true, render: (row, set) => <Checkbox label="Réaffecter le lead à un autre commercial" checked={!!row.reassign} onChange={(on) => set({ reassign: on })} /> },
      ]}
      newRow={(rows) => ({ after_minutes: rows.length ? 60 * (rows.length + 1) : 0, notify_roles: ["DIRECTION"], reassign: false })}
      addLabel="Palier d'escalade"
      empty="Aucune escalade : seule l'alerte de dépassement est émise."
      max={10}
    />
  );
}

export function CrmSettings() {
  const criteria: FieldConfig = { span: 2, label: "Critères", render: ({ value, onChange }) => <CriteriaEditor value={value} onChange={onChange} /> };
  const assignees: FieldConfig = { span: 2, label: "Commerciaux", render: ({ value, onChange }) => <MultiRefSelect source={REFS.users} value={Array.isArray(value) ? value.map(String) : []} onChange={onChange} /> };
  const escalation: FieldConfig = { span: 2, label: "Escalade", render: ({ value, onChange }) => <EscalationEditor value={value} onChange={onChange} /> };
  return (
    <div className="space-y-8">
      <ResourceView
        embedded
        config={{
          title: "Règles d'affectation des leads",
          subtitle: "Critères (univers, villes, pays, diaspora, sources, urgence) → commerciaux en tour de rôle ou au moins chargé.",
          path: "/crm/assignment-rules",
          columns: [
            { key: "priority", label: "Priorité", sortable: true },
            { key: "name", label: "Règle" },
            { key: "strategy", label: "Stratégie", format: "option" },
            { key: "assignee_ids", label: "Commerciaux", render: (r) => (r.assignee_ids ?? []).length },
            { key: "is_active", label: "Active", format: "bool" },
          ],
          create: {
            endpoint: "POST /crm/assignment-rules",
            label: "Nouvelle règle",
            perms: ["crm:assign"],
            exclude: ["cursor"],
            initial: { criteria: { universes: [], cities: [], countries: [], diaspora: null, sources: [], urgent: null }, strategy: "round_robin", priority: 100 },
            fields: { strategy: { options: opts(["round_robin", "least_loaded"]) }, assignee_ids: assignees, criteria },
          },
          update: { endpoint: "PATCH /crm/assignment-rules/{item_id}", perms: ["crm:assign"], exclude: ["cursor"], fields: { strategy: { options: opts(["round_robin", "least_loaded"]) }, assignee_ids: assignees, criteria } },
          remove: { path: (r) => `/crm/assignment-rules/${r.id}`, perms: ["crm:assign"] },
        }}
      />
      <ResourceView
        embedded
        config={{
          title: "Politiques SLA",
          subtitle: "Délais de première réponse (leads) et de résolution (tickets SAV), escalades automatiques.",
          path: "/crm/sla-policies",
          columns: [
            { key: "entity", label: "Objet", format: "option" },
            { key: "name", label: "Politique" },
            { key: "priority", label: "Priorité", format: "option" },
            { key: "response_minutes", label: "Réponse (min)" },
            { key: "resolution_minutes", label: "Résolution (min)" },
            { key: "business_hours_only", label: "Heures ouvrées", format: "bool" },
            { key: "is_active", label: "Active", format: "bool" },
          ],
          create: {
            endpoint: "POST /crm/sla-policies",
            label: "Nouvelle politique",
            perms: ["settings:write"],
            initial: { escalation: [{ after_minutes: 60, notify_roles: ["DIRECTION"] }] },
            fields: { entity: { options: opts(["lead", "ticket"]) }, priority: { options: opts(["low", "normal", "high", "urgent"]) }, escalation },
          },
          update: { endpoint: "PATCH /crm/sla-policies/{item_id}", perms: ["settings:write"], fields: { entity: { options: opts(["lead", "ticket"]) }, priority: { options: opts(["low", "normal", "high", "urgent"]) }, escalation } },
          remove: { path: (r) => `/crm/sla-policies/${r.id}`, perms: ["settings:write"] },
        }}
      />
    </div>
  );
}

export function CrmHub({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const { can } = useAuth();
  return (
    <div className="space-y-5">
      <PageTitle title="CRM" subtitle="Lead → qualification → opportunité → devis (OTP) → contrat → projet. Aucun prospect sans réponse dans les délais." />
      <Tabs
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "tableau", label: "Tableau de bord" },
          { key: "leads", label: "Leads" },
          { key: "opportunites", label: "Pipeline" },
          { key: "devis", label: "Devis" },
          { key: "contrats", label: "Contrats" },
          { key: "contacts", label: "Contacts" },
          { key: "activites", label: "Activités" },
          { key: "reglages", label: "Réglages", hidden: !can("crm:assign") && !can("settings:write") },
        ]}
      />
      {tab === "tableau" ? <CrmDashboard /> : null}
      {tab === "leads" ? <LeadsList /> : null}
      {tab === "opportunites" ? <OpportunitiesBoard /> : null}
      {tab === "devis" ? <QuotesList /> : null}
      {tab === "contrats" ? <CrmContractsList /> : null}
      {tab === "contacts" ? <ContactsList /> : null}
      {tab === "activites" ? <ActivitiesList /> : null}
      {tab === "reglages" ? <CrmSettings /> : null}
    </div>
  );
}
