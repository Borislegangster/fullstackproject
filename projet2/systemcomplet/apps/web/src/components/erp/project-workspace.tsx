"use client";

import { Archive, CalendarRange, FolderKanban, GitBranch, Network, Pencil, Play, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ProjectPanelTab, ProjectReviewsTab, ProjectTrustTab } from "@/components/erp/innovations";
import { ProjectBuildingTab, ProjectEnergyTab, ProjectEscrowTab, ProjectTwinTab } from "@/components/erp/innovations-lot3";
import { ScheduleRisksPanel } from "@/components/erp/schedule-risks";
import { ProjectStudiesTab } from "@/components/erp/studies-deliverables";
import { TimelapseAdmin } from "@/components/innovations/timelapse";
import { OfferSelect } from "@/components/erp/crm";
import { ResourceView, type Row } from "@/components/erp/resource";
import { type Discipline, disciplineNames, DisciplinesPicker } from "@/components/forms/discipline-picker";
import { MultiRefSelect } from "@/components/forms/ref-select";
import { SchemaForm, type FieldConfig } from "@/components/forms/schema-form";
import { LabelListEditor, RowsEditor } from "@/components/forms/structured-fields";
import { UploadedFileField } from "@/components/forms/uploaded-file-field";
import { Gantt } from "@/components/planning/gantt";
import { controlClass, FileDrop, Select, Switch, TagInput } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Progress, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number, percent, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import type { RefSource } from "@/lib/refs";

/** Pièce sur laquelle porte une décision client : version de document (GED), version de maquette BIM ou scénario du
 * configurateur, selon le type de référence choisi. La valeur est l'identifiant de la version / du scénario. */
function DecisionReferenceField({ projectId, type, value, onChange }: { projectId: string; type?: string | null; value: unknown; onChange: (v: string | null) => void }) {
  const docs = useApi<{ items: Row[] }>(type === "document_version" ? "/documents" : null, { project_id: projectId, page_size: 100 });
  const models = useApi<Row[]>(type === "bim_version" ? `/projects/${projectId}/bim/models` : null);
  const configurators = useApi<Row[]>(type === "scenario" ? `/projects/${projectId}/configurator/models` : null);
  const [scenarios, setScenarios] = useState<Row[]>([]);
  useEffect(() => {
    if (type !== "scenario" || !configurators.data) return;
    let cancelled = false;
    Promise.all(configurators.data.map((m) => api<Row[]>(`/configurator/models/${m.id}/scenarios`).then((list) => list.map((sc) => ({ ...sc, model_name: m.name })))))
      .then((all) => !cancelled && setScenarios(all.flat()))
      .catch(() => !cancelled && setScenarios([]));
    return () => {
      cancelled = true;
    };
  }, [type, configurators.data]);
  if (!type) return <p className="py-2 text-sm text-muted">Choisissez d&apos;abord le type de référence (facultatif).</p>;
  const options =
    type === "document_version"
      ? (docs.data?.items ?? []).filter((d) => d.current_version?.id).map((d) => ({ value: String(d.current_version.id), label: [d.code ? `${d.code} — ${d.title}` : d.title, d.current_version.label].filter(Boolean).join(" · ") }))
      : type === "bim_version"
        ? (models.data ?? []).filter((m) => m.current_version?.id).map((m) => ({ value: String(m.current_version.id), label: `${m.name} · version ${m.current_version.number}` }))
        : scenarios.map((sc) => ({ value: String(sc.id), label: `${sc.model_name} · ${sc.name}` }));
  const loading = docs.loading || models.loading || configurators.loading;
  return (
    <Select
      value={value ? String(value) : ""}
      onChange={(e) => onChange(e.target.value || null)}
      options={[{ value: "", label: loading ? "Chargement…" : options.length ? "Sélectionner…" : "Aucune pièce disponible pour ce projet" }, ...options]}
    />
  );
}

// Échelle de 1 à 5 : le score du risque est le produit probabilité × impact (de 1 à 25).
const RISK_FIELDS: Record<string, FieldConfig> = {
  probability: { help: "De 1 (rare) à 5 (quasi certain)." },
  impact: { help: "De 1 (faible) à 5 (critique)." },
  cost_exposure: { help: "Coût estimé si le risque survient (FCFA)." },
};

const EXPENSE_FIELDS: Record<string, FieldConfig> = {
  file_id: { span: 2, label: "Justificatif (facture, ticket, reçu)", render: ({ value, onChange }) => <UploadedFileField endpoint="/finance/files" value={value} onChange={onChange} /> },
};

interface ProjectDetail {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  health: string;
  universe?: string | null;
  project_type?: string | null;
  city?: string | null;
  address?: string | null;
  country?: string | null;
  start_planned?: string | null;
  end_planned?: string | null;
  start_actual?: string | null;
  end_actual?: string | null;
  contract_amount?: string | null;
  currency: string;
  progress_pct?: string | null;
  client_visible: boolean;
  is_diaspora: boolean;
  manager_id?: string | null;
  settings?: Record<string, unknown>;
  sites: Row[];
  kpis: {
    budget: string;
    committed: string;
    spent: string;
    remaining_to_commit: string;
    budget_consumption_pct: number;
    contract_amount: string;
    invoiced: string;
    collected: string;
    funds_calls_due: string;
    gross_margin: string;
    gross_margin_pct?: number | null;
    tasks_total: number;
    tasks_late: number;
    incidents_open: number;
    next_milestones: { id: string; name: string; due_date: string }[];
  };
}

export const PROJECT_TABS = [
  { key: "synthese", label: "Synthèse" },
  { key: "confiance", label: "Confiance et preuves" },
  { key: "planning", label: "Planning" },
  { key: "structure", label: "Sites, phases, lots" },
  { key: "jalons", label: "Jalons" },
  { key: "equipe", label: "Équipe" },
  { key: "journal", label: "Journal de chantier" },
  { key: "medias", label: "Photos et vidéos" },
  { key: "etudes", label: "Études et livrables" },
  { key: "decisions", label: "Décisions" },
  { key: "avenants", label: "Avenants" },
  { key: "budget", label: "Budget" },
  { key: "risques", label: "Risques" },
  { key: "tranquillite", label: "Tranquillité" },
  { key: "garanties", label: "Garanties" },
  { key: "immersion", label: "Immersion et digests" },
  { key: "panneau", label: "Panneau connecté" },
  { key: "avis", label: "Avis client" },
  { key: "jumeau", label: "Jumeau numérique" },
  { key: "sequestre", label: "Séquestre" },
  { key: "batiment", label: "Bâtiment et maintenance" },
  { key: "energie", label: "Énergie" },
] as const;

function Synthese({ p, reload }: { p: ProjectDetail; reload: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const router = useRouter();
  const k = p.kpis;
  const cur = p.currency === "XAF" ? "FCFA" : p.currency;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Avancement" value={`${number(p.progress_pct ?? 0)} %`} hint={`${k.tasks_total} tâches · ${k.tasks_late} en retard`} tone={k.tasks_late ? "warning" : "info"} />
        <Stat label="Budget consommé" value={percent(k.budget_consumption_pct, 1)} hint={`${money(k.spent, cur)} / ${money(k.budget, cur)}`} tone={k.budget_consumption_pct > 100 ? "danger" : "neutral"} />
        <Stat label="Marge brute prévisionnelle" value={money(k.gross_margin, cur)} hint={k.gross_margin_pct !== null && k.gross_margin_pct !== undefined ? `${number(k.gross_margin_pct, 1)} % du contrat` : undefined} tone={toNumber(k.gross_margin) < 0 ? "danger" : "success"} />
        <Stat label="Incidents ouverts" value={k.incidents_open} tone={k.incidents_open ? "warning" : "success"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Informations"
            actions={
              can("projects:write") ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" /> Modifier
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setArchiving(true)}>
                    <Archive className="h-4 w-4" /> Archiver
                  </Button>
                </>
              ) : null
            }
          />
          <div className="p-5">
            {p.description ? <p className="mb-4 whitespace-pre-line text-sm text-ink">{p.description}</p> : null}
            <DescriptionList
              columns={3}
              items={[
                { label: "Statut", value: optionLabel(p.status) },
                { label: "Univers", value: optionLabel(p.universe) },
                { label: "Type", value: optionLabel(p.project_type) },
                { label: "Adresse", value: [p.address, p.city, p.country].filter(Boolean).join(", ") || "—" },
                { label: "Début prévu / réel", value: `${date(p.start_planned)} / ${date(p.start_actual)}` },
                { label: "Fin prévue / réelle", value: `${date(p.end_planned)} / ${date(p.end_actual)}` },
                { label: "Montant du contrat", value: money(k.contract_amount, cur) },
                { label: "Facturé / encaissé", value: `${money(k.invoiced, cur)} / ${money(k.collected, cur)}` },
                { label: "Appels de fonds dus", value: money(k.funds_calls_due, cur) },
                { label: "Engagé", value: money(k.committed, cur) },
                { label: "Reste à engager", value: money(k.remaining_to_commit, cur) },
                { label: "Visible par le client", value: p.client_visible ? "Oui" : "Non" },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Prochains jalons" />
          <ul className="divide-y divide-line text-sm">
            {k.next_milestones.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 px-5 py-2.5">
                <span>{m.name}</span>
                <span className="text-muted">{date(m.due_date)}</span>
              </li>
            ))}
            {!k.next_milestones.length ? <li className="px-5 py-4 text-muted">Aucun jalon planifié.</li> : null}
          </ul>
          <div className="space-y-2 border-t border-line p-4 text-sm">
            <Link href={`/erp/hub?projet=${p.id}`} className="flex items-center gap-2 text-brand-600 hover:underline">
              <Network className="h-4 w-4" /> Hub BIM du projet
            </Link>
            <Link href={`/erp/ged?projet=${p.id}`} className="flex items-center gap-2 text-brand-600 hover:underline">
              <FolderKanban className="h-4 w-4" /> Documents (GED)
            </Link>
            <Link href={`/erp/achats?projet=${p.id}`} className="flex items-center gap-2 text-brand-600 hover:underline">
              <GitBranch className="h-4 w-4" /> Achats du projet
            </Link>
          </div>
        </Card>
      </div>
      <Modal open={editing} onClose={() => setEditing(false)} title="Modifier le projet" size="xl">
        <SchemaForm
          schema="ProjectIn"
          initial={p}
          partial
          exclude={["settings"]}
          fields={{ client_organization_id: { ref: "clientOrganizations" }, offer_code: { label: "Offre", render: ({ value, onChange, values }) => <OfferSelect universe={values.universe || null} value={value} onChange={(slug) => onChange(slug ?? "")} /> } }}
          onCancel={() => setEditing(false)}
          onSubmit={(payload) => api(`/projects/${p.id}`, { method: "PATCH", body: payload })}
          onSuccess={() => {
            setEditing(false);
            toast.success("Projet mis à jour");
            reload();
          }}
        />
      </Modal>
      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        title="Archiver le projet"
        text="Le projet sera archivé (lecture seule) ; l'opération est journalisée."
        reasonLabel="Motif"
        tone="danger"
        confirmLabel="Archiver"
        onConfirm={async (reason) => {
          await api(`/projects/${p.id}/archive`, { method: "POST", body: { reason } });
          toast.success("Projet archivé");
          router.push("/erp/chantiers");
        }}
      />
    </div>
  );
}

interface GanttData {
  tasks: { id: string; parent_id?: string | null; wbs?: string | null; title: string; start?: string | null; end?: string | null; baseline_start?: string | null; baseline_end?: string | null; progress?: string | null; status: string; milestone: boolean; critical: boolean; float?: number | null }[];
  links: { id: string; from: string; to: string; type: string; lag: number }[];
  critical_path: string[];
}

export function ProjectPlanning({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const gantt = useApi<GanttData>(`/projects/${projectId}/gantt`);
  const baselines = useApi<{ id: string; number: number; name: string; created_at: string; is_current: boolean; reason?: string | null }[]>(`/projects/${projectId}/baselines`);
  const [dialog, setDialog] = useState<null | "dependency" | "baseline">(null);
  const [scheduling, setScheduling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const write = can("planning:write");
  const refresh = () => {
    void gantt.reload();
    setReloadKey((k) => k + 1);
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Diagramme de Gantt"
          subtitle={gantt.data ? `${gantt.data.tasks.length} tâches · chemin critique : ${gantt.data.critical_path.length} tâche(s)` : undefined}
          actions={
            write ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setDialog("dependency")}>
                  <GitBranch className="h-4 w-4" /> Dépendance
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={scheduling}
                  onClick={async () => {
                    setScheduling(true);
                    try {
                      const res = await api<{ end_date?: string }>(`/projects/${projectId}/schedule`, { method: "POST", query: { apply: true } });
                      toast.success("Planning recalculé", res.end_date ? `Fin prévue : ${date(res.end_date)}` : undefined);
                      refresh();
                    } catch (err) {
                      toast.error("Ordonnancement impossible", errorMessage(err));
                    } finally {
                      setScheduling(false);
                    }
                  }}
                >
                  <Play className="h-4 w-4" /> Ordonnancer (CPM)
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("baseline")}>
                  <CalendarRange className="h-4 w-4" /> Figer une référence
                </Button>
              </>
            ) : null
          }
        />
        <div className="p-3">
          {gantt.loading && !gantt.data ? (
            <Skeleton className="h-72 w-full" />
          ) : gantt.data ? (
            <Gantt
              tasks={gantt.data.tasks.map((t) => ({ id: t.id, name: `${t.wbs ? `${t.wbs} ` : ""}${t.title}`, start: t.start, end: t.end, progress_pct: t.progress, status: t.status, is_milestone: t.milestone, critical: t.critical, baseline_start: t.baseline_start, baseline_end: t.baseline_end, level: t.parent_id ? 1 : 0 }))}
              links={gantt.data.links.map((l) => ({ from: l.from, to: l.to, type: l.type }))}
            />
          ) : (
            <Alert tone="danger">{gantt.error}</Alert>
          )}
        </div>
      </Card>
      <ResourceView
        key={reloadKey}
        embedded
        config={{
          title: "Tâches",
          path: `/projects/${projectId}/tasks`,
          columns: [
            { key: "wbs_code", label: "WBS" },
            { key: "title", label: "Tâche" },
            { key: "start_planned", label: "Début", format: "date" },
            { key: "end_planned", label: "Fin", format: "date" },
            { key: "progress_pct", label: "Avancement", render: (r) => <Progress value={toNumber(r.progress_pct)} className="w-24" /> },
            { key: "status", label: "Statut", format: "status" },
            { key: "client_visible", label: "Client", format: "bool", hideOnMobile: true },
          ],
          filters: [{ key: "status", label: "Statut", options: ["todo", "in_progress", "blocked", "done", "cancelled"].map((v) => ({ value: v, label: optionLabel(v) })) }],
          create: {
            endpoint: "POST /projects/{project_id}/tasks",
            label: "Nouvelle tâche",
            perms: ["planning:write"],
            fixed: { project_id: projectId },
            fields: {
              parent_id: { ref: "tasks" },
              milestone_id: { ref: "milestones" },
              checklist: { span: 2, label: "Points à vérifier", render: ({ value, onChange }) => <LabelListEditor value={value} onChange={onChange} label="Point à vérifier" placeholder="Ex. Réservations électriques posées" addLabel="Point à vérifier" extra={{ done: false }} /> },
            },
          },
          remove: { path: (r) => `/tasks/${r.id}`, perms: ["planning:write"] },
          actions: [
            { key: "progress", label: "Avancement", endpoint: "POST /tasks/{task_id}/progress", initial: (r) => ({ progress_pct: r.progress_pct }), fields: { evidence_file_ids: { hidden: true } }, success: "Avancement enregistré" },
          ],
        }}
      />
      {baselines.data?.length ? (
        <Card>
          <CardHeader title="Références de planning (baselines)" />
          <ul className="divide-y divide-line text-sm">
            {baselines.data.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
                <span>
                  #{b.number} {b.name} {b.is_current ? <Badge tone="success">Référence courante</Badge> : null}
                  {b.reason ? <span className="block text-xs text-muted">{b.reason}</span> : null}
                </span>
                <span className="text-xs text-muted">{dateTime(b.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Modal open={dialog === "dependency"} onClose={() => setDialog(null)} title="Ajouter une dépendance">
        <SchemaForm
          endpoint="POST /projects/{project_id}/dependencies"
          params={{ project_id: projectId }}
          fields={{ predecessor_id: { ref: { ...taskRef(projectId) } }, successor_id: { ref: { ...taskRef(projectId) } } }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            toast.success("Dépendance ajoutée");
            void gantt.reload();
          }}
          columns={1}
        />
      </Modal>
      <Modal open={dialog === "baseline"} onClose={() => setDialog(null)} title="Figer une référence de planning">
        <SchemaForm
          endpoint="POST /projects/{project_id}/baselines"
          params={{ project_id: projectId }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            toast.success("Référence enregistrée");
            void baselines.reload();
            void gantt.reload();
          }}
          columns={1}
        />
      </Modal>
    </div>
  );
}

function taskRef(projectId: string) {
  return { path: `/projects/${projectId}/tasks`, label: (r: Row) => `${r.wbs_code ? `${r.wbs_code} ` : ""}${r.title}`, paginated: true, searchable: true };
}

function Members({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const members = useApi<{ user_id: string; full_name: string; email: string; job_title?: string | null; project_role: string; disciplines?: string[]; can_view_finance: boolean; online: boolean }[]>(`/projects/${projectId}/members`);
  const disciplines = useApi<Discipline[]>(`/projects/${projectId}/bim/disciplines`);
  const [adding, setAdding] = useState(false);
  return (
    <Card>
      <CardHeader title="Équipe projet" actions={can("projects:members") ? <Button size="sm" onClick={() => setAdding(true)}>Ajouter un membre</Button> : null} />
      <ul className="divide-y divide-line">
        {(members.data ?? []).map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
            <span>
              <span className="font-medium">{m.full_name}</span> {m.online ? <Badge tone="success">En ligne</Badge> : null}
              <span className="block text-xs text-muted">
                {optionLabel(m.project_role)} · {m.job_title ?? m.email} {m.can_view_finance ? "· accès finances" : ""}
                {m.disciplines?.length ? ` · disciplines : ${disciplineNames(m.disciplines, disciplines.data)}` : ""}
              </span>
            </span>
            {can("projects:members") ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await api(`/projects/${projectId}/members/${m.user_id}`, { method: "DELETE" });
                    void members.reload();
                  } catch (err) {
                    toast.error("Retrait impossible", errorMessage(err));
                  }
                }}
              >
                Retirer
              </Button>
            ) : null}
          </li>
        ))}
        {!members.data?.length ? <li className="px-5 py-4 text-sm text-muted">Aucun membre.</li> : null}
      </ul>
      <Modal open={adding} onClose={() => setAdding(false)} title="Ajouter un membre" size="lg">
        <SchemaForm
          endpoint="POST /projects/{project_id}/members"
          params={{ project_id: projectId }}
          fields={{
            user_id: { ref: "users" },
            project_role: { options: ["chef_projet", "conducteur_travaux", "chef_chantier", "ingenieur", "architecte", "bim_manager", "acheteur", "qhse", "comptable", "client", "partenaire", "membre"].map((v) => ({ value: v, label: optionLabel(v) })) },
            lots: { ref: { path: "/lots", query: { project_id: projectId }, label: (r: Row) => `${r.code} — ${r.name}`, paginated: true } },
            sites: { ref: { path: "/sites", query: { project_id: projectId }, label: (r: Row) => r.name, paginated: true } },
            disciplines: {
              span: 2,
              help: "Aucune case cochée : accès à toutes les disciplines (maquettes BIM et documents).",
              render: ({ value, onChange }) => <DisciplinesPicker path={`/projects/${projectId}/bim/disciplines`} value={value} onChange={onChange} />,
            },
          }}
          onCancel={() => setAdding(false)}
          onSuccess={() => {
            setAdding(false);
            void members.reload();
          }}
        />
      </Modal>
    </Card>
  );
}

function SiteMedia({ projectId }: { projectId: string }) {
  const { can, canAny } = useAuth();
  const toast = useToast();
  const media = useApi<{ items: { id: string; media_type: string; caption?: string | null; stage?: string | null; taken_at?: string | null; published_to_client: boolean; url: string }[] }>(`/projects/${projectId}/media`, { page_size: 100 });
  const [uploading, setUploading] = useState(false);
  return (
    <Card>
      <CardHeader title="Photos et vidéos de chantier" subtitle="Seuls les médias publiés sont visibles du client." actions={canAny("site:report", "projects:write") ? <Button size="sm" onClick={() => setUploading(true)}><Upload className="h-4 w-4" /> Ajouter</Button> : null} />
      {media.data?.items.length ? (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {media.data.items.map((m) => (
            <figure key={m.id} className="overflow-hidden rounded-xl ring-1 ring-line">
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-slate-100">
                {m.media_type === "video" ? <video src={m.url} className="h-full w-full object-cover" muted preload="metadata" /> : <img src={m.url} alt={m.caption ?? ""} className="h-full w-full object-cover" loading="lazy" />}
              </a>
              <figcaption className="space-y-1 p-2 text-xs">
                <p className="truncate">{m.caption ?? optionLabel(m.stage)}</p>
                <p className="text-muted">{dateTime(m.taken_at)}</p>
                <Switch
                  checked={m.published_to_client}
                  disabled={!can("projects:publish_client")}
                  label="Client"
                  onChange={async (v) => {
                    try {
                      await api(`/site-media/${m.id}`, { method: "PATCH", body: { published_to_client: v } });
                      void media.reload();
                    } catch (err) {
                      toast.error("Publication impossible", errorMessage(err));
                    }
                  }}
                />
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="p-5">
          <EmptyState title="Aucun média" />
        </div>
      )}
      <Modal open={uploading} onClose={() => setUploading(false)} title="Ajouter une photo ou une vidéo" size="lg">
        <SchemaForm
          endpoint="POST /projects/{project_id}/media"
          params={{ project_id: projectId }}
          fields={{ stage: { options: ["before", "during", "after", "inspection", "delivery", "incident"].map((v) => ({ value: v, label: optionLabel(v) })) }, task_id: { ref: taskRef(projectId) }, zone_id: { hidden: true }, daily_log_id: { hidden: true } }}
          initial={{ site_id: "" }}
          onCancel={() => setUploading(false)}
          onSuccess={() => {
            setUploading(false);
            void media.reload();
          }}
        />
      </Modal>
    </Card>
  );
}

/* ----------------------------------------------------------------------------- éditeurs des champs structurés */

const letter = (i: number) => String.fromCharCode(65 + i);

/** Options soumises au client : `[{ key, label, description, price_impact, delay_impact_days }]`, clés A, B, C… dans l'ordre. */
function DecisionOptionsEditor({ value, onChange }: { value: unknown; onChange: (v: Row[]) => void }) {
  return (
    <RowsEditor
      value={Array.isArray(value) ? value : []}
      onChange={(rows) => onChange(rows.map((r, i) => ({ ...r, key: letter(i) })))}
      itemLabel="Option"
      title={(r, i) => `Option ${letter(i)}${r.label ? ` — ${r.label}` : ""}`}
      fields={[
        { key: "label", label: "Libellé présenté au client", placeholder: "Ex. Carrelage grès cérame", wide: true },
        { key: "price_impact", label: "Impact prix (FCFA)", type: "number", step: 1, help: "Négatif pour une économie." },
        { key: "delay_impact_days", label: "Impact délai (jours)", type: "number", step: 1 },
        { key: "description", label: "Description", type: "textarea", wide: true },
      ]}
      newRow={(rows) => ({ key: letter(rows.length), label: "", price_impact: 0, delay_impact_days: 0, description: "" })}
      addLabel="Option"
      empty="Aucune option : le client valide ou refuse la décision telle quelle."
      max={10}
    />
  );
}

/** Lignes chiffrées d'un avenant : `[{ designation, quantity, unit, unit_price, amount }]`, montant = quantité × prix unitaire. */
function ChangeOrderLinesEditor({ value, onChange }: { value: unknown; onChange: (v: Row[]) => void }) {
  const rows: Row[] = Array.isArray(value) ? value : [];
  const total = rows.reduce((s, r) => s + toNumber(r.amount), 0);
  return (
    <RowsEditor
      value={rows}
      onChange={(next) => onChange(next.map((r) => ({ ...r, amount: Math.round(toNumber(r.quantity) * toNumber(r.unit_price)) })))}
      itemLabel="Ligne"
      title={(r, i) => r.designation || `Ligne ${i + 1}`}
      fields={[
        { key: "designation", label: "Désignation", placeholder: "Ex. Carrelage supplémentaire du séjour", wide: true },
        { key: "quantity", label: "Quantité", type: "number", min: 0 },
        { key: "unit", label: "Unité", placeholder: "m², u, forfait…" },
        { key: "unit_price", label: "Prix unitaire (FCFA)", type: "number", help: "Négatif pour une moins-value." },
        { key: "amount", label: "Montant", render: (r) => <p className="py-2 text-sm font-semibold tabular-nums">{money(r.amount ?? 0)}</p> },
      ]}
      newRow={() => ({ designation: "", quantity: 1, unit: "u", unit_price: 0, amount: 0 })}
      addLabel="Ligne chiffrée"
      empty="Aucune ligne détaillée."
      footer={rows.length ? <p className="text-right text-sm text-muted">Total des lignes : <strong className="text-ink">{money(total)}</strong> (il devient l'impact coût de l'avenant)</p> : null}
    />
  );
}

/** Fichier d'un contenu immersif : photo ou vidéo du chantier, document GED du projet, ou nouveau fichier déposé (rangé dans
 * les photos et vidéos du chantier, non publié). La valeur envoyée reste l'identifiant du fichier stocké (`file_id`). */
function ImmersiveFileField({ projectId, value, onChange, caption }: { projectId: string; value: unknown; onChange: (v: string | null) => void; caption?: string }) {
  const toast = useToast();
  const media = useApi<{ items: Row[] }>(`/projects/${projectId}/media`, { page_size: 100 });
  const docs = useApi<{ items: Row[] }>("/documents", { project_id: projectId, page_size: 100 });
  const [busy, setBusy] = useState(false);
  const current = value ? String(value) : "";
  const mediaOptions = (media.data?.items ?? [])
    .filter((m) => m.file_id)
    .map((m) => ({ value: String(m.file_id), label: [m.caption || m.file?.name || "Média", m.media_type === "video" ? "vidéo" : "photo", date(m.taken_at ?? m.created_at)].filter(Boolean).join(" · ") }));
  const docOptions = (docs.data?.items ?? [])
    .filter((d) => d.current_version?.file_id)
    .map((d) => ({ value: String(d.current_version.file_id), label: [d.code ? `${d.code} — ${d.title}` : d.title, d.current_version.label].filter(Boolean).join(" · ") }));
  const known = [...mediaOptions, ...docOptions].some((o) => o.value === current);
  const upload = async (files: File[]) => {
    const file = files[0];
    if (busy || !file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("stage", "during");
      fd.append("caption", (caption?.trim() || file.name).slice(0, 500));
      const res = await api<Row>(`/projects/${projectId}/media`, { method: "POST", form: fd });
      await media.reload();
      onChange(String(res.file_id));
      toast.success("Fichier déposé", `« ${file.name} » est aussi rangé dans les photos et vidéos du chantier (non publié).`);
    } catch (err) {
      toast.error("Dépôt impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <select className={`${controlClass} pr-8`} value={current} onChange={(e) => onChange(e.target.value || null)} aria-label="Fichier du contenu">
        <option value="">{media.loading || docs.loading ? "Chargement des fichiers du projet…" : "Aucun fichier (URL externe)"}</option>
        {current && !known ? <option value={current}>Fichier actuel</option> : null}
        {mediaOptions.length ? (
          <optgroup label="Photos et vidéos du chantier">
            {mediaOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ) : null}
        {docOptions.length ? (
          <optgroup label="Documents du projet (GED)">
            {docOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
      <FileDrop files={[]} onChange={(files) => void upload(files)} accept="image/*,video/*,.pdf" maxSizeMb={500} label={busy ? "Envoi en cours…" : "Ou déposez un nouveau fichier (photo, vidéo, PDF)"} />
    </div>
  );
}

type FieldRender = { value: any; onChange: (v: any) => void };

/** Espace de travail d'un chantier : toutes les dimensions du projet regroupées par onglets. */
export function ProjectWorkspace({ projectId, tab, onTab }: { projectId: string; tab: string; onTab: (t: string) => void }) {
  const project = useApi<ProjectDetail>(`/projects/${projectId}`);
  if (project.loading && !project.data) return <Skeleton className="h-96 w-full" />;
  if (!project.data) return <Alert tone="danger">{project.error}</Alert>;
  const p = project.data;
  const pq = { project_id: projectId };
  const documents: RefSource = { path: "/documents", query: pq, label: (r) => `${r.code} — ${r.title}`, sublabel: (r) => optionLabel(r.doc_type), paginated: true, searchable: true };
  const proofs = { span: 2 as const, label: "Documents de preuve (GED)", render: ({ value, onChange }: FieldRender) => <MultiRefSelect source={documents} value={Array.isArray(value) ? value.map(String) : []} onChange={onChange} placeholder="Choisir un document du projet…" /> };
  const immersiveKinds = { options: ["live", "photo_360", "video_360", "drone", "timelapse", "virtual_tour"].map((v) => ({ value: v, label: optionLabel(v) })) };
  const immersiveFile = {
    span: 2 as const,
    label: "Fichier",
    help: "Choisissez une photo ou vidéo du chantier, un document du projet, ou déposez un nouveau fichier. Pour un direct ou une visite hébergée ailleurs, laissez vide et renseignez l'URL externe.",
    render: ({ value, onChange, values }: FieldRender & { values: Row }) => <ImmersiveFileField projectId={projectId} value={value} onChange={onChange} caption={values.title} />,
  };
  const digestFields = { content: { hidden: true }, recipients: { span: 2 as const, label: "Destinataires (adresses e-mail)", render: ({ value, onChange }: FieldRender) => <TagInput value={Array.isArray(value) ? value.map(String) : []} onChange={onChange} placeholder="Adresse puis Entrée" /> } };
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={
          <Link href="/erp/chantiers" className="hover:underline">
            Chantiers
          </Link>
        }
        title={`${p.code} — ${p.name}`}
        subtitle={[p.city, `${date(p.start_planned)} → ${date(p.end_planned)}`].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={p.status} label={optionLabel(p.status)} />
            <StatusBadge status={p.health} />
          </div>
        }
      />
      <Tabs value={tab} onChange={onTab} tabs={PROJECT_TABS.map((t) => ({ key: t.key, label: t.label }))} />
      {tab === "synthese" ? <Synthese p={p} reload={() => void project.reload()} /> : null}
      {tab === "confiance" ? <ProjectTrustTab projectId={projectId} /> : null}
      {tab === "etudes" ? <ProjectStudiesTab projectId={projectId} /> : null}
      {tab === "panneau" ? <ProjectPanelTab projectId={projectId} /> : null}
      {tab === "avis" ? <ProjectReviewsTab projectId={projectId} /> : null}
      {tab === "jumeau" ? <ProjectTwinTab projectId={projectId} /> : null}
      {tab === "sequestre" ? <ProjectEscrowTab projectId={projectId} currency={p.currency === "XAF" ? "FCFA" : p.currency} /> : null}
      {tab === "batiment" ? <ProjectBuildingTab projectId={projectId} projectCode={p.code} /> : null}
      {tab === "energie" ? <ProjectEnergyTab projectId={projectId} /> : null}
      {tab === "planning" ? (
        <div className="space-y-6">
          <ScheduleRisksPanel projectId={projectId} />
          <ProjectPlanning projectId={projectId} />
        </div>
      ) : null}
      {tab === "structure" ? (
        <div className="space-y-8">
          <ResourceView
            embedded
            config={{
              title: "Sites",
              subtitle: "Sites de chantier (géorepérage du pointage, chef de chantier, flux vidéo).",
              path: "/sites",
              query: pq,
              columns: [
                { key: "code", label: "Code" },
                { key: "name", label: "Site" },
                { key: "city", label: "Ville" },
                { key: "geofence_radius_m", label: "Rayon (m)", format: "number" },
                { key: "status", label: "Statut", format: "status" },
              ],
              create: { endpoint: "POST /sites", label: "Nouveau site", fixed: pq, perms: ["projects:write"] },
              update: { endpoint: "PATCH /sites/{item_id}", exclude: ["project_id"], perms: ["projects:write"] },
              remove: { path: (r) => `/sites/${r.id}`, perms: ["projects:write"] },
            }}
          />
          <ResourceView
            embedded
            config={{
              title: "Phases",
              path: "/phases",
              query: pq,
              columns: [
                { key: "name", label: "Phase" },
                { key: "start_planned", label: "Début", format: "date" },
                { key: "end_planned", label: "Fin", format: "date" },
                { key: "progress_pct", label: "Avancement", format: "percent" },
                { key: "status", label: "Statut", format: "status" },
                { key: "client_visible", label: "Client", format: "bool" },
              ],
              create: { endpoint: "POST /phases", label: "Nouvelle phase", fixed: pq, perms: ["planning:write"] },
              update: { endpoint: "PATCH /phases/{item_id}", exclude: ["project_id"], perms: ["planning:write"] },
              remove: { path: (r) => `/phases/${r.id}`, perms: ["planning:write"] },
            }}
          />
          <ResourceView
            embedded
            config={{
              title: "Lots",
              path: "/lots",
              query: pq,
              columns: [
                { key: "code", label: "Code" },
                { key: "name", label: "Lot" },
                { key: "discipline", label: "Discipline", format: "option" },
                { key: "budget_amount", label: "Budget", format: "money", align: "right" },
                { key: "progress_pct", label: "Avancement", format: "percent" },
                { key: "status", label: "Statut", format: "status" },
              ],
              create: { endpoint: "POST /lots", label: "Nouveau lot", fixed: pq, perms: ["projects:write"] },
              update: { endpoint: "PATCH /lots/{item_id}", exclude: ["project_id"], perms: ["projects:write"] },
              remove: { path: (r) => `/lots/${r.id}`, perms: ["projects:write"] },
            }}
          />
        </div>
      ) : null}
      {tab === "jalons" ? (
        <ResourceView
          embedded
          config={{
            title: "Jalons",
            path: "/milestones",
            query: pq,
            columns: [
              { key: "name", label: "Jalon" },
              { key: "due_date", label: "Échéance", format: "date" },
              { key: "achieved_at", label: "Atteint le", format: "date" },
              { key: "payment_pct", label: "Paiement (%)", format: "percent" },
              { key: "status", label: "Statut", format: "status" },
              { key: "client_visible", label: "Client", format: "bool" },
            ],
            create: { endpoint: "POST /milestones", label: "Nouveau jalon", fixed: pq, perms: ["planning:write"] },
            update: { endpoint: "PATCH /milestones/{item_id}", exclude: ["project_id"], perms: ["planning:write"] },
            remove: { path: (r) => `/milestones/${r.id}`, perms: ["planning:write"] },
          }}
        />
      ) : null}
      {tab === "equipe" ? <Members projectId={projectId} /> : null}
      {tab === "journal" ? (
        <ResourceView
          embedded
          config={{
            title: "Journal de chantier",
            subtitle: "Rapports quotidiens (saisie web, mobile ou rapport vocal IA), soumis puis validés.",
            path: "/daily-logs",
            query: pq,
            columns: [
              { key: "log_date", label: "Date", format: "date" },
              { key: "weather", label: "Météo" },
              { key: "workforce_count", label: "Effectif", format: "number" },
              { key: "delay_hours", label: "Retard (h)", format: "number" },
              { key: "is_critical", label: "Critique", format: "bool" },
              { key: "source", label: "Source", format: "option" },
              { key: "status", label: "Statut", format: "status" },
            ],
            filters: [{ key: "status", label: "Statut", options: ["draft", "submitted", "validated"].map((v) => ({ value: v, label: optionLabel(v) })) }],
            create: { endpoint: "POST /daily-logs", label: "Nouveau rapport", fixed: pq, perms: ["site:report", "projects:write"] },
            actions: [
              { key: "submit", label: "Soumettre", path: (r) => `/daily-logs/${r.id}/submit`, when: (r) => r.status === "draft", confirm: "Soumettre ce rapport à la validation ?" },
              { key: "validate", label: "Valider", path: (r) => `/daily-logs/${r.id}/validate`, when: (r) => r.status === "submitted", perms: ["projects:write"], confirm: "Valider ce rapport de chantier ?" },
            ],
          }}
        />
      ) : null}
      {tab === "medias" ? (
        <div className="space-y-6">
          <SiteMedia projectId={projectId} />
          <TimelapseAdmin projectId={projectId} />
        </div>
      ) : null}
      {tab === "decisions" ? (
        <ResourceView
          embedded
          config={{
            title: "Décisions client",
            subtitle: "Soumises à la validation OTP du client ; une décision validée est figée (horodatage + empreinte).",
            path: "/decisions",
            query: pq,
            columns: [
              { key: "number", label: "N°" },
              { key: "title", label: "Décision" },
              { key: "kind", label: "Type", format: "option" },
              { key: "price_impact", label: "Impact prix", format: "money", align: "right" },
              { key: "delay_impact_days", label: "Délai (j)", format: "number" },
              { key: "due_date", label: "Échéance", format: "date" },
              { key: "status", label: "Statut", format: "status" },
            ],
            create: { endpoint: "POST /decisions", label: "Demander une décision", fixed: pq, perms: ["projects:write"], fields: { options: { span: 2, label: "Options proposées au client", render: ({ value, onChange }) => <DecisionOptionsEditor value={value} onChange={onChange} /> }, reference_id: { label: "Pièce concernée", render: ({ value, onChange, values }) => <DecisionReferenceField projectId={projectId} type={values.reference_type} value={value} onChange={onChange} /> } } },
          }}
        />
      ) : null}
      {tab === "avenants" ? (
        <ResourceView
          embedded
          config={{
            title: "Avenants",
            subtitle: "Brouillon → soumis au client (OTP) → approuvé client → approbation finance.",
            path: "/change-orders",
            query: pq,
            columns: [
              { key: "number", label: "N°" },
              { key: "title", label: "Avenant" },
              { key: "reason", label: "Motif", format: "option" },
              { key: "cost_impact", label: "Montant", format: "money", align: "right" },
              { key: "delay_impact_days", label: "Délai (j)", format: "number" },
              { key: "status", label: "Statut", format: "status" },
            ],
            create: { endpoint: "POST /change-orders", label: "Nouvel avenant", fixed: pq, perms: ["projects:write"], fields: { lot_id: { ref: "lots" }, lines: { span: 2, label: "Lignes chiffrées", render: ({ value, onChange }) => <ChangeOrderLinesEditor value={value} onChange={onChange} /> } } },
            actions: [
              { key: "submit", label: "Soumettre au client", path: (r) => `/change-orders/${r.id}/transition`, body: () => ({ target: "submitted" }), when: (r) => r.status === "draft", perms: ["projects:write"], confirm: "Soumettre l'avenant à la validation du client (OTP) ?", success: "Avenant soumis" },
              { key: "back", label: "Repasser en brouillon", path: (r) => `/change-orders/${r.id}/transition`, body: () => ({ target: "draft" }), when: (r) => r.status === "submitted", perms: ["projects:write"], confirm: "Retirer l'avenant de la validation client ?" },
              { key: "approve", label: "Approuver (finance)", path: (r) => `/change-orders/${r.id}/transition`, body: () => ({ target: "approved" }), when: (r) => r.status === "client_approved", perms: ["finance:approve"], confirm: "Approuver définitivement l'avenant (impact budget et contrat) ?", success: "Avenant approuvé" },
              { key: "reject", label: "Rejeter", path: (r) => `/change-orders/${r.id}/transition`, body: () => ({ target: "rejected" }), when: (r) => r.status === "client_approved", perms: ["finance:approve"], tone: "danger", confirm: "Rejeter cet avenant ?" },
              { key: "cancel", label: "Annuler", path: (r) => `/change-orders/${r.id}/transition`, body: () => ({ target: "cancelled" }), when: (r) => r.status === "draft", perms: ["projects:write"], tone: "danger", confirm: "Annuler cet avenant ?" },
            ],
          }}
        />
      ) : null}
      {tab === "budget" ? <ProjectBudget projectId={projectId} currency={p.currency} /> : null}
      {tab === "risques" ? (
        <ResourceView
          embedded
          config={{
            title: "Risques",
            path: "/risks",
            query: pq,
            columns: [
              { key: "title", label: "Risque" },
              { key: "category", label: "Catégorie", format: "option" },
              { key: "probability", label: "Probabilité", format: "number" },
              { key: "impact", label: "Impact", format: "number" },
              { key: "cost_exposure", label: "Exposition", format: "money", align: "right" },
              { key: "due_date", label: "Échéance", format: "date" },
              { key: "status", label: "Statut", format: "status" },
            ],
            // Origine (saisie / détection automatique) : renseignée par la plateforme.
            create: { endpoint: "POST /risks", label: "Nouveau risque", fixed: pq, exclude: ["source"], fields: RISK_FIELDS, perms: ["projects:write"] },
            update: { endpoint: "PATCH /risks/{item_id}", exclude: ["project_id", "source"], fields: RISK_FIELDS, perms: ["projects:write"] },
            remove: { path: (r) => `/risks/${r.id}`, perms: ["projects:write"] },
          }}
        />
      ) : null}
      {tab === "tranquillite" ? (
        <ResourceView
          embedded
          config={{
            title: "Dossier Tranquillité",
            subtitle: "Foncier, permis, actes notariés : statuts, échéances, preuves, vérifications et ancrage d'empreinte.",
            path: "/tranquillite-items",
            query: pq,
            columns: [
              { key: "category", label: "Catégorie", format: "option" },
              { key: "title", label: "Pièce" },
              { key: "authority", label: "Autorité" },
              { key: "due_date", label: "Échéance", format: "date" },
              { key: "expiry_date", label: "Expiration", format: "date" },
              { key: "status", label: "Statut", format: "status" },
              { key: "client_visible", label: "Client", format: "bool" },
            ],
            create: { endpoint: "POST /tranquillite-items", label: "Nouvelle pièce", fixed: pq, perms: ["projects:write"], fields: { category: { options: ["foncier", "titre", "permis", "notarie", "verification", "administratif", "assurance", "autre"].map((v) => ({ value: v, label: optionLabel(v) })) }, document_ids: proofs } },
            update: { endpoint: "PATCH /tranquillite-items/{item_id}", exclude: ["project_id"], perms: ["projects:write"], fields: { document_ids: proofs } },
            remove: { path: (r) => `/tranquillite-items/${r.id}`, perms: ["projects:write"] },
            actions: [{ key: "verify", label: "Vérifier", endpoint: "POST /tranquillite-items/{item_id}/verify", perms: ["projects:write"], success: "Vérification enregistrée" }],
          }}
        />
      ) : null}
      {tab === "garanties" ? (
        <ResourceView
          embedded
          config={{
            title: "Garanties",
            path: "/warranties",
            query: pq,
            columns: [
              { key: "kind", label: "Garantie", format: "option" },
              { key: "start_date", label: "Début", format: "date" },
              { key: "end_date", label: "Fin", format: "date" },
              { key: "insurer", label: "Assureur" },
              { key: "policy_number", label: "N° police" },
            ],
            create: { endpoint: "POST /warranties", label: "Nouvelle garantie", fixed: pq, perms: ["projects:write"] },
            update: { endpoint: "PATCH /warranties/{item_id}", exclude: ["project_id"], perms: ["projects:write"] },
            remove: { path: (r) => `/warranties/${r.id}`, perms: ["projects:write"] },
          }}
        />
      ) : null}
      {tab === "immersion" ? (
        <div className="space-y-8">
          <ResourceView
            embedded
            config={{
              title: "Contenus immersifs",
              subtitle: "Directs, photos/vidéos 360°, drone, time-lapse, visites virtuelles publiés au client.",
              path: "/immersive-contents",
              query: pq,
              columns: [
                { key: "kind", label: "Type", format: "option" },
                { key: "title", label: "Titre" },
                { key: "captured_at", label: "Capturé le", format: "datetime" },
                { key: "comparison_group", label: "Groupe de comparaison" },
                { key: "published_to_client", label: "Publié", format: "bool" },
              ],
              create: { endpoint: "POST /immersive-contents", label: "Nouveau contenu", fixed: pq, perms: ["projects:write"], fields: { kind: immersiveKinds, file_id: immersiveFile } },
              update: { endpoint: "PATCH /immersive-contents/{item_id}", exclude: ["project_id"], perms: ["projects:write"], fields: { kind: immersiveKinds, file_id: immersiveFile } },
              remove: { path: (r) => `/immersive-contents/${r.id}`, perms: ["projects:write"] },
            }}
          />
          <ResourceView
            embedded
            config={{
              title: "Résumés client (digests)",
              subtitle: "Synthèse hebdomadaire automatique : avancées, risques, dépenses, prochaines décisions.",
              path: "/client-digests",
              query: pq,
              columns: [
                { key: "period_start", label: "Du", format: "date" },
                { key: "period_end", label: "Au", format: "date" },
                { key: "generated_at", label: "Généré le", format: "datetime" },
                { key: "sent_at", label: "Envoyé le", format: "datetime" },
              ],
              create: { endpoint: "POST /client-digests", label: "Nouveau résumé", fixed: pq, perms: ["projects:write"], fields: digestFields },
              update: { endpoint: "PATCH /client-digests/{item_id}", exclude: ["project_id"], perms: ["projects:write"], fields: digestFields },
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ProjectBudget({ projectId, currency }: { projectId: string; currency: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const budgets = useApi<{ id: string; version_number: number; label: string; status: string; total: string; revenue_target?: string | null; approved_at?: string | null; lines: { id: string; lot_id?: string | null; category: string; label: string; amount: string }[] }[]>("/budgets", { project_id: projectId });
  const [creating, setCreating] = useState(false);
  const cur = currency === "XAF" ? "FCFA" : currency;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Budgets (versions)" actions={can("finance:write") ? <Button size="sm" onClick={() => setCreating(true)}>Nouvelle version</Button> : null} />
        <ul className="divide-y divide-line">
          {(budgets.data ?? []).map((b) => (
            <li key={b.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  V{b.version_number} — {b.label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-title font-bold">{money(b.total, cur)}</span>
                  <StatusBadge status={b.status} />
                  {b.status !== "approved" && can("finance:approve") ? (
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await api(`/budgets/${b.id}/approve`, { method: "POST" });
                          toast.success("Budget approuvé");
                          void budgets.reload();
                        } catch (err) {
                          toast.error("Approbation impossible", errorMessage(err));
                        }
                      }}
                    >
                      Approuver
                    </Button>
                  ) : null}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <tbody className="divide-y divide-line">
                    {b.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="py-1 pr-3">{optionLabel(l.category)}</td>
                        <td className="py-1 pr-3">{l.label}</td>
                        <td className="py-1 text-right tabular-nums">{money(l.amount, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
          ))}
          {!budgets.data?.length ? <li className="px-5 py-4 text-sm text-muted">Aucun budget.</li> : null}
        </ul>
      </Card>
      <ResourceView
        embedded
        config={{
          title: "Engagements",
          subtitle: "Commandes, contrats de sous-traitance et autres engagements imputés au projet.",
          path: "/commitments",
          query: { project_id: projectId },
          columns: [
            { key: "label", label: "Engagement" },
            { key: "category", label: "Catégorie", format: "option" },
            { key: "source_type", label: "Origine", format: "option" },
            { key: "amount", label: "Montant", format: "money", align: "right" },
            { key: "consumed", label: "Consommé", format: "money", align: "right" },
            { key: "status", label: "Statut", format: "status" },
          ],
        }}
      />
      <ResourceView
        embedded
        config={{
          title: "Dépenses",
          path: "/expenses",
          query: { project_id: projectId },
          columns: [
            { key: "expense_date", label: "Date", format: "date" },
            { key: "label", label: "Dépense" },
            { key: "category", label: "Catégorie", format: "option" },
            { key: "source_type", label: "Origine", format: "option" },
            { key: "amount", label: "Montant", format: "money", align: "right" },
            { key: "client_visible", label: "Client", format: "bool" },
            { key: "file_id", label: "Justificatif", render: (r) => (r.file_id ? <a href={apiUrl(`/expenses/${r.id}/file`)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Ouvrir</a> : "—"), hideOnMobile: true },
          ],
          // Origine (facture fournisseur, paie, caisse…) renseignée par les écritures automatiques : saisie manuelle ici.
          create: { endpoint: "POST /expenses", label: "Nouvelle dépense", fixed: { project_id: projectId }, exclude: ["source_type", "source_id"], fields: EXPENSE_FIELDS, perms: ["finance:write"] },
          update: { endpoint: "PATCH /expenses/{item_id}", exclude: ["project_id", "source_type", "source_id"], fields: EXPENSE_FIELDS, perms: ["finance:write"] },
        }}
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle version de budget" size="xl">
        <SchemaForm
          endpoint="POST /budgets"
          fixed={{ project_id: projectId }}
          fields={{ lines: { columns: ["lot_id", "category", "label", "amount"], fields: { lot_id: { ref: { path: "/lots", query: { project_id: projectId }, label: (r: Row) => `${r.code} — ${r.name}`, paginated: true } } } } }}
          onCancel={() => setCreating(false)}
          onSuccess={() => {
            setCreating(false);
            toast.success("Budget créé");
            void budgets.reload();
          }}
        />
      </Modal>
    </div>
  );
}
