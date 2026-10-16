"use client";

import { Camera, Crosshair, Download, Eye, MapPin, MousePointer2, Plus, QrCode, Radar, Send, Upload, Video } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCalls } from "@/components/calls/call-provider";
import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { RefSelect } from "@/components/forms/ref-select";
import { SchemaForm } from "@/components/forms/schema-form";
import { LabelListEditor } from "@/components/forms/structured-fields";
import type { BimMarker, BimPick, BimViewerHandle, CameraState } from "@/components/three/bim-viewer";
import { FederatedViewer, type Federation } from "@/components/three/federated-viewer";
import { BarChartCard, DonutChart } from "@/components/ui/charts";
import { Checkbox, Field, FileDrop, Input, Select, Textarea } from "@/components/ui/form";
import { Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { useRealtime, useRealtimeEvent } from "@/lib/realtime";
import { REFS } from "@/lib/refs";

const opts = (values: string[]) => values.map((v) => ({ value: v, label: optionLabel(v) }));
const ISSUE_KINDS = ["clash", "design", "question", "observation", "defect"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const ISSUE_STATUSES = ["open", "in_progress", "resolved", "closed", "reopened"];
const ISSUE_FLOW: Record<string, string[]> = { open: ["in_progress", "resolved", "closed"], in_progress: ["resolved", "open"], resolved: ["closed", "reopened"], reopened: ["in_progress", "resolved"], closed: ["reopened"] };
const ISSUE_TRANSITION_LABELS: Record<string, string> = { in_progress: "Prendre en charge", resolved: "Déclarer résolue", closed: "Clôturer", reopened: "Rouvrir", open: "Remettre en attente" };
const CLASH_STATUSES = ["new", "active", "reviewed", "approved", "resolved"];
const priorityColor = (p?: string) => (p === "critical" ? "#dc2626" : p === "high" ? "#FB8C43" : p === "medium" ? "#d97706" : "#385AA6");
const CURSOR_COLORS = ["#16a34a", "#9333ea", "#0891b2", "#db2777", "#ca8a04", "#4f46e5"];

/** Téléverse une capture de la maquette (preuve d'issue / point de vue) et renvoie son identifiant. */
async function uploadSnapshot(viewer: BimViewerHandle | null): Promise<string | null> {
  const blob = await viewer?.snapshot();
  if (!blob) return null;
  const fd = new FormData();
  fd.append("file", new File([blob], "capture.png", { type: "image/png" }));
  return (await api<{ file_id: string }>("/bim/files", { method: "POST", form: fd })).file_id;
}

/* ----------------------------------------------------------------------------- création d'issue */

function IssueCreate({ projectId, federation, pick, camera, viewer, onDone, onCancel }: { projectId: string; federation?: Federation | null; pick?: (BimPick & { versionId?: string }) | null; camera?: CameraState | null; viewer?: BimViewerHandle | null; onDone: (issue: Row) => void; onCancel: () => void }) {
  const model = federation?.models.find((m) => m.version_id === pick?.versionId);
  const [v, setV] = useState({ title: "", description: "", kind: "design", priority: "medium", discipline: model?.discipline ?? "", assignee_id: null as string | null, due_date: "", zone_id: null as string | null, withSnapshot: !!viewer });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {pick ? (
        <Alert tone="info">
          Repère : {pick.objectName}
          {model ? ` · ${model.model} (${model.discipline_name}) v${model.number}` : ""} · ({pick.point.x.toFixed(2)}, {pick.point.y.toFixed(2)}, {pick.point.z.toFixed(2)})
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre" required className="sm:col-span-2">
          <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Gaine CVC en conflit avec la poutre P12" />
        </Field>
        <Field label="Nature">
          <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} options={opts(ISSUE_KINDS)} />
        </Field>
        <Field label="Priorité">
          <Select value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value })} options={opts(PRIORITIES)} />
        </Field>
        <Field label="Discipline">
          <Select value={v.discipline} onChange={(e) => setV({ ...v, discipline: e.target.value })} options={[{ value: "", label: "—" }, ...(federation?.disciplines ?? []).map((d) => ({ value: d.key, label: d.name }))]} />
        </Field>
        <Field label="Assignée à">
          <RefSelect source={REFS.users} value={v.assignee_id} onChange={(id) => setV({ ...v, assignee_id: id })} />
        </Field>
        <Field label="Échéance">
          <Input type="date" value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value })} />
        </Field>
        <Field label="Zone">
          <RefSelect source={REFS.zones} value={v.zone_id} onChange={(id) => setV({ ...v, zone_id: id })} context={{ project_id: projectId }} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={3} />
        </Field>
      </div>
      {viewer ? <Checkbox label="Joindre une capture de la vue actuelle" checked={v.withSnapshot} onChange={(c) => setV({ ...v, withSnapshot: c })} /> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={v.title.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const snapshot_file_id = v.withSnapshot ? await uploadSnapshot(viewer ?? null) : null;
              const issue = await api<Row>(`/projects/${projectId}/bim/issues`, {
                method: "POST",
                body: {
                  version_id: pick?.versionId ?? null,
                  zone_id: v.zone_id,
                  title: v.title.trim(),
                  description: v.description || null,
                  kind: v.kind,
                  priority: v.priority,
                  discipline: v.discipline || null,
                  assignee_id: v.assignee_id,
                  due_date: v.due_date || null,
                  location: pick ? { point: pick.point, express_id: pick.expressId ?? null, object: pick.objectName } : {},
                  viewpoint: camera ? { camera } : {},
                  snapshot_file_id,
                },
              });
              onDone(issue);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer l'issue
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------- coordination 3D */

export function CoordinationView({ projectId, focusIssue }: { projectId: string; focusIssue?: string | null }) {
  const { can, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const realtime = useRealtime();
  const federation = useApi<Federation>(`/projects/${projectId}/bim/federation`);
  const issues = useApi<Row[]>(`/projects/${projectId}/bim/issues`);
  const viewer = useRef<BimViewerHandle>(null);
  const [mode, setMode] = useState<"navigate" | "issue">("navigate");
  const [pick, setPick] = useState<(BimPick & { versionId?: string }) | null>(null);
  const [creating, setCreating] = useState(false);
  const [cursors, setCursors] = useState<Record<string, { id: string; name: string; position: { x: number; y: number; z: number }; color: string; at: number }>>({});
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const models = useMemo(() => federation.data?.models ?? [], [federation.data]);
  const versionId = activeVersion ?? models[0]?.version_id ?? null;
  const viewpoints = useApi<Row[]>(versionId ? `/bim/versions/${versionId}/viewpoints` : null);
  const [vpName, setVpName] = useState("");
  const rooms = useMemo(() => models.map((m) => `bim:${m.version_id}`), [models]);

  useEffect(() => {
    rooms.forEach((r) => realtime.join(r));
    return () => rooms.forEach((r) => realtime.leave(r));
  }, [rooms, realtime]);

  useRealtimeEvent("bim.cursor", (data) => {
    if (!data?.user_id || data.user_id === user?.id || !data.position) return;
    const index = Math.abs([...String(data.user_id)].reduce((s, c) => s + c.charCodeAt(0), 0)) % CURSOR_COLORS.length;
    setCursors((all) => ({ ...all, [data.user_id]: { id: data.user_id, name: data.name ?? "Participant", position: data.position, color: CURSOR_COLORS[index], at: Date.now() } }));
  });
  const reloadIssues = useCallback(() => void issues.reload(), [issues]);
  useRealtimeEvent("bim.issue.created", reloadIssues);
  useRealtimeEvent("bim.issue.updated", reloadIssues);
  useRealtimeEvent("bim.viewpoint.created", () => void viewpoints.reload());

  // Les curseurs inactifs depuis 30 s disparaissent.
  useEffect(() => {
    const timer = setInterval(() => setCursors((all) => Object.fromEntries(Object.entries(all).filter(([, c]) => Date.now() - c.at < 30000))), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!focusIssue || !issues.data) return;
    const issue = issues.data.find((i) => i.id === focusIssue);
    const cam = issue?.viewpoint?.camera as CameraState | undefined;
    if (cam) setTimeout(() => viewer.current?.setCamera(cam), 800);
  }, [focusIssue, issues.data]);

  const markers: BimMarker[] = useMemo(
    () =>
      (issues.data ?? [])
        .filter((i) => i.location?.point && !["closed"].includes(i.status))
        .map((i) => ({ id: i.id, position: i.location.point, color: priorityColor(i.priority), label: `${i.number} — ${i.title}` })),
    [issues.data],
  );

  if (federation.loading && !federation.data) return <Skeleton className="h-[60vh] w-full" />;
  if (federation.error) return <Alert tone="danger">{federation.error}</Alert>;
  if (!federation.data || !models.length) return <EmptyState title="Aucune maquette exploitable" text="Déposez une maquette (IFC, RVT, DWG…) dans l'onglet « Maquettes » : elle apparaîtra ici une fois traitée." />;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-line">
            <button type="button" onClick={() => setMode("navigate")} className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold ${mode === "navigate" ? "bg-brand-500 text-white" : "text-muted"}`}>
              <MousePointer2 className="h-3.5 w-3.5" /> Naviguer
            </button>
            {can("bim:write") ? (
              <button type="button" onClick={() => setMode("issue")} className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold ${mode === "issue" ? "bg-accent-500 text-white" : "text-muted"}`}>
                <MapPin className="h-3.5 w-3.5" /> Placer une issue
              </button>
            ) : null}
          </div>
          {Object.values(cursors).length ? (
            <span className="flex items-center gap-1 text-xs text-muted">
              {Object.values(cursors).map((c) => (
                <span key={c.id} className="rounded-full px-2 py-0.5 text-white" style={{ backgroundColor: c.color }}>
                  {c.name}
                </span>
              ))}
              en ligne
            </span>
          ) : null}
        </div>
        <FederatedViewer
          ref={viewer}
          federation={federation.data}
          markers={markers}
          cursors={Object.values(cursors)}
          className="h-[68vh] min-h-[420px]"
          onPick={(p) => {
            if (p.versionId) {
              realtime.send("bim.cursor", { version_id: p.versionId, position: p.point });
              setActiveVersion(p.versionId);
            }
            if (mode === "issue") {
              setPick(p);
              setCreating(true);
            }
          }}
          onMarkerClick={(id) => router.push(`/erp/hub/issues/${id}`)}
        />
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Issues ouvertes" subtitle={`${(issues.data ?? []).filter((i) => !["closed", "resolved"].includes(i.status)).length} en cours`} actions={can("bim:write") ? <Button size="sm" onClick={() => { setPick(null); setCreating(true); }}><Plus className="h-4 w-4" /></Button> : null} />
          <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">
            {(issues.data ?? [])
              .filter((i) => !["closed"].includes(i.status))
              .map((i) => (
                <li key={i.id} className="px-4 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <CellLink href={`/erp/hub/issues/${i.id}`}>{i.number}</CellLink>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: priorityColor(i.priority) }} />
                      <StatusBadge status={i.status} />
                    </span>
                  </div>
                  <p className="truncate">{i.title}</p>
                  {i.viewpoint?.camera ? (
                    <button type="button" className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline" onClick={() => viewer.current?.setCamera(i.viewpoint.camera as CameraState)}>
                      <Crosshair className="h-3 w-3" /> Voir dans la maquette
                    </button>
                  ) : null}
                </li>
              ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Points de vue" subtitle={models.find((m) => m.version_id === versionId)?.model} />
          <div className="space-y-2 p-4">
            <Select value={versionId ?? ""} onChange={(e) => setActiveVersion(e.target.value)} options={models.map((m) => ({ value: m.version_id, label: `${m.model} v${m.number}` }))} aria-label="Maquette" />
            <ul className="space-y-1 text-sm">
              {(viewpoints.data ?? []).map((vp) => (
                <li key={vp.id} className="flex items-center justify-between gap-2">
                  <button type="button" className="truncate text-left hover:underline" onClick={() => vp.camera?.position && viewer.current?.setCamera(vp.camera as CameraState)}>
                    <Eye className="mr-1 inline h-3.5 w-3.5" />
                    {vp.name}
                    {vp.is_preset ? <Badge className="ml-1">Client</Badge> : null}
                  </button>
                </li>
              ))}
              {!viewpoints.data?.length ? <li className="text-muted">Aucun point de vue.</li> : null}
            </ul>
            {can("bim:write") && versionId ? (
              <div className="flex gap-2">
                <Input value={vpName} onChange={(e) => setVpName(e.target.value)} placeholder="Nom du point de vue" />
                <Button
                  size="sm"
                  disabled={vpName.trim().length < 2}
                  onClick={async () => {
                    try {
                      const camera = viewer.current?.getCamera();
                      if (!camera) return;
                      const snapshot_file_id = await uploadSnapshot(viewer.current);
                      await api(`/bim/versions/${versionId}/viewpoints`, { method: "POST", body: { name: vpName.trim(), camera, snapshot_file_id } });
                      setVpName("");
                      void viewpoints.reload();
                    } catch (err) {
                      toast.error("Enregistrement impossible", errorMessage(err));
                    }
                  }}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle issue BIM" size="lg">
        <IssueCreate
          projectId={projectId}
          federation={federation.data}
          pick={pick}
          camera={viewer.current?.getCamera() ?? null}
          viewer={viewer.current}
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            setMode("navigate");
            void issues.reload();
            toast.success("Issue créée", "L'assigné est notifié.");
          }}
        />
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- maquettes */

export function ModelsList({ projectId }: { projectId: string }) {
  const disciplines = useApi<Row[]>(`/projects/${projectId}/bim/disciplines`);
  return (
    <ResourceView
      embedded
      config={{
        title: "Maquettes",
        subtitle: "Une maquette par discipline, versions successives (IFC lu dans le navigateur, RVT/DWG/NWD convertis par Autodesk APS).",
        path: `/projects/${projectId}/bim/models`,
        href: (r) => `/erp/bim/${r.id}`,
        columns: [
          { key: "name", label: "Maquette", render: (r) => <CellLink href={`/erp/bim/${r.id}`}>{r.name}</CellLink> },
          { key: "discipline", label: "Discipline", render: (r) => disciplines.data?.find((d) => d.key === r.discipline)?.name ?? optionLabel(r.discipline) },
          { key: "current_version", label: "Version", render: (r) => (r.current_version ? `v${r.current_version.number} · ${String(r.current_version.source_format).toUpperCase()}` : "—") },
          { key: "status", label: "Statut", render: (r) => <StatusBadge status={r.current_version?.status} /> },
          { key: "updated_at", label: "Mise à jour", format: "datetime", hideOnMobile: true },
        ],
        create: {
          endpoint: "POST /projects/{project_id}/bim/models",
          label: "Nouvelle maquette",
          perms: ["bim:write"],
          fixed: { project_id: projectId },
          fields: { discipline: { options: (disciplines.data ?? []).map((d) => ({ value: d.key, label: d.name })) }, description: { widget: "textarea" } },
        },
      }}
    />
  );
}

export function ModelDetail({ modelId }: { modelId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const model = useApi<Row>(`/bim/models/${modelId}`);
  const [file, setFile] = useState<File[]>([]);
  const [reason, setReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [publish, setPublish] = useState<Row | null>(null);
  const [toClient, setToClient] = useState(false);
  const disciplines = useApi<Row[]>(model.data ? `/projects/${model.data.project_id}/bim/disciplines` : null);
  if (model.loading && !model.data) return <Skeleton className="h-96 w-full" />;
  if (!model.data) return <Alert tone="danger">{model.error}</Alert>;
  const m = model.data;
  const versions = (m.versions ?? []) as Row[];
  const layer = disciplines.data?.find((d) => d.key === m.discipline);
  const previewVersion = versions.find((v) => v.id === preview) ?? versions.find((v) => ["ready", "validated", "published"].includes(v.status));
  const federation: Federation | null = previewVersion
    ? {
        project_id: m.project_id,
        disciplines: [{ key: m.discipline, name: layer?.name ?? m.discipline, color: layer?.color ?? "#385AA6" }],
        models: [{ model_id: m.id, model: m.name, discipline: m.discipline, discipline_name: layer?.name ?? m.discipline, color: layer?.color ?? "#385AA6", version_id: previewVersion.id, number: previewVersion.number, status: previewVersion.status, viewer: previewVersion.viewer, urn: previewVersion.aps_urn, format: previewVersion.source_format }],
      }
    : null;
  const act = async (path: string, body: unknown, message: string) => {
    setBusy(true);
    try {
      await api(path, { method: "POST", body });
      toast.success(message);
      void model.reload();
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href={`/erp/hub?projet=${m.project_id}&onglet=modeles`} className="hover:underline">Hub BIM</Link>}
        title={m.name}
        subtitle={`${layer?.name ?? optionLabel(m.discipline)}${m.description ? ` · ${m.description}` : ""}`}
        actions={
          can("bim:write") ? (
            <Button onClick={() => setUploading(true)}>
              <Upload className="h-4 w-4" /> Nouvelle version
            </Button>
          ) : null
        }
      />
      {federation ? (
        <Card className="p-3">
          <FederatedViewer federation={federation} className="h-[55vh] min-h-[360px]" />
        </Card>
      ) : (
        <Alert tone="info">Aucune version affichable pour le moment (traitement en cours ou échec de conversion).</Alert>
      )}
      <Card>
        <CardHeader title="Versions" />
        <ul className="divide-y divide-line text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span>
                <strong>v{v.number}</strong> · {String(v.source_format).toUpperCase()} · {v.viewer === "aps" ? "Autodesk APS" : "navigateur"} · {dateTime(v.created_at)}
                {v.revision_reason ? <span className="block text-xs text-muted">{v.revision_reason}</span> : null}
                {v.translation_error ? <span className="block text-xs text-red-600">{v.translation_error}</span> : null}
                {v.translation_progress && v.status === "translating" ? <span className="block text-xs text-muted">Conversion : {v.translation_progress}</span> : null}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge status={v.status} />
                {v.published_to_client ? <Badge tone="info">Client</Badge> : null}
                {["ready", "validated", "published"].includes(v.status) ? (
                  <Button size="sm" variant="ghost" onClick={() => setPreview(v.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                ) : null}
                {can("bim:write") || v.viewer === "three" ? (
                  <a href={apiUrl(`/bim/versions/${v.id}/file`)} className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-brand-600 hover:bg-brand-50" aria-label="Télécharger le fichier source">
                    <Download className="h-4 w-4" />
                  </a>
                ) : null}
                {can("bim:validate") && v.status === "ready" ? (
                  <Button size="sm" variant="secondary" loading={busy} onClick={() => act(`/bim/versions/${v.id}/validate`, undefined, "Version validée")}>
                    Valider
                  </Button>
                ) : null}
                {can("bim:validate") && ["validated", "ready"].includes(v.status) ? (
                  <Button size="sm" onClick={() => { setToClient(false); setPublish(v); }}>
                    <Send className="h-4 w-4" /> Publier
                  </Button>
                ) : null}
                {can("bim:write") && v.status === "failed" && v.viewer === "aps" ? (
                  <Button size="sm" variant="secondary" loading={busy} onClick={() => act(`/bim/versions/${v.id}/retry`, undefined, "Conversion relancée")}>
                    Relancer
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
          {!versions.length ? <li className="px-5 py-4 text-muted">Aucune version.</li> : null}
        </ul>
      </Card>
      <Modal
        open={uploading}
        onClose={() => setUploading(false)}
        title="Nouvelle version de la maquette"
        footer={
          <Button
            loading={busy}
            disabled={!file.length}
            onClick={async () => {
              setBusy(true);
              try {
                const fd = new FormData();
                fd.append("file", file[0]);
                if (reason) fd.append("revision_reason", reason);
                await api(`/bim/models/${modelId}/versions`, { method: "POST", form: fd });
                setFile([]);
                setReason("");
                setUploading(false);
                toast.success("Version déposée", "Les formats propriétaires sont convertis par Autodesk APS en arrière-plan.");
                void model.reload();
              } catch (err) {
                toast.error("Dépôt impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Déposer
          </Button>
        }
      >
        <div className="space-y-4">
          <FileDrop files={file} onChange={setFile} accept=".ifc,.rvt,.dwg,.nwd,.skp,.glb,.gltf,.obj,.stl,.fbx,.3ds,.pdf" maxSizeMb={1024} label="IFC, RVT, DWG, NWD, SKP, GLB/GLTF, OBJ, STL…" />
          <Field label="Motif de la révision">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={!!publish}
        onClose={() => setPublish(null)}
        title={`Publier la version v${publish?.number ?? ""}`}
        footer={
          <Button loading={busy} onClick={async () => { await act(`/bim/versions/${publish?.id}/publish`, { to_client: toClient }, "Version publiée"); setPublish(null); }}>
            Publier
          </Button>
        }
      >
        <p className="text-sm">La version publiée devient la référence de coordination ; la précédente devient obsolète.</p>
        {can("projects:publish_client") ? <Checkbox label="Rendre visible dans l'espace client (immersion 3D)" checked={toClient} onChange={setToClient} /> : null}
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- issues */

export function IssuesList({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  const federation = useApi<Federation>(`/projects/${projectId}/bim/federation`);
  return (
    <>
      <ResourceView
        key={version}
        embedded
        config={{
          title: "Issues BIM",
          subtitle: "Questions, observations, défauts et conflits localisés dans la maquette, avec circuit de résolution.",
          path: `/projects/${projectId}/bim/issues`,
          query: { mine: mine || undefined },
          href: (r) => `/erp/hub/issues/${r.id}`,
          columns: [
            { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/hub/issues/${r.id}`}>{r.number}</CellLink> },
            { key: "title", label: "Issue" },
            { key: "kind", label: "Nature", format: "option" },
            { key: "priority", label: "Priorité", render: (r) => <Badge tone={r.priority === "critical" ? "danger" : r.priority === "high" ? "accent" : "neutral"}>{optionLabel(r.priority)}</Badge> },
            { key: "discipline", label: "Discipline", format: "option", hideOnMobile: true },
            { key: "due_date", label: "Échéance", format: "date" },
            { key: "status", label: "Statut", format: "status" },
          ],
          filters: [
            { key: "status", label: "Statut", options: opts(ISSUE_STATUSES) },
            { key: "discipline", label: "Discipline", options: (federation.data?.disciplines ?? []).map((d) => ({ value: d.key, label: d.name })) },
          ],
          toolbar: (
            <div className="flex flex-wrap items-center gap-3">
              <Checkbox label="Mes issues" checked={mine} onChange={setMine} />
              {can("bim:write") ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> Issue
                </Button>
              ) : null}
            </div>
          ),
        }}
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle issue" size="lg">
        <IssueCreate
          projectId={projectId}
          federation={federation.data}
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

export function IssueDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const calls = useCalls();
  const issue = useApi<Row>(`/bim/issues/${id}`);
  const [dialog, setDialog] = useState<null | "edit" | "transition" | "meeting">(null);
  const [target, setTarget] = useState("in_progress");
  const [note, setNote] = useState("");
  const [resolvedIn, setResolvedIn] = useState("");
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [participants, setParticipants] = useState<string | null>(null);
  const [kind, setKind] = useState("video");
  const model = useApi<Row>(issue.data?.model_id ? `/bim/models/${issue.data.model_id}` : null);
  useRealtimeEvent("bim.issue.comment", (data) => {
    if (data?.issue_id === id) void issue.reload();
  });
  if (issue.loading && !issue.data) return <Skeleton className="h-96 w-full" />;
  if (!issue.data) return <Alert tone="danger">{issue.error}</Alert>;
  const i = issue.data;
  const next = (ISSUE_FLOW[i.status] ?? []).filter((s) => s !== "closed" || can("bim:coordinate"));
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href={`/erp/hub?projet=${i.project_id}&onglet=issues`} className="hover:underline">Issues BIM</Link>}
        title={`${i.number} — ${i.title}`}
        subtitle={`${optionLabel(i.kind)} · ${optionLabel(i.priority)}${i.discipline ? ` · ${optionLabel(i.discipline)}` : ""} · créée ${dateTime(i.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={i.status} />
            {i.location?.point || i.viewpoint?.camera ? (
              <Link href={`/erp/hub?projet=${i.project_id}&issue=${i.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                <Crosshair className="h-3.5 w-3.5" /> Voir dans la maquette
              </Link>
            ) : null}
            {can("bim:write") ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog("edit")}>
                Modifier
              </Button>
            ) : null}
            {can("bim:write") && next.length ? (
              <Button
                size="sm"
                onClick={() => {
                  setTarget(next[0]);
                  setNote("");
                  setDialog("transition");
                }}
              >
                Faire évoluer
              </Button>
            ) : null}
            {can("calls:use") ? (
              <Button size="sm" variant="accent" onClick={() => setDialog("meeting")}>
                <Video className="h-4 w-4" /> Réunion
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {i.description ? <Card className="whitespace-pre-line p-5 text-sm">{i.description}</Card> : null}
          {i.resolution_note ? <Alert tone="success" title={`Résolue le ${dateTime(i.resolved_at)}`}>{i.resolution_note}</Alert> : null}
          <Card>
            <CardHeader title="Échanges" />
            <ol className="space-y-3 p-5">
              {((i.comments ?? []) as Row[]).map((c) => (
                <li key={c.id} className="rounded-xl bg-surface p-3 text-sm">
                  <p className="text-xs text-muted">{dateTime(c.created_at)}</p>
                  <p className="whitespace-pre-line">{c.body}</p>
                  {((c.file_ids ?? []) as string[]).length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(c.file_ids as string[]).map((fid) => (
                        <a key={fid} href={apiUrl(`/bim/files/${fid}`)} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 overflow-hidden rounded-lg bg-slate-100">
                          <img src={apiUrl(`/bim/files/${fid}`)} alt="Pièce jointe" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
              {!(i.comments ?? []).length ? <li className="text-sm text-muted">Aucun échange.</li> : null}
            </ol>
            {can("bim:write") || can("site:report") ? (
              <div className="space-y-2 border-t border-line p-4">
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Répondre, préciser, joindre une photo…" />
                <FileDrop files={files} onChange={setFiles} multiple accept="image/*" capture="environment" maxSizeMb={20} label="Photos (facultatif)" />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    loading={busy}
                    disabled={!comment.trim()}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const file_ids: string[] = [];
                        for (const f of files) {
                          const fd = new FormData();
                          fd.append("file", f);
                          file_ids.push((await api<{ file_id: string }>("/bim/files", { method: "POST", form: fd })).file_id);
                        }
                        await api(`/bim/issues/${id}/comments`, { method: "POST", body: { body: comment.trim(), file_ids } });
                        setComment("");
                        setFiles([]);
                        void issue.reload();
                      } catch (err) {
                        toast.error("Envoi impossible", errorMessage(err));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Send className="h-4 w-4" /> Envoyer
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
        <div className="space-y-5">
          {i.snapshot_file_id ? (
            <a href={apiUrl(`/bim/files/${i.snapshot_file_id}`)} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl ring-1 ring-line">
              <img src={apiUrl(`/bim/files/${i.snapshot_file_id}`)} alt="Capture de la maquette" className="w-full" />
            </a>
          ) : null}
          <Card className="p-5">
            <DescriptionList
              columns={1}
              items={[
                { label: "Échéance", value: date(i.due_date) },
                { label: "Maquette", value: model.data ? <CellLink href={`/erp/bim/${model.data.id}`}>{model.data.name}</CellLink> : "—" },
                { label: "Élément", value: i.location?.object ?? "—" },
                { label: "Conflit d'origine", value: i.clash_id ? "Issue créée depuis la détection de conflits" : "—" },
                { label: "Clôturée le", value: i.closed_at ? dateTime(i.closed_at) : "—" },
              ]}
            />
          </Card>
          {((i.annotations ?? []) as Row[]).length ? (
            <Card className="p-5">
              <p className="mb-2 text-xs font-semibold uppercase text-muted">Annotations liées</p>
              <ul className="space-y-1 text-sm">
                {(i.annotations as Row[]).map((a) => (
                  <li key={a.id}>
                    {optionLabel(a.kind)} {a.content ? `· ${a.content}` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Modifier l'issue" size="lg">
        <SchemaForm
          endpoint="PATCH /bim/issues/{issue_id}"
          params={{ issue_id: id }}
          initial={i}
          partial
          fields={{ priority: { options: opts(PRIORITIES) }, assignee_id: { ref: "users" }, description: { widget: "textarea" } }}
          onCancel={() => setDialog(null)}
          onSuccess={(res: Row) => {
            issue.setData({ ...i, ...res });
            setDialog(null);
          }}
        />
      </Modal>
      <Modal
        open={dialog === "transition"}
        onClose={() => setDialog(null)}
        title="Faire évoluer l'issue"
        footer={
          <Button
            loading={busy}
            disabled={target === "resolved" && note.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await api<Row>(`/bim/issues/${id}/transition`, { method: "POST", body: { target, note: note || null, resolved_in_version_id: target === "resolved" && resolvedIn ? resolvedIn : null } });
                issue.setData({ ...i, ...res });
                void issue.reload();
                setDialog(null);
              } catch (err) {
                toast.error("Transition impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmer
          </Button>
        }
      >
        <div className="space-y-3">
          <Select value={target} onChange={(e) => setTarget(e.target.value)} options={next.map((s) => ({ value: s, label: ISSUE_TRANSITION_LABELS[s] ?? optionLabel(s) }))} aria-label="Évolution" />
          {target === "resolved" && model.data ? (
            <Field label="Corrigée dans la version">
              <Select value={resolvedIn} onChange={(e) => setResolvedIn(e.target.value)} options={[{ value: "", label: "—" }, ...((model.data.versions ?? []) as Row[]).map((v) => ({ value: v.id, label: `v${v.number} (${optionLabel(v.status)})` }))]} />
            </Field>
          ) : null}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={target === "resolved" ? "Note de résolution (obligatoire)" : "Commentaire"} />
        </div>
      </Modal>
      <Modal
        open={dialog === "meeting"}
        onClose={() => setDialog(null)}
        title="Réunion de coordination"
        footer={
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await api<{ call_id: string }>(`/bim/issues/${id}/meeting`, { method: "POST", body: { kind, participant_ids: participants ? [participants] : [] } });
                setDialog(null);
                await calls.join(res.call_id, kind === "video");
              } catch (err) {
                toast.error("Appel impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Lancer l'appel
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">L'émetteur et l'assigné de l'issue sont appelés automatiquement.</p>
          <Select value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "video", label: "Visioconférence" }, { value: "audio", label: "Audio" }]} aria-label="Type d'appel" />
          <Field label="Participant supplémentaire">
            <RefSelect source={REFS.users} value={participants} onChange={setParticipants} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- conflits */

function ClashDetection({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const toast = useToast();
  const federation = useApi<Federation>(`/projects/${projectId}/bim/federation`);
  const rules = useApi<{ items: Row[] }>("/bim/clash-rules", { project_id: projectId, page_size: 100 });
  const [ruleId, setRuleId] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Row | null>(null);
  const viewer = useRef<BimViewerHandle>(null);
  const models = (federation.data?.models ?? []).filter((m) => m.viewer === "three");
  const rule = rules.data?.items?.find((r) => r.id === ruleId);
  const subset: Federation | null = federation.data && a && b ? { ...federation.data, models: federation.data.models.filter((m) => [a, b].includes(m.version_id)) } : null;
  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      // Attente du chargement des deux maquettes dans la visionneuse (boîtes englobantes disponibles).
      let elementsA: ReturnType<BimViewerHandle["elements"]> = [];
      let elementsB: ReturnType<BimViewerHandle["elements"]> = [];
      for (let attempt = 0; attempt < 60; attempt++) {
        elementsA = viewer.current?.elements(a) ?? [];
        elementsB = viewer.current?.elements(b) ?? [];
        if (elementsA.length && elementsB.length) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!elementsA.length || !elementsB.length) throw new Error("Maquettes non chargées : vérifiez qu'elles s'affichent dans la visionneuse.");
      const res = await api<Row>(`/projects/${projectId}/bim/clash-detection`, {
        method: "POST",
        body: { rule_id: ruleId, version_a_id: a, version_b_id: b, elements_a: elementsA.slice(0, 50000), elements_b: elementsB.slice(0, 50000) },
      });
      setResult(res);
      onDone();
      toast.success("Détection terminée");
    } catch (err) {
      toast.error("Détection impossible", errorMessage(err));
    } finally {
      setRunning(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Détection assistée" subtitle="Les boîtes englobantes des éléments sont calculées dans votre navigateur puis comparées selon la règle (tolérance, type)." />
      <div className="grid gap-4 p-5 md:grid-cols-3">
        <Field label="Règle">
          <Select value={ruleId} onChange={(e) => setRuleId(e.target.value)} options={[{ value: "", label: "Choisir…" }, ...(rules.data?.items ?? []).filter((r) => r.is_active).map((r) => ({ value: r.id, label: `${r.name} (${r.discipline_a} × ${r.discipline_b})` }))]} />
        </Field>
        <Field label="Maquette A">
          <Select value={a} onChange={(e) => setA(e.target.value)} options={[{ value: "", label: "Choisir…" }, ...models.filter((m) => !rule || m.discipline === rule.discipline_a).map((m) => ({ value: m.version_id, label: `${m.model} v${m.number}` }))]} />
        </Field>
        <Field label="Maquette B">
          <Select value={b} onChange={(e) => setB(e.target.value)} options={[{ value: "", label: "Choisir…" }, ...models.filter((m) => !rule || m.discipline === rule.discipline_b).map((m) => ({ value: m.version_id, label: `${m.model} v${m.number}` }))]} />
        </Field>
      </div>
      {subset ? (
        <div className="px-5">
          <FederatedViewer ref={viewer} federation={subset} className="h-72" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 p-5">
        {result ? (
          <p className="text-sm">
            {Object.entries(result)
              .filter(([, v]) => typeof v === "number")
              .map(([k, v]) => `${optionLabel(k)} : ${v}`)
              .join(" · ")}
          </p>
        ) : (
          <span />
        )}
        <Button loading={running} disabled={!ruleId || !a || !b || a === b} onClick={run}>
          <Radar className="h-4 w-4" /> Lancer la détection
        </Button>
      </div>
    </Card>
  );
}

export function ClashesView({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const stats = useApi<Row>(`/projects/${projectId}/bim/clash-stats`);
  const [version, setVersion] = useState(0);
  return (
    <div className="space-y-6">
      {stats.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Conflits détectés" value={number(stats.data.total ?? 0)} tone="info" />
          <Stat label="Coût évité estimé" value={money(stats.data.estimated_cost_avoided ?? 0)} tone="success" />
          <Stat label="Résolution moyenne" value={stats.data.avg_resolution_hours ? `${number(stats.data.avg_resolution_hours, 1)} h` : "—"} />
          <Stat label="Issues en retard" value={stats.data.issues_overdue ?? 0} tone={toNumber(stats.data.issues_overdue) ? "danger" : "neutral"} />
        </div>
      ) : null}
      {stats.data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Par paire de disciplines" />
            <div className="p-4">
              <BarChartCard data={Object.entries((stats.data.by_discipline_pair ?? {}) as Record<string, number>).map(([pair, count]) => ({ pair, count: toNumber(count) }))} x="pair" series={[{ key: "count", label: "Conflits" }]} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Par statut" />
            <div className="p-4">
              <DonutChart data={Object.entries((stats.data.by_status ?? {}) as Record<string, number>).map(([k, v]) => ({ name: optionLabel(k), value: toNumber(v) }))} />
            </div>
          </Card>
        </div>
      ) : null}
      {can("bim:coordinate") ? <ClashDetection projectId={projectId} onDone={() => { setVersion((x) => x + 1); void stats.reload(); }} /> : null}
      <ResourceView
        key={version}
        embedded
        config={{
          title: "Conflits",
          path: `/projects/${projectId}/bim/clashes`,
          columns: [
            { key: "number", label: "N°" },
            { key: "disciplines", label: "Disciplines", render: (r) => `${optionLabel(r.discipline_a)} × ${optionLabel(r.discipline_b)}` },
            { key: "objects", label: "Éléments", render: (r) => <span className="text-xs">{r.object_a?.name ?? r.object_a?.db_id} ↔ {r.object_b?.name ?? r.object_b?.db_id}</span> },
            { key: "clash_type", label: "Type", format: "option" },
            { key: "severity", label: "Gravité", format: "option" },
            { key: "detection", label: "Détection", format: "option", hideOnMobile: true },
            { key: "status", label: "Statut", format: "status" },
          ],
          filters: [{ key: "status", label: "Statut", options: opts(CLASH_STATUSES) }],
          actions: [
            ...CLASH_STATUSES.filter((s) => s !== "new").map((s) => ({ key: `status-${s}`, label: `Statut : ${optionLabel(s)}`, path: (r: Row) => `/bim/clashes/${r.id}`, method: "PATCH" as const, when: (r: Row) => r.status !== s, perms: ["bim:coordinate"], body: () => ({ status: s }), confirm: `Passer le conflit en « ${optionLabel(s)} » ?` })),
            { key: "issue", label: "Créer une issue", endpoint: "POST /bim/clashes/{clash_id}/issue", when: (r) => !r.issue_id, perms: ["bim:coordinate"], fields: { assignee_id: { ref: "users" } }, success: "Issue créée et assignée" },
          ],
        }}
      />
      <ResourceView
        embedded
        config={{
          title: "Règles de détection",
          path: "/bim/clash-rules",
          query: { project_id: projectId },
          columns: [
            { key: "name", label: "Règle" },
            { key: "pair", label: "Disciplines", render: (r) => `${r.discipline_a} × ${r.discipline_b}` },
            { key: "clash_type", label: "Type", format: "option" },
            { key: "tolerance_mm", label: "Tolérance (mm)", format: "number" },
            { key: "cost_per_clash", label: "Coût évité / conflit", format: "money", align: "right" },
            { key: "is_active", label: "Active", format: "bool" },
          ],
          create: { endpoint: "POST /bim/clash-rules", label: "Nouvelle règle", perms: ["bim:coordinate"], fixed: { project_id: projectId }, fields: { clash_type: { options: opts(["hard", "soft", "clearance", "duplicate"]) }, severity: { options: opts(PRIORITIES) } } },
          update: { endpoint: "PATCH /bim/clash-rules/{item_id}", perms: ["bim:coordinate"], fields: { clash_type: { options: opts(["hard", "soft", "clearance", "duplicate"]) }, severity: { options: opts(PRIORITIES) } } },
          remove: { path: (r) => `/bim/clash-rules/${r.id}`, perms: ["bim:coordinate"] },
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------------- zones, disciplines */

export function ZonesView({ projectId }: { projectId: string }) {
  const [qr, setQr] = useState<Row | null>(null);
  return (
    <>
      <ResourceView
        embedded
        config={{
          title: "Zones spatiales",
          subtitle: "Pièces, niveaux et zones avec QR à afficher sur site : le scan ouvre le contexte BIM de la pièce.",
          path: `/projects/${projectId}/bim/zones`,
          columns: [
            { key: "code", label: "Code" },
            { key: "name", label: "Zone" },
            { key: "level", label: "Niveau" },
            { key: "zone_type", label: "Type", format: "option" },
            { key: "area_m2", label: "Surface (m²)", format: "number" },
            { key: "client_label", label: "Libellé client", hideOnMobile: true },
          ],
          create: {
            endpoint: "POST /projects/{project_id}/bim/zones",
            label: "Nouvelle zone",
            perms: ["bim:write"],
            fixed: { project_id: projectId },
            fields: { zone_type: { options: opts(["piece", "zone", "niveau", "exterieur"]) }, bbox: { hidden: true }, element_ids: { hidden: true }, checklist: { span: 2, label: "Contrôles de réception", render: ({ value, onChange }) => <LabelListEditor value={value} onChange={onChange} label="Contrôle" placeholder="Ex. Prises électriques posées" addLabel="Contrôle de réception" /> } },
          },
          actions: [{ key: "qr", label: "QR de la zone", run: (r) => setQr(r) }],
        }}
      />
      <Modal open={!!qr} onClose={() => setQr(null)} title={`QR — ${qr?.code ?? ""} ${qr?.name ?? ""}`} footer={<Button onClick={() => window.print()}>Imprimer</Button>}>
        {qr ? (
          <div className="text-center">
            <img src={apiUrl(`/bim/zones/${qr.id}/qr`)} alt={`QR de la zone ${qr.name}`} className="mx-auto h-56 w-56" />
            <p className="mt-2 font-semibold">{qr.client_label ?? qr.name}</p>
            <p className="text-xs text-muted">
              {qr.code} {qr.level ? `· niveau ${qr.level}` : ""}
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export function DisciplinesView({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const disciplines = useApi<Row[]>(`/projects/${projectId}/bim/disciplines`);
  const blank = { key: null as string | null, name: "", color: "#385AA6", visible_by_default: true, sort_order: 50 };
  const [form, setForm] = useState(blank);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Calques de disciplines" />
        <ul className="divide-y divide-line text-sm">
          {(disciplines.data ?? []).map((d) => (
            <li key={d.key} className="flex items-center justify-between gap-2 px-5 py-2">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}
              </span>
              <span className="flex items-center gap-2">
                {d.visible_by_default === false ? <Badge>Masqué par défaut</Badge> : null}
                {can("bim:coordinate") ? (
                  <Button size="sm" variant="ghost" onClick={() => setForm({ key: d.key, name: d.name, color: d.color, visible_by_default: d.visible_by_default !== false, sort_order: d.sort_order ?? 50 })}>
                    Modifier
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {can("bim:coordinate") ? (
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{form.key ? `Modifier « ${disciplines.data?.find((d) => d.key === form.key)?.name ?? form.name} »` : "Ajouter une discipline au projet"}</p>
            {form.key ? (
              <Button size="sm" variant="ghost" onClick={() => setForm(blank)}>
                Nouvelle discipline
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Couleur">
              <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </Field>
            <Field label="Ordre">
              <Input type="number" min={0} max={999} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: toNumber(e.target.value) })} />
            </Field>
          </div>
          <Checkbox label="Visible par défaut" checked={form.visible_by_default} onChange={(c) => setForm({ ...form, visible_by_default: c })} />
          <Button
            disabled={form.name.trim().length < 2}
            onClick={async () => {
              try {
                disciplines.setData(await api<Row[]>(`/projects/${projectId}/bim/disciplines`, { method: "PUT", body: { ...form, name: form.name.trim(), key: form.key ?? undefined } }));
                toast.success("Discipline enregistrée");
                setForm(blank);
              } catch (err) {
                toast.error("Enregistrement impossible", errorMessage(err));
              }
            }}
          >
            Enregistrer
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

export function BimHub() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get("projet");
  const tab = params.get("onglet") ?? "maquette";
  const focusIssue = params.get("issue");
  const go = (next: { projet?: string | null; onglet?: string }) => {
    const q = new URLSearchParams();
    const p = next.projet !== undefined ? next.projet : projectId;
    if (p) q.set("projet", p);
    q.set("onglet", next.onglet ?? tab);
    router.replace(`/erp/hub?${q.toString()}`, { scroll: false });
  };
  return (
    <div className="space-y-5">
      <PageTitle
        title="Hub BIM"
        subtitle="Coordination multi-disciplines en temps réel : maquette fédérée, issues localisées, conflits, zones QR."
        actions={
          <div className="w-72">
            <RefSelect source={REFS.projects} value={projectId} onChange={(v) => go({ projet: v })} placeholder="Choisir un projet…" />
          </div>
        }
      />
      {!projectId ? (
        <EmptyState title="Choisissez un projet" text="Le hub BIM rassemble les maquettes, issues et conflits d'un projet." icon={<QrCode className="h-6 w-6" />} />
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={(t) => go({ onglet: t })}
            tabs={[
              { key: "maquette", label: "Maquette fédérée" },
              { key: "modeles", label: "Maquettes" },
              { key: "issues", label: "Issues" },
              { key: "conflits", label: "Conflits" },
              { key: "zones", label: "Zones" },
              { key: "disciplines", label: "Disciplines" },
            ]}
          />
          {tab === "maquette" ? <CoordinationView projectId={projectId} focusIssue={focusIssue} /> : null}
          {tab === "modeles" ? <ModelsList projectId={projectId} /> : null}
          {tab === "issues" ? <IssuesList projectId={projectId} /> : null}
          {tab === "conflits" ? <ClashesView projectId={projectId} /> : null}
          {tab === "zones" ? <ZonesView projectId={projectId} /> : null}
          {tab === "disciplines" ? <DisciplinesView projectId={projectId} /> : null}
        </>
      )}
    </div>
  );
}
