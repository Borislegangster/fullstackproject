"use client";

import { Camera, CheckCircle2, MapPin, Plus, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { MultiRefSelect, RefSelect } from "@/components/forms/ref-select";
import { SchemaForm } from "@/components/forms/schema-form";
import { BarChartCard, DonutChart } from "@/components/ui/charts";
import { Checkbox, Field, FileDrop, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, PageTitle, Progress, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

const opts = (values: string[]) => values.map((v) => ({ value: v, label: optionLabel(v) }));
const INCIDENT_KINDS = ["accident", "presque_accident", "securite", "qualite", "environnement", "materiel"];
const SEVERITIES = ["low", "medium", "high", "critical"];
const INCIDENT_STATUSES = ["declared", "investigating", "action_plan", "closed"];
const ACTION_STATUSES = ["open", "in_progress", "done", "verified", "cancelled"];
const CATEGORIES = ["securite", "qualite", "environnement"];
const PPE_KINDS = ["casque", "chaussures", "gilet", "gants", "harnais", "lunettes", "masque", "bouchons"];
const severityTone = (s?: string) => (s === "critical" ? "danger" : s === "high" ? "accent" : s === "medium" ? "warning" : "neutral");

/** Téléversement de preuves QHSE (géolocalisées si le navigateur l'autorise) → identifiants de fichiers. */
async function uploadQhseFiles(files: File[]): Promise<string[]> {
  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 4000, maximumAge: 60000 });
  });
  const ids: string[] = [];
  for (const f of files) {
    const fd = new FormData();
    fd.append("file", f);
    if (position) {
      fd.append("latitude", String(position.coords.latitude));
      fd.append("longitude", String(position.coords.longitude));
    }
    ids.push((await api<{ file_id: string }>("/qhse/files", { method: "POST", form: fd })).file_id);
  }
  return ids;
}

function PhotoGrid({ ids }: { ids?: string[] }) {
  if (!ids?.length) return <p className="text-sm text-muted">Aucune photo.</p>;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {ids.map((id) => (
        <a key={id} href={apiUrl(`/qhse/files/${id}`)} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-slate-100">
          <img src={apiUrl(`/qhse/files/${id}`)} alt="Photo QHSE" className="h-full w-full object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------- tableau de bord */

export function QhseDashboard() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const stats = useApi<Row>("/qhse/statistics", { project_id: projectId ?? undefined });
  const s = stats.data;
  return (
    <div className="space-y-5">
      <div className="w-72">
        <RefSelect source={REFS.projects} value={projectId} onChange={setProjectId} placeholder="Tous les projets" />
      </div>
      {stats.loading && !s ? (
        <Skeleton className="h-64" />
      ) : stats.error ? (
        <Alert tone="danger">{stats.error}</Alert>
      ) : s ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Jours sans accident" value={s.days_without_accident ?? "—"} tone="success" icon={<ShieldAlert className="h-5 w-5" />} />
            <Stat label="Taux de fréquence" value={s.frequency_rate ?? "—"} hint="AT avec arrêt × 10⁶ / heures travaillées" />
            <Stat label="Taux de gravité" value={s.severity_rate ?? "—"} hint={`${s.lost_days ?? 0} jour(s) perdus × 10³ / heures`} />
            <Stat label="Incidents" value={s.incidents ?? 0} hint={`${s.lost_time_accidents ?? 0} accident(s) avec arrêt`} tone={toNumber(s.lost_time_accidents) ? "danger" : "neutral"} />
            <Stat label="Actions correctives" value={s.actions_open ?? 0} hint={`${s.actions_overdue ?? 0} en retard`} tone={toNumber(s.actions_overdue) ? "danger" : "neutral"} />
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Incidents par mois" subtitle={`${number(s.hours_worked ?? 0)} heures travaillées sur la période`} />
              <div className="p-4">
                <BarChartCard data={Object.entries((s.by_month ?? {}) as Record<string, number>).map(([month, count]) => ({ month, count: toNumber(count) }))} x="month" series={[{ key: "count", label: "Incidents", color: "#dc2626" }]} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Par nature" />
              <div className="p-4">
                <DonutChart data={Object.entries((s.by_kind ?? {}) as Record<string, number>).map(([k, v]) => ({ name: optionLabel(k), value: toNumber(v) }))} />
              </div>
            </Card>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Inspections" value={s.inspections ?? 0} hint={s.inspection_avg_score !== null && s.inspection_avg_score !== undefined ? `Score moyen ${number(s.inspection_avg_score, 1)} / 100` : undefined} />
            <Stat label="Quarts d'heure sécurité" value={s.safety_talks ?? 0} hint={`${s.safety_talk_attendees ?? 0} participant(s)`} />
            <Stat label="Actions vérifiées" value={s.actions_verified ?? 0} tone="success" />
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------- incidents */

function IncidentDeclare({ onDone, onCancel }: { onDone: (i: Row) => void; onCancel: () => void }) {
  const [v, setV] = useState({ project_id: null as string | null, site_id: null as string | null, zone_id: null as string | null, kind: "securite", severity: "medium", occurred_at: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), location: "", title: "", description: "", injuries: "", lost_time_days: "0", immediate_actions: "" });
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Projet" required>
          <RefSelect source={REFS.projects} value={v.project_id} onChange={(id) => setV({ ...v, project_id: id, site_id: null, zone_id: null })} />
        </Field>
        <Field label="Site">
          <RefSelect key={v.project_id ?? "none"} source={REFS.sites} value={v.site_id} onChange={(id) => setV({ ...v, site_id: id })} context={{ project_id: v.project_id }} />
        </Field>
        {v.project_id ? (
          <Field label="Zone de la maquette" help="Pièce ou zone de la maquette BIM concernée (facultatif).">
            <RefSelect key={`zone-${v.project_id}`} source={REFS.zones} value={v.zone_id} onChange={(id) => setV({ ...v, zone_id: id })} context={{ project_id: v.project_id }} />
          </Field>
        ) : null}
        <Field label="Nature" required>
          <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} options={opts(INCIDENT_KINDS)} />
        </Field>
        <Field label="Gravité" required>
          <Select value={v.severity} onChange={(e) => setV({ ...v, severity: e.target.value })} options={opts(SEVERITIES)} />
        </Field>
        <Field label="Survenu le" required>
          <Input type="datetime-local" value={v.occurred_at} onChange={(e) => setV({ ...v, occurred_at: e.target.value })} />
        </Field>
        <Field label="Lieu précis">
          <div className="flex gap-2">
            <Input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="Niveau R+2, cage d'escalier…" />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigator.geolocation?.getCurrentPosition((p) => setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }))}
              title="Utiliser ma position"
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
          {coords ? <p className="mt-1 text-xs text-muted">Position : {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</p> : null}
        </Field>
        <Field label="Titre" required className="sm:col-span-2">
          <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field label="Description des faits" className="sm:col-span-2">
          <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={3} />
        </Field>
        <Field label="Blessures">
          <Textarea value={v.injuries} onChange={(e) => setV({ ...v, injuries: e.target.value })} rows={2} />
        </Field>
        <Field label="Jours d'arrêt">
          <Input type="number" min={0} value={v.lost_time_days} onChange={(e) => setV({ ...v, lost_time_days: e.target.value })} />
        </Field>
        <Field label="Mesures immédiates" className="sm:col-span-2">
          <Textarea value={v.immediate_actions} onChange={(e) => setV({ ...v, immediate_actions: e.target.value })} rows={2} />
        </Field>
      </div>
      <Field label="Photos">
        <FileDrop files={photos} onChange={setPhotos} multiple accept="image/*" capture="environment" maxSizeMb={20} />
      </Field>
      {v.severity === "critical" || v.kind === "accident" ? <Alert tone="danger">Un incident critique ou un accident alerte immédiatement la direction et le responsable QHSE.</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={!v.project_id || v.title.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const photo_file_ids = photos.length ? await uploadQhseFiles(photos) : [];
              const incident = await api<Row>("/qhse/incidents", {
                method: "POST",
                idempotent: true,
                body: {
                  project_id: v.project_id,
                  site_id: v.site_id,
                  zone_id: v.zone_id,
                  kind: v.kind,
                  severity: v.severity,
                  occurred_at: new Date(v.occurred_at).toISOString(),
                  location: v.location || null,
                  latitude: coords?.latitude ?? null,
                  longitude: coords?.longitude ?? null,
                  title: v.title.trim(),
                  description: v.description || null,
                  injuries: v.injuries || null,
                  lost_time_days: toNumber(v.lost_time_days),
                  immediate_actions: v.immediate_actions || null,
                  photo_file_ids,
                  source: "web",
                },
              });
              onDone(incident);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Déclarer l'incident
        </Button>
      </div>
    </div>
  );
}

export function IncidentsList({ projectId }: { projectId?: string }) {
  const { canAny } = useAuth();
  const router = useRouter();
  const [declaring, setDeclaring] = useState(false);
  return (
    <>
      <ResourceView
        embedded
        config={{
          title: "Incidents",
          subtitle: "Déclaration terrain (photos géolocalisées) → enquête → plan d'actions → clôture vérifiée.",
          path: "/qhse/incidents",
          query: { project_id: projectId },
          href: (r) => `/erp/qhse/incidents/${r.id}`,
          exportDataset: "incidents",
          columns: [
            { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/qhse/incidents/${r.id}`}>{r.number}</CellLink> },
            { key: "title", label: "Incident" },
            { key: "kind", label: "Nature", format: "option" },
            { key: "severity", label: "Gravité", render: (r) => <Badge tone={severityTone(r.severity)}>{optionLabel(r.severity)}</Badge> },
            { key: "occurred_at", label: "Survenu le", format: "datetime" },
            { key: "lost_time_days", label: "Arrêt (j)", format: "number", hideOnMobile: true },
            { key: "status", label: "Statut", format: "status" },
          ],
          filters: [
            { key: "status", label: "Statut", options: opts(INCIDENT_STATUSES) },
            { key: "severity", label: "Gravité", options: opts(SEVERITIES) },
            { key: "kind", label: "Nature", options: opts(INCIDENT_KINDS) },
          ],
          toolbar: canAny("qhse:write", "site:report") ? (
            <Button size="sm" variant="accent" onClick={() => setDeclaring(true)}>
              <ShieldAlert className="h-4 w-4" /> Déclarer un incident
            </Button>
          ) : undefined,
        }}
      />
      <Modal open={declaring} onClose={() => setDeclaring(false)} title="Déclaration d'incident" size="xl">
        <IncidentDeclare onCancel={() => setDeclaring(false)} onDone={(i) => router.push(`/erp/qhse/incidents/${i.id}`)} />
      </Modal>
    </>
  );
}

export function IncidentDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const incident = useApi<Row>(`/qhse/incidents/${id}`);
  const [dialog, setDialog] = useState<null | "investigation" | "action" | "photos" | "close" | "publish">(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  if (incident.loading && !incident.data) return <Skeleton className="h-96 w-full" />;
  if (!incident.data) return <Alert tone="danger">{incident.error}</Alert>;
  const i = incident.data;
  const actions = (i.actions ?? []) as Row[];
  const write = can("qhse:write");
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/qhse?onglet=incidents" className="hover:underline">Incidents</Link>}
        title={`${i.number} — ${i.title}`}
        subtitle={`${optionLabel(i.kind)} · survenu le ${dateTime(i.occurred_at)}${i.location ? ` · ${i.location}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={severityTone(i.severity)}>{optionLabel(i.severity)}</Badge>
            <StatusBadge status={i.status} />
            {write && i.status !== "closed" ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setDialog("photos")}>
                  <Camera className="h-4 w-4" /> Photos
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("investigation")}>
                  Analyse des causes
                </Button>
                <Button size="sm" onClick={() => setDialog("action")}>
                  <Plus className="h-4 w-4" /> Action corrective
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDialog("close")}>
                  Clôturer
                </Button>
              </>
            ) : null}
            {write && !i.published_to_client ? (
              <Button size="sm" variant="ghost" onClick={() => setDialog("publish")}>
                Informer le client
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <DescriptionList
              columns={2}
              items={[
                { label: "Blessures", value: i.injuries ?? "Aucune" },
                { label: "Jours d'arrêt", value: i.lost_time_days ?? 0 },
                { label: "Mesures immédiates", value: i.immediate_actions },
                { label: "Coordonnées", value: i.latitude ? `${Number(i.latitude).toFixed(5)}, ${Number(i.longitude).toFixed(5)}` : "—" },
                { label: "Source", value: optionLabel(i.source) },
                { label: "Clôturé le", value: i.closed_at ? dateTime(i.closed_at) : "—" },
              ]}
            />
            {i.description ? <p className="mt-4 whitespace-pre-line text-sm">{i.description}</p> : null}
          </Card>
          <Card>
            <CardHeader title="Analyse des causes" />
            <div className="p-5 text-sm">{i.root_cause ? <p className="whitespace-pre-line">{i.root_cause}</p> : <p className="text-muted">Analyse à réaliser (obligatoire avant clôture).</p>}</div>
          </Card>
          <Card>
            <CardHeader title="Plan d'actions correctives" subtitle="Chaque action est réalisée avec preuve, puis vérifiée par une autre personne." />
            <ul className="divide-y divide-line text-sm">
              {actions.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                  <span>
                    <CellLink href={`/erp/qhse/actions/${a.id}`}>{a.number}</CellLink> {a.title}
                    <span className="block text-xs text-muted">Échéance {date(a.due_date)}</span>
                  </span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
              {!actions.length ? <li className="px-5 py-3 text-muted">Aucune action.</li> : null}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase text-muted">Photos</p>
            <PhotoGrid ids={i.photo_file_ids} />
          </Card>
          {((i.people_involved ?? []) as Row[]).length ? (
            <Card className="p-5">
              <p className="mb-2 text-xs font-semibold uppercase text-muted">Personnes impliquées</p>
              <ul className="space-y-1 text-sm">
                {(i.people_involved as Row[]).map((p, k) => (
                  <li key={k}>{[p.name, p.role, p.company].filter(Boolean).join(" · ")}</li>
                ))}
              </ul>
            </Card>
          ) : null}
          {i.published_to_client ? (
            <Alert tone="info" title="Communiqué au client">
              {i.client_summary}
            </Alert>
          ) : null}
        </div>
      </div>

      <Modal open={dialog === "investigation"} onClose={() => setDialog(null)} title="Analyse des causes">
        <SchemaForm endpoint="POST /qhse/incidents/{incident_id}/investigation" params={{ incident_id: id }} initial={{ root_cause: i.root_cause, immediate_actions: i.immediate_actions, lost_time_days: i.lost_time_days }} fields={{ root_cause: { widget: "textarea", help: "Méthode des 5 pourquoi, arbre des causes…" }, immediate_actions: { widget: "textarea" } }} onCancel={() => setDialog(null)} onSuccess={(res: Row) => { incident.setData({ ...i, ...res }); setDialog(null); }} columns={1} />
      </Modal>
      <Modal open={dialog === "action"} onClose={() => setDialog(null)} title="Nouvelle action corrective">
        <SchemaForm
          endpoint="POST /qhse/actions"
          fixed={{ project_id: i.project_id, source_type: "incident", source_id: id }}
          exclude={["project_id", "source_type", "source_id"]}
          fields={{ responsible_id: { ref: "users", label: "Responsable" }, description: { widget: "textarea" } }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            void incident.reload();
          }}
          columns={1}
        />
      </Modal>
      <Modal
        open={dialog === "photos"}
        onClose={() => setDialog(null)}
        title="Ajouter des photos"
        footer={
          <Button
            loading={busy}
            disabled={!photos.length}
            onClick={async () => {
              setBusy(true);
              try {
                const file_ids = await uploadQhseFiles(photos);
                await api(`/qhse/incidents/${id}/photos`, { method: "POST", body: { file_ids } });
                setPhotos([]);
                setDialog(null);
                void incident.reload();
              } catch (err) {
                toast.error("Envoi impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Envoyer
          </Button>
        }
      >
        <FileDrop files={photos} onChange={setPhotos} multiple accept="image/*" capture="environment" maxSizeMb={20} />
      </Modal>
      <ConfirmDialog
        open={dialog === "close"}
        onClose={() => setDialog(null)}
        title="Clôturer l'incident"
        text="Exige l'analyse des causes et la vérification de toutes les actions correctives."
        onConfirm={async () => {
          incident.setData({ ...i, ...(await api<Row>(`/qhse/incidents/${id}/close`, { method: "POST" })) });
        }}
      />
      <Modal open={dialog === "publish"} onClose={() => setDialog(null)} title="Informer le client">
        <SchemaForm endpoint="POST /qhse/incidents/{incident_id}/publish-client" params={{ incident_id: id }} fields={{ client_summary: { widget: "textarea", help: "Message factuel visible dans l'espace client (sans données personnelles)." } }} onCancel={() => setDialog(null)} onSuccess={() => { setDialog(null); void incident.reload(); toast.success("Information publiée dans l'espace client"); }} columns={1} />
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- inspections */

interface CheckRow {
  key: string;
  label: string;
  weight: number;
  status: "ok" | "nok" | "na" | "";
  comment: string;
  photo_file_id: string | null;
}

function InspectionRunner({ inspection, onDone }: { inspection: Row; onDone: (r: Row) => void }) {
  const template = useApi<Row>(inspection.template_id ? `/qhse/inspection-templates/${inspection.template_id}` : null);
  const base: Row[] = (inspection.results?.length ? inspection.results : template.data?.checklist) ?? [];
  const [rows, setRows] = useState<CheckRow[] | null>(null);
  const [findings, setFindings] = useState(inspection.findings ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current: CheckRow[] = rows ?? base.map((c) => ({ key: c.key, label: c.label ?? c.key, weight: toNumber(c.weight) || 1, status: (c.status ?? "") as CheckRow["status"], comment: c.comment ?? "", photo_file_id: c.photo_file_id ?? null }));
  const set = (k: number, patch: Partial<CheckRow>) => setRows(current.map((r, j) => (j === k ? { ...r, ...patch } : r)));
  if (template.loading && !base.length) return <Skeleton className="h-40" />;
  return (
    <div className="space-y-3">
      {current.map((r, k) => (
        <div key={r.key} className={`rounded-xl border p-3 ${r.status === "nok" ? "border-red-300 bg-red-50/50" : "border-line"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {r.label} <span className="text-xs text-muted">(poids {r.weight})</span>
            </p>
            <div className="flex gap-1">
              {(["ok", "nok", "na"] as const).map((s) => (
                <button key={s} type="button" onClick={() => set(k, { status: s })} className={`rounded-lg px-3 py-1 text-xs font-semibold ring-1 ${r.status === s ? (s === "ok" ? "bg-emerald-600 text-white ring-emerald-600" : s === "nok" ? "bg-red-600 text-white ring-red-600" : "bg-slate-600 text-white ring-slate-600") : "bg-white ring-line"}`}>
                  {s === "ok" ? "Conforme" : s === "nok" ? "Non conforme" : "N/A"}
                </button>
              ))}
            </div>
          </div>
          {r.status === "nok" ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input value={r.comment} onChange={(e) => set(k, { comment: e.target.value })} placeholder="Constat (une action corrective est créée automatiquement)" />
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-semibold text-brand-600 ring-1 ring-brand-200">
                <Camera className="h-4 w-4" /> {r.photo_file_id ? "Photo ✓" : "Photo"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const [fid] = await uploadQhseFiles([f]);
                      set(k, { photo_file_id: fid });
                    } catch (err) {
                      setError(errorMessage(err));
                    }
                  }}
                />
              </label>
            </div>
          ) : null}
        </div>
      ))}
      {!current.length ? <Alert tone="warning">Aucune grille : choisissez un modèle d'inspection.</Alert> : null}
      <Field label="Constats généraux">
        <Textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={3} />
      </Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end">
        <Button
          loading={busy}
          disabled={!current.length || current.some((r) => !r.status)}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const res = await api<Row>(`/qhse/inspections/${inspection.id}/complete`, {
                method: "POST",
                body: { results: current.map((r) => ({ key: r.key, label: r.label, weight: r.weight, status: r.status, comment: r.comment || null, photo_file_id: r.photo_file_id })), findings: findings || null },
              });
              onDone(res);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <CheckCircle2 className="h-4 w-4" /> Terminer l'inspection
        </Button>
      </div>
    </div>
  );
}

function InspectionPanel({ inspection, reload }: { inspection: Row; reload: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [closing, setClosing] = useState(false);
  return (
    <div className="space-y-4">
      <DescriptionList
        items={[
          { label: "Catégorie", value: optionLabel(inspection.category) },
          { label: "Date", value: date(inspection.inspection_date) },
          { label: "Statut", value: <StatusBadge status={inspection.status} /> },
          { label: "Score", value: inspection.score !== null && inspection.score !== undefined ? `${number(inspection.score, 1)} / 100` : "—" },
        ]}
      />
      {inspection.score !== null && inspection.score !== undefined ? <Progress value={toNumber(inspection.score)} tone={toNumber(inspection.score) >= 80 ? "success" : toNumber(inspection.score) >= 60 ? "accent" : "danger"} /> : null}
      {inspection.status === "draft" && can("qhse:write") ? (
        <InspectionRunner inspection={inspection} onDone={() => { toast.success("Inspection terminée", "Les non-conformités ont généré des actions correctives."); reload(); }} />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {((inspection.results ?? []) as Row[]).map((r) => (
            <li key={r.key} className="flex items-start justify-between gap-2 px-3 py-2">
              <span>
                {r.label}
                {r.comment ? <span className="block text-xs text-muted">{r.comment}</span> : null}
              </span>
              <Badge tone={r.status === "ok" ? "success" : r.status === "nok" ? "danger" : "neutral"}>{r.status === "ok" ? "Conforme" : r.status === "nok" ? "Non conforme" : "N/A"}</Badge>
            </li>
          ))}
        </ul>
      )}
      {inspection.findings && inspection.status !== "draft" ? <p className="whitespace-pre-line text-sm">{inspection.findings}</p> : null}
      {inspection.status === "completed" && can("qhse:write") ? (
        <Button size="sm" variant="secondary" onClick={() => setClosing(true)}>
          Clôturer l'inspection
        </Button>
      ) : null}
      <ConfirmDialog
        open={closing}
        onClose={() => setClosing(false)}
        title="Clôturer l'inspection"
        text="Toutes les actions correctives issues de l'inspection doivent être vérifiées."
        onConfirm={async () => {
          await api(`/qhse/inspections/${inspection.id}/close`, { method: "POST" });
          reload();
        }}
      />
    </div>
  );
}

export function InspectionsList({ projectId }: { projectId?: string }) {
  return (
    <ResourceView
      embedded
      config={{
        title: "Inspections",
        subtitle: "Grilles pondérées sécurité, qualité, environnement ; non-conformités → actions automatiques.",
        path: "/qhse/inspections",
        query: { project_id: projectId },
        columns: [
          { key: "number", label: "N°" },
          { key: "category", label: "Catégorie", format: "option" },
          { key: "inspection_date", label: "Date", format: "date" },
          { key: "score", label: "Score", render: (r) => (r.score !== null && r.score !== undefined ? <Progress value={toNumber(r.score)} className="w-24" label={number(r.score, 1)} /> : "—") },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [
          { key: "status", label: "Statut", options: opts(["draft", "completed", "closed"]) },
          { key: "category", label: "Catégorie", options: opts(CATEGORIES) },
        ],
        create: { endpoint: "POST /qhse/inspections", label: "Nouvelle inspection", perms: ["qhse:write"], fixed: projectId ? { project_id: projectId } : undefined, initial: { category: "securite", inspection_date: new Date().toISOString().slice(0, 10) }, fields: { category: { options: opts(CATEGORIES) }, template_id: { ref: "inspectionTemplates", label: "Grille" } } },
        detailPath: (r) => `/qhse/inspections/${r.id}`,
        detail: (r, reload) => <InspectionPanel inspection={r} reload={reload} />,
      }}
    />
  );
}

interface ChecklistRow {
  key: string;
  label: string;
  weight: number;
}

function ChecklistEditor({ value, onChange }: { value: ChecklistRow[] | null | undefined; onChange: (v: ChecklistRow[]) => void }) {
  const rows = Array.isArray(value) ? value : [];
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[8rem_1fr_5rem_auto] gap-2">
          <Input value={r.key} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, key: e.target.value.replace(/\s+/g, "_").toLowerCase() } : x)))} placeholder="clé" />
          <Input value={r.label} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Point de contrôle" />
          <Input type="number" min={0} max={10} value={r.weight} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, weight: toNumber(e.target.value) } : x)))} />
          <button type="button" aria-label="Retirer" className="rounded p-1.5 text-muted hover:text-red-600" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...rows, { key: `point_${rows.length + 1}`, label: "", weight: 1 }])}>
        <Plus className="h-4 w-4" /> Point de contrôle
      </Button>
    </div>
  );
}

export function InspectionTemplatesList() {
  const checklist = { render: ({ value, onChange }: { value: any; onChange: (v: any) => void }) => <ChecklistEditor value={value} onChange={onChange} />, span: 2 as const };
  return (
    <ResourceView
      embedded
      config={{
        title: "Grilles d'inspection",
        path: "/qhse/inspection-templates",
        columns: [
          { key: "name", label: "Grille" },
          { key: "category", label: "Catégorie", format: "option" },
          { key: "checklist", label: "Points", render: (r) => (r.checklist ?? []).length },
          { key: "is_active", label: "Active", format: "bool" },
        ],
        create: { endpoint: "POST /qhse/inspection-templates", label: "Nouvelle grille", perms: ["qhse:write"], initial: { category: "securite", checklist: [] }, fields: { category: { options: opts(CATEGORIES) }, checklist } },
        update: { endpoint: "PATCH /qhse/inspection-templates/{item_id}", perms: ["qhse:write"], fields: { category: { options: opts(CATEGORIES) }, checklist } },
      }}
    />
  );
}

/* ----------------------------------------------------------------------------- actions correctives */

export function ActionsList() {
  const [mine, setMine] = useState(false);
  const [overdue, setOverdue] = useState(false);
  return (
    <ResourceView
      embedded
      config={{
        title: "Actions correctives",
        path: "/qhse/actions",
        query: { mine: mine || undefined, overdue: overdue || undefined },
        href: (r) => `/erp/qhse/actions/${r.id}`,
        columns: [
          { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/qhse/actions/${r.id}`}>{r.number}</CellLink> },
          { key: "title", label: "Action" },
          { key: "source_type", label: "Origine", format: "option" },
          { key: "due_date", label: "Échéance", render: (r) => <span className={r.due_date && new Date(r.due_date).getTime() < Date.now() && ["open", "in_progress"].includes(r.status) ? "font-semibold text-red-600" : ""}>{date(r.due_date)}</span> },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: opts(ACTION_STATUSES) }],
        toolbar: (
          <div className="flex flex-wrap gap-3">
            <Checkbox label="Mes actions" checked={mine} onChange={setMine} />
            <Checkbox label="En retard" checked={overdue} onChange={setOverdue} />
          </div>
        ),
        create: { endpoint: "POST /qhse/actions", label: "Nouvelle action", perms: ["qhse:write"], initial: { source_type: "other" }, fields: { source_type: { options: opts(["incident", "inspection", "audit", "other"]) }, source_id: { hidden: true }, responsible_id: { ref: "users", label: "Responsable" }, description: { widget: "textarea" } } },
      }}
    />
  );
}

export function ActionDetail({ id }: { id: string }) {
  const { can, user } = useAuth();
  const toast = useToast();
  const action = useApi<Row>(`/qhse/actions/${id}`);
  const [dialog, setDialog] = useState<null | "complete" | "verify" | "cancel">(null);
  const [evidence, setEvidence] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [verify, setVerify] = useState({ accept: true, comment: "" });
  const [busy, setBusy] = useState(false);
  if (action.loading && !action.data) return <Skeleton className="h-72 w-full" />;
  if (!action.data) return <Alert tone="danger">{action.error}</Alert>;
  const a = action.data;
  const responsible = !!user && a.responsible_id === user.id;
  const canAct = responsible || can("qhse:write");
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/qhse?onglet=actions" className="hover:underline">Actions correctives</Link>}
        title={`${a.number} — ${a.title}`}
        subtitle={a.source ? `Issue de ${optionLabel(a.source.type)} ${a.source.number}${a.source.title ? ` · ${a.source.title}` : ""}` : optionLabel(a.source_type)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={a.status} />
            {canAct && a.status === "open" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    action.setData({ ...a, ...(await api<Row>(`/qhse/actions/${id}/start`, { method: "POST" })) });
                  } catch (err) {
                    toast.error("Action impossible", errorMessage(err));
                  }
                }}
              >
                Démarrer
              </Button>
            ) : null}
            {canAct && ["open", "in_progress"].includes(a.status) ? (
              <Button size="sm" onClick={() => setDialog("complete")}>
                Déclarer réalisée
              </Button>
            ) : null}
            {can("qhse:write") && a.status === "done" && !responsible ? (
              <Button size="sm" variant="accent" onClick={() => setDialog("verify")}>
                Vérifier
              </Button>
            ) : null}
            {can("qhse:write") && ["open", "in_progress"].includes(a.status) ? (
              <Button size="sm" variant="ghost" onClick={() => setDialog("cancel")}>
                Annuler
              </Button>
            ) : null}
          </div>
        }
      />
      {a.source?.type === "incident" ? (
        <Link href={`/erp/qhse/incidents/${a.source.id}`} className="text-sm text-brand-600 hover:underline">
          Voir l'incident {a.source.number}
        </Link>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Échéance" value={date(a.due_date)} tone={a.due_date && new Date(a.due_date).getTime() < Date.now() && ["open", "in_progress"].includes(a.status) ? "danger" : "neutral"} />
        <Stat label="Réalisée le" value={a.completed_at ? dateTime(a.completed_at) : "—"} />
        <Stat label="Vérifiée le" value={a.verified_at ? dateTime(a.verified_at) : "—"} tone={a.verified_at ? "success" : "neutral"} />
      </div>
      {a.description ? <Card className="whitespace-pre-line p-5 text-sm">{a.description}</Card> : null}
      {a.closure_note || (a.closure_evidence_file_ids ?? []).length ? (
        <Card className="space-y-3 p-5">
          <p className="text-xs font-semibold uppercase text-muted">Preuves de réalisation</p>
          {a.closure_note ? <p className="text-sm">{a.closure_note}</p> : null}
          <PhotoGrid ids={a.closure_evidence_file_ids} />
        </Card>
      ) : null}

      <Modal
        open={dialog === "complete"}
        onClose={() => setDialog(null)}
        title="Déclarer l'action réalisée"
        footer={
          <Button
            loading={busy}
            disabled={note.trim().length < 5 || !evidence.length}
            onClick={async () => {
              setBusy(true);
              try {
                const evidence_file_ids = await uploadQhseFiles(evidence);
                action.setData({ ...a, ...(await api<Row>(`/qhse/actions/${id}/complete`, { method: "POST", body: { note: note.trim(), evidence_file_ids } })) });
                setDialog(null);
                setEvidence([]);
                void action.reload();
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
          <Field label="Compte rendu" required>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </Field>
          <Field label="Preuves (photos, PV)" required>
            <FileDrop files={evidence} onChange={setEvidence} multiple accept="image/*,.pdf" capture="environment" maxSizeMb={20} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={dialog === "verify"}
        onClose={() => setDialog(null)}
        title="Vérification de l'efficacité"
        footer={
          <Button
            onClick={async () => {
              try {
                action.setData({ ...a, ...(await api<Row>(`/qhse/actions/${id}/verify`, { method: "POST", body: { accept: verify.accept, comment: verify.comment || null } })) });
                setDialog(null);
              } catch (err) {
                toast.error("Vérification impossible", errorMessage(err));
              }
            }}
          >
            Valider la vérification
          </Button>
        }
      >
        <div className="space-y-3">
          <Select value={verify.accept ? "yes" : "no"} onChange={(e) => setVerify({ ...verify, accept: e.target.value === "yes" })} options={[{ value: "yes", label: "Efficace : action vérifiée" }, { value: "no", label: "Insuffisante : renvoyer au responsable" }]} aria-label="Décision" />
          <Textarea value={verify.comment} onChange={(e) => setVerify({ ...verify, comment: e.target.value })} rows={3} placeholder="Commentaire" />
        </div>
      </Modal>
      <ConfirmDialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title="Annuler l'action"
        reasonLabel="Motif d'annulation"
        tone="danger"
        onConfirm={async (reason) => {
          action.setData({ ...a, ...(await api<Row>(`/qhse/actions/${id}/cancel`, { method: "POST", body: { accept: false, comment: reason } })) });
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------------- EPI, quarts d'heure */

export function PpeView() {
  const [dueOnly, setDueOnly] = useState(false);
  return (
    <div className="space-y-8">
      <ResourceView
        embedded
        config={{
          title: "Distributions d'EPI",
          subtitle: "Remise tracée (signature), date de renouvellement, retour.",
          path: "/qhse/ppe-distributions",
          query: { due_only: dueOnly || undefined },
          columns: [
            { key: "distributed_at", label: "Remis le", format: "date" },
            { key: "worker_name", label: "Bénéficiaire", render: (r) => r.employee_name ?? r.worker_name ?? "—" },
            { key: "ppe_item_name", label: "EPI", render: (r) => r.ppe_item_name ?? "—" },
            { key: "quantity", label: "Qté", format: "number" },
            { key: "expected_replacement", label: "Renouvellement", render: (r) => <span className={r.expected_replacement && new Date(r.expected_replacement).getTime() < Date.now() && !r.returned_at ? "font-semibold text-red-600" : ""}>{date(r.expected_replacement)}</span> },
            { key: "returned_at", label: "Retour", format: "date" },
          ],
          toolbar: <Checkbox label="À renouveler" checked={dueOnly} onChange={setDueOnly} />,
          create: { endpoint: "POST /qhse/ppe-distributions", label: "Remettre un EPI", perms: ["qhse:write"], initial: { quantity: 1, distributed_at: new Date().toISOString().slice(0, 10) }, fields: { ppe_item_id: { ref: "ppeItems", label: "EPI" }, signature_file_id: { hidden: true } } },
          actions: [{ key: "return", label: "Retour", path: (r) => `/qhse/ppe-distributions/${r.id}/return`, when: (r) => !r.returned_at, perms: ["qhse:write"], confirm: "Enregistrer le retour de cet EPI ?", success: "Retour enregistré" }],
        }}
      />
      <ResourceView
        embedded
        config={{
          title: "Catalogue EPI",
          path: "/qhse/ppe-items",
          columns: [
            { key: "name", label: "EPI" },
            { key: "kind", label: "Type", format: "option" },
            { key: "norm", label: "Norme" },
            { key: "lifespan_days", label: "Durée de vie (j)", format: "number" },
            { key: "is_active", label: "Actif", format: "bool" },
          ],
          filters: [{ key: "kind", label: "Type", options: opts(PPE_KINDS) }],
          create: { endpoint: "POST /qhse/ppe-items", label: "Nouvel EPI", perms: ["qhse:write"], fields: { kind: { options: opts(PPE_KINDS) } } },
          update: { endpoint: "PATCH /qhse/ppe-items/{item_id}", perms: ["qhse:write"], fields: { kind: { options: opts(PPE_KINDS) } } },
          remove: { path: (r) => `/qhse/ppe-items/${r.id}`, perms: ["qhse:write"] },
        }}
      />
    </div>
  );
}

function SafetyTalkForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [v, setV] = useState({ project_id: null as string | null, site_id: null as string | null, talk_date: new Date().toISOString().slice(0, 10), topic: "", content: "", duration_minutes: "15" });
  const [employees, setEmployees] = useState<string[]>([]);
  const [externals, setExternals] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = externals.split("\n").map((n) => n.trim()).filter(Boolean);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Projet" required>
          <RefSelect source={REFS.projects} value={v.project_id} onChange={(id) => setV({ ...v, project_id: id, site_id: null })} />
        </Field>
        <Field label="Site">
          <RefSelect key={v.project_id ?? "none"} source={REFS.sites} value={v.site_id} onChange={(id) => setV({ ...v, site_id: id })} context={{ project_id: v.project_id }} />
        </Field>
        <Field label="Date">
          <Input type="date" value={v.talk_date} onChange={(e) => setV({ ...v, talk_date: e.target.value })} />
        </Field>
        <Field label="Durée (min)">
          <Input type="number" min={5} max={240} value={v.duration_minutes} onChange={(e) => setV({ ...v, duration_minutes: e.target.value })} />
        </Field>
        <Field label="Thème" required className="sm:col-span-2">
          <Input value={v.topic} onChange={(e) => setV({ ...v, topic: e.target.value })} placeholder="Travail en hauteur, port du harnais…" />
        </Field>
        <Field label="Contenu" className="sm:col-span-2">
          <Textarea value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} rows={3} />
        </Field>
        <Field label="Participants (salariés)" className="sm:col-span-2">
          <MultiRefSelect source={REFS.employees} value={employees} onChange={setEmployees} />
        </Field>
        <Field label="Autres participants (un par ligne : intérimaires, sous-traitants)" className="sm:col-span-2">
          <Textarea value={externals} onChange={(e) => setExternals(e.target.value)} rows={2} />
        </Field>
      </div>
      <Field label="Photos (feuille d'émargement, séance)">
        <FileDrop files={photos} onChange={setPhotos} multiple accept="image/*" capture="environment" maxSizeMb={20} />
      </Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={!v.project_id || v.topic.trim().length < 3 || employees.length + names.length === 0}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const photo_file_ids = photos.length ? await uploadQhseFiles(photos) : [];
              await api("/qhse/safety-talks", {
                method: "POST",
                body: {
                  ...v,
                  content: v.content || null,
                  duration_minutes: toNumber(v.duration_minutes) || 15,
                  attendees: [...employees.map((employee_id) => ({ employee_id, signed: true })), ...names.map((name) => ({ name, signed: true }))],
                  photo_file_ids,
                },
              });
              onDone();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

export function SafetyTalksList() {
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  return (
    <>
      <ResourceView
        key={version}
        embedded
        config={{
          title: "Quarts d'heure sécurité",
          path: "/qhse/safety-talks",
          columns: [
            { key: "talk_date", label: "Date", format: "date" },
            { key: "topic", label: "Thème" },
            { key: "duration_minutes", label: "Durée (min)", format: "number" },
            { key: "attendee_count", label: "Participants", format: "number" },
          ],
          toolbar: can("qhse:write") ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Quart d'heure
            </Button>
          ) : undefined,
          detail: (r) => (
            <div className="space-y-3">
              <p className="font-medium">{r.topic}</p>
              {r.content ? <p className="whitespace-pre-line text-sm">{r.content}</p> : null}
              <ul className="text-sm">
                {((r.attendees ?? []) as Row[]).map((a, k) => (
                  <li key={k}>
                    {a.name ?? a.employee_name ?? "Salarié"} {a.signed ? "· émargé" : ""}
                  </li>
                ))}
              </ul>
              <PhotoGrid ids={r.photo_file_ids} />
            </div>
          ),
        }}
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="Quart d'heure sécurité" size="lg">
        <SafetyTalkForm
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

export function QhseHub({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  return (
    <div className="space-y-5">
      <PageTitle title="QHSE" subtitle="Sécurité, qualité, environnement : incidents, inspections, actions vérifiées, EPI, quarts d'heure." />
      <Tabs
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "tableau", label: "Indicateurs" },
          { key: "incidents", label: "Incidents" },
          { key: "inspections", label: "Inspections" },
          { key: "actions", label: "Actions correctives" },
          { key: "epi", label: "EPI" },
          { key: "causeries", label: "Quarts d'heure" },
          { key: "grilles", label: "Grilles" },
        ]}
      />
      {tab === "tableau" ? <QhseDashboard /> : null}
      {tab === "incidents" ? <IncidentsList /> : null}
      {tab === "inspections" ? <InspectionsList /> : null}
      {tab === "actions" ? <ActionsList /> : null}
      {tab === "epi" ? <PpeView /> : null}
      {tab === "causeries" ? <SafetyTalksList /> : null}
      {tab === "grilles" ? <InspectionTemplatesList /> : null}
    </div>
  );
}
