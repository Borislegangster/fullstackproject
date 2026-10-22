"use client";

import { Eye, Plus, Send } from "lucide-react";
import { useState } from "react";

import { ResourceView, type Row } from "@/components/erp/resource";
import { MultiRefSelect } from "@/components/forms/ref-select";
import { RowsEditor } from "@/components/forms/structured-fields";
import { Field, Input, Select, TagInput, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, number, percent, toInputDateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

const opts = (values: string[]) => values.map((v) => ({ value: v, label: optionLabel(v) }));
const SUB_STATUSES = ["pending", "subscribed", "unsubscribed", "bounced", "complained"];
const UNIVERSES = ["HOME", "BUSINESS", "PREMIUM", "DIASPORA", "ENGINEERING"];

/** Aperçu d'un e-mail HTML dans un cadre isolé (aucun script exécuté). */
function EmailPreview({ html, height = 520 }: { html: string; height?: number }) {
  return <iframe title="Aperçu de l'e-mail" sandbox="" srcDoc={html} className="w-full rounded-xl border border-line bg-white" style={{ height }} />;
}

/* ----------------------------------------------------------------------------- abonnés */

function SubscriberPanel({ sub, reload }: { sub: Row; reload: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const history = useApi<Row[]>(`/newsletter/subscribers/${sub.id}/history`);
  const [tags, setTags] = useState<string[]>(sub.tags ?? []);
  const [interests, setInterests] = useState<string[]>(sub.interests ?? []);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-4">
      <DescriptionList
        items={[
          { label: "E-mail", value: sub.email },
          { label: "Nom", value: [sub.first_name, sub.last_name].filter(Boolean).join(" ") || "—" },
          { label: "Statut", value: <StatusBadge status={sub.status} /> },
          { label: "Source", value: optionLabel(sub.source) },
          { label: "Confirmé le", value: sub.confirmed_at ? dateTime(sub.confirmed_at) : "—" },
          { label: "Dernière interaction", value: sub.last_engaged_at ? dateTime(sub.last_engaged_at) : "—" },
          { label: "Pays", value: sub.country ?? "—" },
          { label: "Rebonds", value: sub.bounce_count ?? 0 },
        ]}
      />
      {can("newsletter:write") ? (
        <div className="space-y-3 rounded-xl border border-line p-3">
          <Field label="Tags">
            <TagInput value={tags} onChange={setTags} />
          </Field>
          <Field label="Centres d'intérêt (univers, thèmes)">
            <TagInput value={interests} onChange={setInterests} placeholder="HOME, PREMIUM…" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/newsletter/subscribers/${sub.id}`, { method: "PATCH", body: { tags, interests } });
                  toast.success("Abonné mis à jour");
                  reload();
                  void history.reload();
                } catch (err) {
                  toast.error("Mise à jour impossible", errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Enregistrer
            </Button>
            {sub.status === "subscribed" || sub.status === "pending" ? (
              <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
                Désinscrire
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted">Historique (preuves de consentement)</p>
        <ol className="space-y-1 text-sm">
          {(history.data ?? []).map((e, i) => (
            <li key={i}>
              <span className="text-xs text-muted">{dateTime(e.at)}</span> · {optionLabel(e.kind)}
              {e.details && Object.keys(e.details).length ? <span className="text-muted"> — {Object.entries(e.details as Record<string, unknown>).map(([k, v]) => `${optionLabel(k)} : ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ")}</span> : null}
            </li>
          ))}
          {!history.data?.length ? <li className="text-muted">Aucun événement.</li> : null}
        </ol>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Désinscrire l'abonné"
        text="L'adresse ne recevra plus aucune campagne ; l'opération est tracée."
        tone="danger"
        onConfirm={async () => {
          await api(`/newsletter/subscribers/${sub.id}`, { method: "PATCH", body: { status: "unsubscribed" } });
          reload();
        }}
      />
    </div>
  );
}

export function SubscribersList() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Abonnés",
        subtitle: "Double opt-in, preuve de consentement, désinscription en un clic, nettoyage des rebonds.",
        path: "/newsletter/subscribers",
        columns: [
          { key: "email", label: "E-mail", sortable: true },
          { key: "first_name", label: "Prénom", hideOnMobile: true },
          { key: "source", label: "Source", format: "option" },
          { key: "interests", label: "Intérêts", render: (r) => (r.interests ?? []).map((i: string) => optionLabel(i)).join(", ") || "—", hideOnMobile: true },
          { key: "created_at", label: "Inscrit le", format: "date", sortable: true },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [
          { key: "status", label: "Statut", options: opts(SUB_STATUSES) },
          { key: "source", label: "Source", options: opts(["website", "footer", "blog", "describe_project", "lead", "import", "event"]) },
        ],
        detail: (r, reload) => <SubscriberPanel sub={r} reload={reload} />,
      }}
    />
  );
}

/* ----------------------------------------------------------------------------- segments */

interface Rules {
  tags_any: string[];
  tags_all: string[];
  interests_any: string[];
  sources: string[];
  countries: string[];
  diaspora: boolean | null;
}

function RulesEditor({ value, onChange }: { value: Partial<Rules> | null | undefined; onChange: (v: Rules) => void }) {
  const r: Rules = { tags_any: [], tags_all: [], interests_any: [], sources: [], countries: [], diaspora: null, ...(value && typeof value === "object" ? value : {}) };
  const set = (patch: Partial<Rules>) => onChange({ ...r, ...patch });
  return (
    <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
      <Field label="Au moins un de ces tags">
        <TagInput value={r.tags_any} onChange={(v) => set({ tags_any: v })} />
      </Field>
      <Field label="Tous ces tags">
        <TagInput value={r.tags_all} onChange={(v) => set({ tags_all: v })} />
      </Field>
      <Field label="Centres d'intérêt" help={UNIVERSES.join(", ")}>
        <TagInput value={r.interests_any} onChange={(v) => set({ interests_any: v })} />
      </Field>
      <Field label="Sources d'inscription">
        <TagInput value={r.sources} onChange={(v) => set({ sources: v })} />
      </Field>
      <Field label="Pays">
        <TagInput value={r.countries} onChange={(v) => set({ countries: v })} />
      </Field>
      <Field label="Diaspora">
        <Select
          value={r.diaspora === null ? "" : String(r.diaspora)}
          onChange={(e) => set({ diaspora: e.target.value === "" ? null : e.target.value === "true" })}
          options={[
            { value: "", label: "Indifférent" },
            { value: "true", label: "Diaspora uniquement" },
            { value: "false", label: "Résidents uniquement" },
          ]}
        />
      </Field>
    </div>
  );
}

export function SegmentsList() {
  const rulesField = { render: ({ value, onChange }: { value: any; onChange: (v: any) => void }) => <RulesEditor value={value} onChange={onChange} />, span: 2 as const };
  return (
    <ResourceView
      embedded
      config={{
        title: "Segments",
        subtitle: "Audiences dynamiques recalculées à chaque envoi (seuls les abonnés confirmés sont ciblés).",
        path: "/newsletter/segments",
        columns: [
          { key: "name", label: "Segment" },
          { key: "description", label: "Description", hideOnMobile: true },
          { key: "estimated_count", label: "Audience estimée", format: "number", align: "right" },
        ],
        create: { endpoint: "POST /newsletter/segments", label: "Nouveau segment", perms: ["newsletter:write"], fields: { rules: rulesField, description: { widget: "textarea" } } },
        update: { endpoint: "PATCH /newsletter/segments/{item_id}", perms: ["newsletter:write"], fields: { rules: rulesField, description: { widget: "textarea" } } },
        remove: { path: (r) => `/newsletter/segments/${r.id}`, perms: ["newsletter:write"] },
      }}
    />
  );
}

/* ----------------------------------------------------------------------------- modèles */

function TemplateEditor({ template, onDone, onCancel }: { template?: Row; onDone: () => void; onCancel: () => void }) {
  const [v, setV] = useState({ name: template?.name ?? "", kind: template?.kind ?? "campaign", subject: "", preheader: "", html: "<h1>Bonjour {{first_name}},</h1>\n<p></p>", text: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("html");
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du modèle" required>
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} disabled={!!template} />
        </Field>
        <Field label="Usage">
          <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} options={opts(["campaign", "automation", "transactional"])} disabled={!!template} />
        </Field>
        <Field label="Objet" required>
          <Input value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} />
        </Field>
        <Field label="Pré-en-tête">
          <Input value={v.preheader} onChange={(e) => setV({ ...v, preheader: e.target.value })} />
        </Field>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "html", label: "HTML" },
          { key: "apercu", label: "Aperçu" },
          { key: "texte", label: "Version texte" },
        ]}
      />
      {tab === "html" ? <Textarea value={v.html} onChange={(e) => setV({ ...v, html: e.target.value })} rows={16} className="font-mono text-xs" /> : null}
      {tab === "apercu" ? <EmailPreview html={v.html} /> : null}
      {tab === "texte" ? <Textarea value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} rows={10} placeholder="Générée automatiquement si vide." /> : null}
      <p className="text-xs text-muted">Variables : {"{{first_name}}"}, {"{{unsubscribe_url}}"}, {"{{preferences_url}}"} — le lien de désinscription est ajouté automatiquement. Les scripts sont interdits.</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={v.name.length < 2 || v.subject.length < 2 || v.html.length < 5}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const body = { ...v, preheader: v.preheader || null, text: v.text || null };
              await api(template ? `/newsletter/templates/${template.id}/versions` : "/newsletter/templates", { method: "POST", body });
              onDone();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {template ? "Enregistrer une nouvelle version" : "Créer le modèle"}
        </Button>
      </div>
    </div>
  );
}

export function TemplatesView() {
  const { can } = useAuth();
  const templates = useApi<Row[]>("/newsletter/templates");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [preview, setPreview] = useState<{ id: string; version: number } | null>(null);
  const version = useApi<Row>(preview ? `/newsletter/templates/${preview.id}/versions/${preview.version}` : null);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {can("newsletter:write") ? (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Nouveau modèle
          </Button>
        ) : null}
      </div>
      {templates.loading && !templates.data ? (
        <Skeleton className="h-40" />
      ) : templates.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.data.map((t) => (
            <Card key={t.id}>
              <CardHeader
                title={t.name}
                subtitle={`${optionLabel(t.kind)} · version ${t.current_version}`}
                actions={
                  can("newsletter:write") ? (
                    <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>
                      Nouvelle version
                    </Button>
                  ) : null
                }
              />
              <ul className="divide-y divide-line text-sm">
                {((t.versions ?? []) as Row[])
                  .slice()
                  .sort((a, b) => b.version - a.version)
                  .map((v) => (
                    <li key={v.version} className="flex items-center justify-between gap-2 px-5 py-2">
                      <span>
                        v{v.version} · {v.subject}
                        <span className="block text-xs text-muted">{dateTime(v.created_at)}</span>
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => setPreview({ id: t.id, version: v.version })}>
                        <Eye className="h-4 w-4" /> Aperçu
                      </Button>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Aucun modèle d'e-mail" text="Créez un premier modèle pour vos campagnes et automatisations." />
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Nouveau modèle" : `Nouvelle version — ${editing?.name ?? ""}`} size="xl">
        {editing ? (
          <TemplateEditor
            template={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              void templates.reload();
            }}
          />
        ) : null}
      </Modal>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={version.data ? `${version.data.subject} (v${version.data.version})` : "Aperçu"} size="xl">
        {version.loading ? <Skeleton className="h-96" /> : version.data ? <EmailPreview html={version.data.html} height={600} /> : <Alert tone="danger">{version.error}</Alert>}
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- campagnes */

function CampaignCreate({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const templates = useApi<Row[]>("/newsletter/templates");
  const [v, setV] = useState<{ name: string; subject: string; template_id: string; template_version: string; segment_ids: string[]; utm_campaign: string }>({ name: "", subject: "", template_id: "", template_version: "", segment_ids: [], utm_campaign: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tpl = templates.data?.find((t) => t.id === v.template_id);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom interne" required>
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="Objet de l'e-mail" required>
          <Input value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} />
        </Field>
        <Field label="Modèle" required>
          <Select value={v.template_id} onChange={(e) => setV({ ...v, template_id: e.target.value, template_version: "" })} options={[{ value: "", label: "Choisir…" }, ...(templates.data ?? []).filter((t) => t.kind !== "transactional").map((t) => ({ value: t.id, label: t.name }))]} />
        </Field>
        <Field label="Version" help="Par défaut, la version courante au moment de l'envoi.">
          <Select value={v.template_version} onChange={(e) => setV({ ...v, template_version: e.target.value })} options={[{ value: "", label: "Version courante" }, ...((tpl?.versions ?? []) as Row[]).map((x) => ({ value: String(x.version), label: `v${x.version} — ${x.subject}` }))]} />
        </Field>
        <Field label="Segments" help="Aucun segment = tous les abonnés confirmés." className="sm:col-span-2">
          <MultiRefSelect source={REFS.segments} value={v.segment_ids} onChange={(ids) => setV({ ...v, segment_ids: ids })} />
        </Field>
        <Field label="Campagne UTM">
          <Input value={v.utm_campaign} onChange={(e) => setV({ ...v, utm_campaign: e.target.value })} placeholder="newsletter-2026-10" />
        </Field>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={!v.name || !v.subject || !v.template_id}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api("/newsletter/campaigns", { method: "POST", body: { ...v, template_version: v.template_version ? Number(v.template_version) : null, utm_campaign: v.utm_campaign || null } });
              onDone();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer la campagne
        </Button>
      </div>
    </div>
  );
}

function CampaignPanel({ campaign, reload }: { campaign: Row; reload: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [dialog, setDialog] = useState<null | "send" | "schedule" | "cancel">(null);
  const [when, setWhen] = useState(toInputDateTime(new Date(Date.now() + 3600000).toISOString()));
  const s = (campaign.stats ?? {}) as Row;
  const editable = ["draft", "scheduled"].includes(campaign.status);
  return (
    <div className="space-y-4">
      <DescriptionList
        items={[
          { label: "Objet", value: campaign.subject },
          { label: "Statut", value: <StatusBadge status={campaign.status} /> },
          { label: "Audience estimée", value: number(campaign.estimated_audience ?? 0) },
          { label: "Programmée", value: campaign.scheduled_at ? dateTime(campaign.scheduled_at) : "—" },
          { label: "Envoyée le", value: campaign.sent_at ? dateTime(campaign.sent_at) : "—" },
          { label: "UTM", value: campaign.utm_campaign ?? "—" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Délivrés" value={number(s.delivered ?? 0)} hint={`${number(s.sent ?? 0)} envoyés`} />
        <Stat label="Ouvertures uniques" value={percent(s.open_rate ?? 0, 1)} hint={number(s.unique_opens ?? 0)} tone="info" />
        <Stat label="Clics uniques" value={percent(s.click_rate ?? 0, 1)} hint={number(s.unique_clicks ?? 0)} tone="success" />
        <Stat label="Désinscriptions" value={percent(s.unsubscribe_rate ?? 0, 2)} hint={`Rebonds ${percent(s.bounce_rate ?? 0, 2)}`} tone={toNum(s.bounce_rate) > 5 ? "danger" : "neutral"} />
      </div>
      {can("newsletter:send") && editable ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setDialog("send")}>
            <Send className="h-4 w-4" /> Envoyer maintenant
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog("schedule")}>
            Programmer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog("cancel")}>
            Annuler la campagne
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={dialog === "send"}
        onClose={() => setDialog(null)}
        title="Envoyer la campagne"
        text={`Envoi immédiat à environ ${number(campaign.estimated_audience ?? 0)} abonné(s) confirmé(s). Les désinscrits et adresses en rebond sont exclus.`}
        confirmLabel="Envoyer"
        onConfirm={async () => {
          const res = await api<Row>(`/newsletter/campaigns/${campaign.id}/send`, { method: "POST" });
          toast.success("Campagne envoyée", `${number(res.sent ?? 0)} envoi(s) · ${number(res.failed ?? 0)} échec(s)`);
          reload();
        }}
      />
      <Modal
        open={dialog === "schedule"}
        onClose={() => setDialog(null)}
        title="Programmer l'envoi"
        footer={
          <Button
            onClick={async () => {
              try {
                await api(`/newsletter/campaigns/${campaign.id}/schedule`, { method: "POST", body: { scheduled_at: new Date(when).toISOString() } });
                setDialog(null);
                reload();
              } catch (err) {
                toast.error("Programmation impossible", errorMessage(err));
              }
            }}
          >
            Programmer
          </Button>
        }
      >
        <Field label="Date et heure d'envoi">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
      </Modal>
      <ConfirmDialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title="Annuler la campagne"
        tone="danger"
        onConfirm={async () => {
          await api(`/newsletter/campaigns/${campaign.id}/cancel`, { method: "POST" });
          reload();
        }}
      />
    </div>
  );
}

const toNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function CampaignsList() {
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  return (
    <>
      <ResourceView
        key={version}
        embedded
        config={{
          title: "Campagnes",
          path: "/newsletter/campaigns",
          columns: [
            { key: "name", label: "Campagne" },
            { key: "subject", label: "Objet", hideOnMobile: true },
            { key: "sent_at", label: "Envoi", render: (r) => (r.sent_at ? dateTime(r.sent_at) : r.scheduled_at ? `Programmée ${dateTime(r.scheduled_at)}` : "—") },
            { key: "stats", label: "Ouvertures", render: (r) => (r.stats?.sent ? percent(r.stats.open_rate ?? 0, 1) : "—") },
            { key: "clicks", label: "Clics", render: (r) => (r.stats?.sent ? percent(r.stats.click_rate ?? 0, 1) : "—") },
            { key: "status", label: "Statut", format: "status" },
          ],
          detailPath: (r) => `/newsletter/campaigns/${r.id}`,
          detail: (r, reload) => <CampaignPanel campaign={r} reload={reload} />,
          toolbar: can("newsletter:write") ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nouvelle campagne
            </Button>
          ) : undefined,
        }}
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle campagne" size="lg">
        <CampaignCreate
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            setVersion((x) => x + 1);
          }}
        />
      </Modal>
    </>
  );
}

/* ----------------------------------------------------------------------------- automatisations */

/** Réglage propre au déclencheur choisi : `{ days }` (inactivité) ou `{ tag }` (tag ajouté). */
function TriggerConfigEditor({ trigger, value, onChange }: { trigger: string; value: unknown; onChange: (v: Row) => void }) {
  const config: Row = value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
  if (trigger === "inactive_days")
    return (
      <Field label="Nombre de jours sans ouverture ni clic" help="Les abonnés inactifs depuis ce délai entrent dans le scénario (90 par défaut).">
        <Input type="number" min={1} step={1} value={config.days ?? ""} placeholder="90" onChange={(e) => onChange({ ...config, days: e.target.value === "" ? undefined : Number(e.target.value) })} />
      </Field>
    );
  if (trigger === "tag_added")
    return (
      <Field label="Tag déclencheur" help="Le scénario démarre quand ce tag est ajouté à un abonné.">
        <Input value={config.tag ?? ""} placeholder="Ex. salon-2026" onChange={(e) => onChange({ ...config, tag: e.target.value })} />
      </Field>
    );
  return <p className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted">{trigger ? "Aucun réglage nécessaire pour ce déclencheur." : "Choisissez d'abord le déclencheur."}</p>;
}

/** Étapes d'un scénario : `[{ delay_hours, template_id, subject? }]`, délais comptés depuis l'étape précédente. */
function StepsEditor({ value, onChange }: { value: unknown; onChange: (v: Row[]) => void }) {
  const templates = useApi<Row[]>("/newsletter/templates");
  const options = (templates.data ?? []).map((t) => ({ value: String(t.id), label: t.name }));
  const delay = (h: unknown) => {
    const hours = Number(h ?? 0);
    if (!hours) return "immédiatement";
    return hours % 24 === 0 ? `après ${hours / 24} jour(s)` : `après ${hours} h`;
  };
  return (
    <RowsEditor
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      itemLabel="Étape"
      title={(r, i) => `E-mail ${i + 1} — ${delay(r.delay_hours)}`}
      fields={[
        { key: "delay_hours", label: "Délai (heures)", type: "number", min: 0, step: 1, help: "Après l'e-mail précédent (ou l'entrée dans le scénario). 72 h = 3 jours." },
        { key: "template_id", label: "Modèle d'e-mail", type: "select", options },
        { key: "subject", label: "Objet (facultatif)", placeholder: "Sinon, celui du modèle", wide: true },
      ]}
      newRow={(rows) => ({ delay_hours: rows.length ? 72 : 0, template_id: "", subject: "" })}
      addLabel="Étape"
      empty="Aucune étape : ajoutez au moins un e-mail."
      max={20}
    />
  );
}

export function AutomationsList() {
  const fields = {
    kind: { options: opts(["welcome", "follow_up", "nurturing", "reminder", "reactivation"]) },
    trigger: { options: opts(["subscriber_confirmed", "lead_created", "lead_inactive", "tag_added", "inactive_days"]) },
    trigger_config: { span: 2 as const, label: "Réglage du déclencheur", render: ({ value, onChange, values }: { value: any; onChange: (v: any) => void; values: Row }) => <TriggerConfigEditor trigger={values.trigger ?? ""} value={value} onChange={onChange} /> },
    steps: { span: 2 as const, label: "Étapes (e-mails envoyés)", render: ({ value, onChange }: { value: any; onChange: (v: any) => void }) => <StepsEditor value={value} onChange={onChange} /> },
  };
  return (
    <ResourceView
      embedded
      config={{
        title: "Automatisations",
        subtitle: "Scénarios déclenchés (bienvenue, relance de lead, maturation des prospects par univers, réactivation).",
        path: "/newsletter/automations",
        columns: [
          { key: "name", label: "Scénario" },
          { key: "kind", label: "Type", format: "option" },
          { key: "trigger", label: "Déclencheur", format: "option" },
          { key: "steps", label: "Étapes", render: (r) => (r.steps ?? []).length },
          { key: "enrolled_count", label: "Inscrits", format: "number", align: "right" },
          { key: "is_active", label: "Actif", render: (r) => (r.is_active ? <Badge tone="success">Actif</Badge> : <Badge>Inactif</Badge>) },
        ],
        create: { endpoint: "POST /newsletter/automations", label: "Nouveau scénario", perms: ["newsletter:write"], fields, initial: { is_active: false, steps: [] } },
        update: { endpoint: "PATCH /newsletter/automations/{item_id}", perms: ["newsletter:write"], fields },
        remove: { path: (r) => `/newsletter/automations/${r.id}`, perms: ["newsletter:write"] },
      }}
    />
  );
}

export function NewsletterHub({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  return (
    <div className="space-y-5">
      <PageTitle title="Newsletter et marketing" subtitle="Abonnés consentis, segments, modèles versionnés, campagnes mesurées, automatisations." />
      <Tabs
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "campagnes", label: "Campagnes" },
          { key: "abonnes", label: "Abonnés" },
          { key: "segments", label: "Segments" },
          { key: "modeles", label: "Modèles" },
          { key: "automatisations", label: "Automatisations" },
        ]}
      />
      {tab === "campagnes" ? <CampaignsList /> : null}
      {tab === "abonnes" ? <SubscribersList /> : null}
      {tab === "segments" ? <SegmentsList /> : null}
      {tab === "modeles" ? <TemplatesView /> : null}
      {tab === "automatisations" ? <AutomationsList /> : null}
    </div>
  );
}
