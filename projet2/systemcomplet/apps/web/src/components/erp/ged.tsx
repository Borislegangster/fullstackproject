"use client";

import { ChevronRight, Download, Eye, FileText, Folder, FolderPlus, GitCompare, Lock, PenLine, Search, ShieldCheck, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { RefSelect } from "@/components/forms/ref-select";
import { SchemaForm } from "@/components/forms/schema-form";
import { FilePreviewModal, FileViewer, canPreview, type PreviewSource } from "@/components/ui/file-preview";
import { Checkbox, Field, FileDrop, Input, Select, TagInput, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { OtpDialog } from "@/components/ui/otp-dialog";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, fileSize } from "@/lib/format";
import { useApi, useDebounce } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

const opts = (values: string[]) => values.map((v) => ({ value: v, label: optionLabel(v) }));
export const DOC_TYPES = ["plan", "contrat", "avenant", "facture", "devis", "pv", "rapport", "note_calcul", "cctp", "photo", "fonciers", "administratif", "technique", "qhse", "rh", "autre"];
const DISCIPLINES = ["architecture", "structure", "electricite", "plomberie", "cvc", "vrd", "topographie", "geotechnique", "securite", "autre"];
const CONFIDENTIALITY = ["public", "internal", "confidential", "very_sensitive"];
const VERSION_STATUSES = ["draft", "in_review", "correction", "validated", "published", "obsolete", "archived"];
const VERSION_FLOW: Record<string, string[]> = {
  draft: ["in_review", "validated", "published", "archived"],
  in_review: ["correction", "validated"],
  correction: ["in_review", "draft"],
  validated: ["published", "correction"],
  published: ["obsolete", "archived"],
  obsolete: ["archived"],
};
const TRANSITION_PERMS: Record<string, string> = {
  in_review: "documents:write",
  correction: "documents:approve",
  validated: "documents:approve",
  published: "documents:publish",
  obsolete: "documents:publish",
  archived: "documents:publish",
  draft: "documents:write",
};
const TRANSITION_LABELS: Record<string, string> = {
  in_review: "Soumettre en revue",
  correction: "Demander une correction",
  validated: "Valider",
  published: "Publier (bon pour exécution)",
  obsolete: "Déclarer périmée",
  archived: "Archiver",
  draft: "Repasser en brouillon",
};

function ConfidentialityBadge({ level }: { level?: string }) {
  const tone = level === "very_sensitive" ? "danger" : level === "confidential" ? "accent" : level === "public" ? "success" : "neutral";
  return (
    <Badge tone={tone}>
      <Lock className="mr-1 inline h-3 w-3" />
      {optionLabel(level)}
    </Badge>
  );
}

/* ----------------------------------------------------------------------------- dépôt */

export function DocumentUpload({ projectId, folderId, defaultConfidentiality, onDone, onCancel }: { projectId?: string | null; folderId?: string | null; defaultConfidentiality?: string | null; onDone: (doc: Row) => void; onCancel: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [v, setV] = useState({ title: "", doc_type: "plan", discipline: "", confidentiality: defaultConfidentiality || "internal", description: "", code: "", project_id: projectId ?? null, folder_id: folderId ?? null, site_id: null as string | null, lot_id: null as string | null });
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <FileDrop
        files={files}
        onChange={(f) => {
          setFiles(f);
          if (f[0] && !v.title) setV({ ...v, title: f[0].name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") });
        }}
        maxSizeMb={500}
        label="Plan, note de calcul, PV, maquette IFC… (500 Mo max)"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre" required className="sm:col-span-2">
          <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field label="Type" required>
          <Select value={v.doc_type} onChange={(e) => setV({ ...v, doc_type: e.target.value })} options={opts(DOC_TYPES)} />
        </Field>
        <Field label="Discipline">
          <Select value={v.discipline} onChange={(e) => setV({ ...v, discipline: e.target.value })} options={[{ value: "", label: "—" }, ...opts(DISCIPLINES)]} />
        </Field>
        <Field label="Confidentialité" required>
          <Select value={v.confidentiality} onChange={(e) => setV({ ...v, confidentiality: e.target.value })} options={opts(CONFIDENTIALITY)} />
        </Field>
        <Field label="Code (sinon attribué automatiquement)">
          <Input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="PL-STR-001" />
        </Field>
        <Field label="Projet">
          <RefSelect source={REFS.projects} value={v.project_id} onChange={(id) => setV({ ...v, project_id: id, site_id: null, lot_id: null, folder_id: null })} placeholder="Document général" />
        </Field>
        <Field label="Dossier">
          <RefSelect key={v.project_id ?? "global"} source={{ ...REFS.folders, dependsOn: undefined, query: v.project_id ? { project_id: v.project_id } : undefined }} value={v.folder_id} onChange={(id) => setV({ ...v, folder_id: id })} />
        </Field>
        {v.project_id ? (
          <>
            <Field label="Site">
              <RefSelect source={REFS.sites} value={v.site_id} onChange={(id) => setV({ ...v, site_id: id })} context={{ project_id: v.project_id }} />
            </Field>
            <Field label="Lot">
              <RefSelect source={REFS.lots} value={v.lot_id} onChange={(id) => setV({ ...v, lot_id: id })} context={{ project_id: v.project_id }} />
            </Field>
          </>
        ) : null}
        <Field label="Description" className="sm:col-span-2">
          <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={2} />
        </Field>
        <Field label="Mots-clés" className="sm:col-span-2">
          <TagInput value={tags} onChange={setTags} />
        </Field>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={!files.length || v.title.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const fd = new FormData();
              fd.append("file", files[0]);
              fd.append("title", v.title.trim());
              fd.append("doc_type", v.doc_type);
              fd.append("confidentiality", v.confidentiality);
              fd.append("tags", tags.join(","));
              for (const key of ["discipline", "description", "code", "project_id", "folder_id", "site_id", "lot_id"] as const) {
                const value = v[key];
                if (value) fd.append(key, value);
              }
              onDone(await api<Row>("/documents", { method: "POST", form: fd }));
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Upload className="h-4 w-4" /> Déposer
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------- explorateur */

interface FolderNode {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  children: FolderNode[];
}

function buildTree(rows: Row[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>(rows.map((r) => [r.id, { id: r.id, name: r.name, path: r.path, parent_id: r.parent_id ?? null, children: [] }]));
  const roots: FolderNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: FolderNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

function FolderTree({ nodes, selected, onSelect, depth = 0 }: { nodes: FolderNode[]; selected: string | null; onSelect: (id: string | null) => void; depth?: number }) {
  return (
    <ul>
      {nodes.map((n) => (
        <li key={n.id}>
          <button type="button" onClick={() => onSelect(n.id)} className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm hover:bg-brand-50 ${selected === n.id ? "bg-brand-100 font-semibold text-brand-800" : ""}`} style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}>
            {n.children.length ? <ChevronRight className="h-3.5 w-3.5 text-muted" /> : <span className="w-3.5" />}
            <Folder className="h-4 w-4 text-accent-500" />
            <span className="truncate">{n.name}</span>
          </button>
          {n.children.length ? <FolderTree nodes={n.children} selected={selected} onSelect={onSelect} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}

function FullTextSearch({ projectId }: { projectId: string | null }) {
  const [q, setQ] = useState("");
  const query = useDebounce(q.trim(), 350);
  const hits = useApi<Row[]>(query.length >= 2 ? "/documents/search" : null, { q: query, project_id: projectId ?? undefined });
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche dans le contenu des documents (titres, textes des PDF)…" className="pl-9" />
      </div>
      {query.length >= 2 ? (
        <Card>
          {hits.loading ? (
            <Skeleton className="m-3 h-20" />
          ) : hits.data?.length ? (
            <ul className="divide-y divide-line text-sm">
              {hits.data.map((h) => (
                <li key={h.id} className="px-4 py-2">
                  <CellLink href={`/erp/ged/documents/${h.id}`}>{`${h.code} — ${h.title}`}</CellLink> <StatusBadge status={h.status} /> <span className="text-xs text-muted">{h.version}</span>
                  {/* Extrait mis en évidence par PostgreSQL (ts_headline) : balises <b> uniquement. */}
                  {h.snippet ? <p className="mt-0.5 text-xs text-muted">{String(h.snippet).replace(/<\/?b>/g, "")}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted">Aucun résultat pour « {query} ».</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}

export function GedExplorer() {
  const { can } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [folderLevel, setFolderLevel] = useState("internal");
  const folders = useApi<{ items: Row[] }>("/document-folders", { project_id: projectId ?? undefined, page_size: 500 });
  const tree = useMemo(() => buildTree((folders.data?.items ?? []).filter((f) => (projectId ? f.project_id === projectId : !f.project_id))), [folders.data, projectId]);
  const current = folders.data?.items?.find((f) => f.id === folderId);
  return (
    <div className="space-y-5">
      <PageTitle
        title="GED"
        subtitle="Documents versionnés, circuit d'approbation, publication « bon pour exécution », signature OTP, filigrane et traçabilité des accès."
        actions={
          can("documents:write") ? (
            <Button onClick={() => setUploading(true)}>
              <Upload className="h-4 w-4" /> Déposer un document
            </Button>
          ) : null
        }
      />
      <FullTextSearch projectId={projectId} />
      <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
        <Card className="space-y-3 p-3">
          <RefSelect
            source={REFS.projects}
            value={projectId}
            onChange={(v) => {
              setProjectId(v);
              setFolderId(null);
            }}
            placeholder="Documents généraux"
          />
          <button type="button" onClick={() => setFolderId(null)} className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm hover:bg-brand-50 ${folderId === null ? "bg-brand-100 font-semibold text-brand-800" : ""}`}>
            <FileText className="h-4 w-4" /> Tous les documents
          </button>
          {folders.loading && !folders.data ? <Skeleton className="h-24" /> : <FolderTree nodes={tree} selected={folderId} onSelect={setFolderId} />}
          {can("documents:write") ? (
            <Button size="sm" variant="ghost" onClick={() => { setNewFolder(""); setFolderLevel(current?.default_confidentiality ?? "internal"); }}>
              <FolderPlus className="h-4 w-4" /> {current ? `Sous-dossier de « ${current.name} »` : "Nouveau dossier"}
            </Button>
          ) : null}
        </Card>
        <ResourceView
          key={`${projectId ?? "g"}-${folderId ?? "all"}`}
          embedded
          config={{
            title: current ? current.path : "Documents",
            path: "/documents",
            query: { project_id: projectId ?? undefined, folder_id: folderId ?? undefined },
            href: (r) => `/erp/ged/documents/${r.id}`,
            columns: [
              { key: "code", label: "Code", sortable: true, render: (r) => <CellLink href={`/erp/ged/documents/${r.id}`}>{r.code}</CellLink> },
              { key: "title", label: "Titre", sortable: true },
              { key: "doc_type", label: "Type", format: "option" },
              { key: "current_version", label: "Version", render: (r) => (r.current_version ? `${r.current_version.label}` : "—") },
              { key: "status", label: "Statut", render: (r) => <StatusBadge status={r.current_version?.status} /> },
              { key: "confidentiality", label: "Niveau", render: (r) => <ConfidentialityBadge level={r.confidentiality} />, hideOnMobile: true },
              { key: "updated_at", label: "Modifié", format: "datetime", sortable: true, hideOnMobile: true },
            ],
            filters: [
              { key: "doc_type", label: "Type", options: opts(DOC_TYPES) },
              { key: "discipline", label: "Discipline", options: opts(DISCIPLINES) },
              { key: "status", label: "Statut", options: opts(VERSION_STATUSES) },
            ],
            emptyText: "Aucun document dans ce dossier.",
          }}
        />
      </div>
      <Modal open={uploading} onClose={() => setUploading(false)} title="Déposer un document" size="lg">
        <DocumentUpload projectId={projectId} folderId={folderId} defaultConfidentiality={current?.default_confidentiality} onCancel={() => setUploading(false)} onDone={(doc) => router.push(`/erp/ged/documents/${doc.id}`)} />
      </Modal>
      <Modal
        open={newFolder !== null}
        onClose={() => setNewFolder(null)}
        title="Nouveau dossier"
        footer={
          <Button
            disabled={!newFolder?.trim()}
            onClick={async () => {
              try {
                await api("/document-folders", { method: "POST", body: { name: newFolder?.trim(), parent_id: folderId, project_id: projectId, default_confidentiality: folderLevel } });
                setNewFolder(null);
                void folders.reload();
              } catch (err) {
                toast.error("Création impossible", errorMessage(err));
              }
            }}
          >
            Créer
          </Button>
        }
      >
        <Field label="Nom du dossier">
          <Input value={newFolder ?? ""} onChange={(e) => setNewFolder(e.target.value)} autoFocus />
        </Field>
        <Field label="Confidentialité par défaut" help="Niveau proposé pour les documents déposés dans ce dossier (modifiable à chaque dépôt)." className="mt-3">
          <Select value={folderLevel} onChange={(e) => setFolderLevel(e.target.value)} options={opts(CONFIDENTIALITY)} />
        </Field>
        {current ? <p className="mt-2 text-xs text-muted">Dans {current.path}</p> : null}
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- fiche document */

interface Approver {
  kind: "user" | "role";
  user_id: string | null;
  role: string;
}

export function DocumentDetail({ id }: { id: string }) {
  const { can, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const doc = useApi<Row>(`/documents/${id}`);
  const [tab, setTab] = useState("versions");
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "edit" | "version" | "transition" | "sign" | "delete" | "acl" | "link" | "compare">(null);
  const [target, setTarget] = useState("in_review");
  const [comment, setComment] = useState("");
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [newFile, setNewFile] = useState<File[]>([]);
  const [reason, setReason] = useState("");
  const [major, setMajor] = useState(false);
  const [signRole, setSignRole] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cmp, setCmp] = useState<{ v1: string; v2: string }>({ v1: "", v2: "" });
  const comparison = useApi<Row>(dialog === "compare" && cmp.v1 && cmp.v2 && cmp.v1 !== cmp.v2 ? `/documents/${id}/compare` : null, { v1: cmp.v1, v2: cmp.v2 });
  const versionId = selectedVersion ?? doc.data?.current_version?.id ?? null;
  const approvals = useApi<Row[]>(versionId ? `/document-versions/${versionId}/approvals` : null);
  const accessLog = useApi<Row[]>(tab === "acces" && can("documents:approve") ? `/documents/${id}/access-log` : null);
  const [fullscreen, setFullscreen] = useState(false);
  if (doc.loading && !doc.data) return <Skeleton className="h-96 w-full" />;
  if (!doc.data) return <Alert tone="danger">{doc.error}</Alert>;
  const d = doc.data;
  const versions = (d.versions ?? []) as Row[];
  const version = versions.find((v) => v.id === versionId) ?? d.current_version;
  const nextStates = (VERSION_FLOW[version?.status ?? ""] ?? []).filter((s) => can(TRANSITION_PERMS[s]));
  const viewable = !!version && canPreview(String(version.original_name ?? ""), version.mime_type);
  const previewSource: PreviewSource | null = version
    ? {
        url: apiUrl(`/document-versions/${version.id}/download?inline=true`),
        downloadUrl: apiUrl(`/document-versions/${version.id}/download`),
        name: String(version.original_name ?? d.title),
        mime: version.mime_type,
        size: version.size_bytes,
      }
    : null;
  const reload = () => {
    void doc.reload();
    void approvals.reload();
  };
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/ged" className="hover:underline">GED{d.folder_path ? ` · ${d.folder_path}` : ""}</Link>}
        title={`${d.code} — ${d.title}`}
        subtitle={`${optionLabel(d.doc_type)}${d.discipline ? ` · ${optionLabel(d.discipline)}` : ""} · modifié ${dateTime(d.updated_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ConfidentialityBadge level={d.confidentiality} />
            {d.client_visible ? <Badge tone="info">Visible client</Badge> : null}
            {d.partner_visible ? <Badge tone="info">Visible partenaires</Badge> : null}
            {d.locked ? <Badge tone="warning">Verrouillé (approbation)</Badge> : null}
            {can("documents:write") ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setDialog("edit")}>
                  Propriétés
                </Button>
                <Button size="sm" onClick={() => setDialog("version")} disabled={d.locked}>
                  <Upload className="h-4 w-4" /> Nouvelle version
                </Button>
              </>
            ) : null}
            {versions.length > 1 ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCmp({ v1: versions[1]?.id ?? "", v2: versions[0]?.id ?? "" });
                  setDialog("compare");
                }}
              >
                <GitCompare className="h-4 w-4" /> Comparer
              </Button>
            ) : null}
            {can("documents:write") ? (
              <Button size="sm" variant="ghost" onClick={() => setDialog("delete")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        }
      />
      {version?.status === "obsolete" ? <Alert tone="danger" title="Version périmée">Ne pas utiliser pour l'exécution : consultez la version publiée en vigueur.</Alert> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          {version ? (
            <Card>
              <CardHeader
                title={`Version ${version.label}`}
                subtitle={`${version.original_name} · ${fileSize(version.size_bytes)}${version.page_count ? ` · ${version.page_count} page(s)` : ""} · déposée ${dateTime(version.created_at)}`}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={version.status} />
                    <button type="button" onClick={() => setFullscreen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                      <Eye className="h-3.5 w-3.5" /> Plein écran
                    </button>
                    <a href={apiUrl(`/document-versions/${version.id}/download`)} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                      <Download className="h-3.5 w-3.5" /> Télécharger
                    </a>
                    {nextStates.length ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setTarget(nextStates[0]);
                          setComment("");
                          setApprovers([]);
                          setDialog("transition");
                        }}
                      >
                        Faire évoluer
                      </Button>
                    ) : null}
                    {["validated", "published"].includes(version.status) ? (
                      <Button size="sm" variant="accent" onClick={() => setDialog("sign")}>
                        <PenLine className="h-4 w-4" /> Signer
                      </Button>
                    ) : null}
                  </div>
                }
              />
              {version.revision_reason ? <p className="border-b border-line px-5 py-2 text-sm text-muted">Motif : {version.revision_reason}</p> : null}
              {viewable && previewSource ? (
                <FileViewer source={previewSource} className="h-[70vh] rounded-b-2xl" />
              ) : (
                <div className="p-5 text-sm text-muted">Aperçu non disponible pour ce format ({version.mime_type}) : téléchargez le fichier ou utilisez la visionneuse BIM pour les maquettes IFC.</div>
              )}
              <FilePreviewModal source={fullscreen ? previewSource : null} onClose={() => setFullscreen(false)} />
            </Card>
          ) : (
            <EmptyState title="Aucune version" />
          )}
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "versions", label: "Versions", count: versions.length },
              { key: "circuit", label: "Approbations et signatures" },
              { key: "liens", label: "Liens", count: (d.links ?? []).length },
              { key: "droits", label: "Droits", hidden: !can("documents:approve") },
              { key: "acces", label: "Journal d'accès", hidden: !can("documents:approve") },
            ]}
          />
          {tab === "versions" ? (
            <Card>
              <ul className="divide-y divide-line text-sm">
                {versions.map((v) => (
                  <li key={v.id} className={`flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 ${v.id === versionId ? "bg-brand-50/60" : ""}`}>
                    <button type="button" className="text-left" onClick={() => setSelectedVersion(v.id)}>
                      <span className="font-semibold">{v.label}</span> · {v.original_name}
                      <span className="block text-xs text-muted">
                        {dateTime(v.created_at)}
                        {v.revision_reason ? ` · ${v.revision_reason}` : ""}
                        {v.id === d.published_version_id ? " · version publiée en vigueur" : ""}
                      </span>
                    </button>
                    <StatusBadge status={v.status} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {tab === "circuit" ? (
            <Card>
              <ul className="divide-y divide-line text-sm">
                {(approvals.data ?? []).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                    {a.type === "signature" ? (
                      <span>
                        <ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-600" />
                        Signé par <strong>{a.signer_name}</strong>
                        {a.role ? ` (${a.role})` : ""} le {dateTime(a.signed_at)} · {optionLabel(a.method)} · empreinte {String(a.signed_hash).slice(0, 12)}…
                      </span>
                    ) : (
                      <>
                        <span>
                          Étape {a.step_order} · {a.approver_role ? `rôle ${optionLabel(a.approver_role)}` : "approbateur désigné"}
                          {a.comment ? <span className="block text-xs text-muted">« {a.comment} »</span> : null}
                          {a.decided_at ? <span className="block text-xs text-muted">Décidé le {dateTime(a.decided_at)}</span> : null}
                        </span>
                        <StatusBadge status={a.status} />
                      </>
                    )}
                  </li>
                ))}
                {!approvals.data?.length ? <li className="px-5 py-4 text-muted">Aucune approbation ni signature sur cette version.</li> : null}
              </ul>
            </Card>
          ) : null}
          {tab === "liens" ? (
            <Card>
              <CardHeader title="Rattachements" actions={can("documents:write") ? <Button size="sm" variant="secondary" onClick={() => setDialog("link")}>Rattacher</Button> : null} />
              <ul className="divide-y divide-line text-sm">
                {((d.links ?? []) as Row[]).map((l) => (
                  <li key={l.id} className="px-5 py-2">
                    {optionLabel(l.entity_type)} · <code className="text-xs">{l.entity_id}</code> {l.version_id ? "· version épinglée" : ""}
                  </li>
                ))}
                {!(d.links ?? []).length ? <li className="px-5 py-3 text-muted">Aucun rattachement.</li> : null}
              </ul>
            </Card>
          ) : null}
          {tab === "droits" ? (
            <Card>
              <CardHeader title="Droits spécifiques" subtitle="S'ajoutent aux permissions de rôle ; « refus » masque le document." actions={<Button size="sm" variant="secondary" onClick={() => setDialog("acl")}>Ajouter</Button>} />
              <ul className="divide-y divide-line text-sm">
                {((d.permissions ?? []) as Row[]).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2">
                    <span>
                      {optionLabel(p.principal_type)} <code className="text-xs">{p.principal_value}</code> → <strong>{optionLabel(p.permission)}</strong>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await api(`/document-permissions/${p.id}`, { method: "DELETE" });
                          void doc.reload();
                        } catch (err) {
                          toast.error("Retrait impossible", errorMessage(err));
                        }
                      }}
                    >
                      Retirer
                    </Button>
                  </li>
                ))}
                {!(d.permissions ?? []).length ? <li className="px-5 py-3 text-muted">Aucun droit spécifique.</li> : null}
              </ul>
            </Card>
          ) : null}
          {tab === "acces" ? (
            <Card>
              <ul className="max-h-96 divide-y divide-line overflow-y-auto text-sm">
                {(accessLog.data ?? []).map((a) => (
                  <li key={a.id} className="px-5 py-2">
                    {dateTime(a.created_at)} · {optionLabel(a.action)} · {a.application ?? "web"} {a.watermarked ? "· filigrané" : ""} <span className="text-xs text-muted">utilisateur {String(a.user_id).slice(0, 8)}</span>
                  </li>
                ))}
                {!accessLog.data?.length ? <li className="px-5 py-3 text-muted">Aucun accès enregistré.</li> : null}
              </ul>
            </Card>
          ) : null}
        </div>
        <Card className="h-fit p-5">
          <DescriptionList
            columns={1}
            items={[
              { label: "Description", value: d.description },
              { label: "Projet", value: d.project_id ? <CellLink href={`/erp/chantiers/${d.project_id}`}>Ouvrir le chantier</CellLink> : "Document général" },
              { label: "Mots-clés", value: (d.tags ?? []).join(", ") || "—" },
              { label: "Conservation jusqu'au", value: d.retention_until ?? "—" },
              { label: "Version publiée", value: d.published_version?.label ?? "Aucune" },
              { label: "Créé le", value: dateTime(d.created_at) },
            ]}
          />
        </Card>
      </div>

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Propriétés du document" size="lg">
        <SchemaForm
          endpoint="PATCH /documents/{document_id}"
          params={{ document_id: id }}
          initial={d}
          partial
          exclude={can("documents:publish") ? [] : ["client_visible", "partner_visible"]}
          fields={{
            doc_type: { options: opts(DOC_TYPES) },
            discipline: { options: opts(DISCIPLINES) },
            confidentiality: { options: opts(CONFIDENTIALITY) },
            folder_id: { ref: { ...REFS.folders, dependsOn: undefined, query: d.project_id ? { project_id: d.project_id } : undefined } },
            tags: { widget: "tags" },
            client_visible: { help: "Publie la version en vigueur dans l'espace client (notification envoyée)." },
            retention_until: { help: "Date AAAA-MM-JJ" },
          }}
          onCancel={() => setDialog(null)}
          onSuccess={(res: Row) => {
            doc.setData({ ...d, ...res });
            setDialog(null);
          }}
        />
      </Modal>
      <Modal
        open={dialog === "version"}
        onClose={() => setDialog(null)}
        title="Nouvelle version"
        footer={
          <Button
            loading={busy}
            disabled={!newFile.length || reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                const fd = new FormData();
                fd.append("file", newFile[0]);
                fd.append("reason", reason.trim());
                fd.append("major", major ? "true" : "false");
                const v = await api<Row>(`/documents/${id}/versions`, { method: "POST", form: fd });
                setNewFile([]);
                setReason("");
                setSelectedVersion(v.id);
                setDialog(null);
                reload();
                toast.success(`Version ${v.label} déposée`);
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
          <FileDrop files={newFile} onChange={setNewFile} maxSizeMb={500} />
          <Field label="Motif de la révision" required>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </Field>
          <Checkbox label="Révision majeure (indice suivant)" checked={major} onChange={setMajor} />
        </div>
      </Modal>
      <Modal
        open={dialog === "transition"}
        onClose={() => setDialog(null)}
        title={`Version ${version?.label ?? ""} : faire évoluer`}
        footer={
          <Button
            loading={busy}
            onClick={async () => {
              if (!version) return;
              setBusy(true);
              try {
                await api(`/document-versions/${version.id}/transition`, {
                  method: "POST",
                  body: { target, comment: comment || null, approvers: target === "in_review" ? approvers.filter((a) => (a.kind === "user" ? a.user_id : a.role)).map((a) => (a.kind === "user" ? { user_id: a.user_id } : { role: a.role })) : [] },
                });
                setDialog(null);
                reload();
                toast.success(TRANSITION_LABELS[target]);
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
        <div className="space-y-4">
          <Select value={target} onChange={(e) => setTarget(e.target.value)} options={nextStates.map((s) => ({ value: s, label: TRANSITION_LABELS[s] }))} aria-label="Évolution" />
          {target === "in_review" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Circuit d'approbation (dans l'ordre)</p>
              {approvers.map((a, i) => (
                <div key={i} className="grid grid-cols-[8rem_1fr_auto] gap-2">
                  <Select value={a.kind} onChange={(e) => setApprovers((all) => all.map((x, j) => (j === i ? { ...x, kind: e.target.value as Approver["kind"] } : x)))} options={[{ value: "user", label: "Personne" }, { value: "role", label: "Rôle" }]} aria-label="Type" />
                  {a.kind === "user" ? (
                    <RefSelect source={REFS.users} value={a.user_id} onChange={(v) => setApprovers((all) => all.map((x, j) => (j === i ? { ...x, user_id: v } : x)))} />
                  ) : (
                    <RefSelect source={{ ...REFS.roles, label: (r: Row) => `${r.name} (${r.code})` }} value={a.role || null} onChange={(_v, row) => setApprovers((all) => all.map((x, j) => (j === i ? { ...x, role: row?.code ?? "" } : x)))} />
                  )}
                  <button type="button" aria-label="Retirer" className="rounded p-1.5 text-muted hover:text-red-600" onClick={() => setApprovers((all) => all.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setApprovers((all) => [...all, { kind: "user", user_id: null, role: "" }])}>
                Ajouter une étape
              </Button>
            </div>
          ) : null}
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Commentaire (motif de correction, observations…)" />
          {target === "published" ? <Alert tone="info">La publication rend la version précédente « périmée » et la marque comme référence pour l'exécution.</Alert> : null}
        </div>
      </Modal>
      <OtpDialog
        open={dialog === "sign"}
        onClose={() => setDialog(null)}
        title={`Signer la version ${version?.label ?? ""}`}
        description="Signature électronique avec code à usage unique : l'empreinte du fichier, l'horodatage et votre identité sont scellés."
        channels={[
          { value: "email", label: "Par e-mail" },
          { value: "sms", label: "Par SMS" },
          { value: "whatsapp", label: "Par WhatsApp" },
        ]}
        request={(channel) => api(`/document-versions/${version?.id}/sign/otp`, { method: "POST", body: { channel } })}
        canConfirm={consent}
        confirm={async (challenge, code) => {
          await api(`/document-versions/${version?.id}/sign`, { method: "POST", body: { otp_token: challenge.otp_token, code, consent, role: signRole || null } });
          toast.success("Document signé");
          reload();
        }}
        confirmLabel="Signer"
      >
        <div className="space-y-3">
          <Field label="Qualité du signataire">
            <Input value={signRole} onChange={(e) => setSignRole(e.target.value)} placeholder={user?.roles?.[0] ? optionLabel(user.roles[0]) : "Maître d'œuvre"} />
          </Field>
          <Checkbox label="J'accepte de signer électroniquement ce document ; ma signature a la même valeur qu'une signature manuscrite." checked={consent} onChange={setConsent} />
        </div>
      </OtpDialog>
      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Supprimer le document"
        text="Suppression logique tracée : le document reste récupérable par l'administrateur pendant la durée de conservation."
        reasonLabel="Motif de suppression (10 caractères min.)"
        reasonMin={10}
        tone="danger"
        onConfirm={async (r) => {
          await api(`/documents/${id}/delete`, { method: "POST", body: { reason: r } });
          router.push("/erp/ged");
        }}
      />
      <Modal open={dialog === "acl"} onClose={() => setDialog(null)} title="Droit spécifique">
        <SchemaForm
          endpoint="POST /documents/{document_id}/permissions"
          params={{ document_id: id }}
          initial={{ principal_type: "user", permission: "read" }}
          fields={{
            principal_type: { options: opts(["user", "role", "organization"]) },
            permission: { options: opts(["read", "write", "approve", "sign", "deny"]) },
            principal_value: { help: "Identifiant de l'utilisateur ou de l'organisation, ou code du rôle (ex. CHEF_CHANTIER)." },
          }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            void doc.reload();
          }}
          columns={1}
        />
      </Modal>
      <Modal open={dialog === "link"} onClose={() => setDialog(null)} title="Rattacher le document">
        <SchemaForm
          endpoint="POST /documents/{document_id}/links"
          params={{ document_id: id }}
          initial={{ entity_type: "task", version_id: null }}
          fields={{
            entity_type: { options: opts(["project", "task", "lot", "purchase_order", "subcontract", "situation", "incident", "bim_issue", "change_order", "milestone"]) },
            entity_id: { help: "Identifiant de l'élément (visible dans son URL)." },
            version_id: { options: versions.map((v) => ({ value: v.id, label: `Épingler ${v.label}` })), help: "Facultatif : référence une version précise." },
          }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            void doc.reload();
          }}
          columns={1}
        />
      </Modal>
      <Modal open={dialog === "compare"} onClose={() => setDialog(null)} title="Comparer deux versions" size="xl">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={cmp.v1} onChange={(e) => setCmp({ ...cmp, v1: e.target.value })} options={versions.map((v) => ({ value: v.id, label: `De ${v.label}` }))} aria-label="Version de départ" />
            <Select value={cmp.v2} onChange={(e) => setCmp({ ...cmp, v2: e.target.value })} options={versions.map((v) => ({ value: v.id, label: `À ${v.label}` }))} aria-label="Version d'arrivée" />
          </div>
          {comparison.loading ? (
            <Skeleton className="h-40" />
          ) : comparison.data ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                {comparison.data.identical ? <Badge tone="success">Fichiers identiques</Badge> : <Badge tone="warning">Contenus différents</Badge>}
                <Badge>Similarité {comparison.data.similarity} %</Badge>
                <Badge tone="success">+{comparison.data.added_lines} ligne(s)</Badge>
                <Badge tone="danger">−{comparison.data.removed_lines} ligne(s)</Badge>
              </div>
              {comparison.data.text_available ? (
                <pre className="max-h-[50vh] overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
                  {((comparison.data.diff ?? []) as string[]).map((line, i) => (
                    <div key={i} className={line.startsWith("+") && !line.startsWith("+++") ? "text-emerald-300" : line.startsWith("-") && !line.startsWith("---") ? "text-red-300" : line.startsWith("@@") ? "text-sky-300" : ""}>
                      {line || " "}
                    </div>
                  ))}
                </pre>
              ) : (
                <Alert tone="info">Comparaison textuelle indisponible (format graphique) : comparez visuellement les deux versions.</Alert>
              )}
            </div>
          ) : comparison.error ? (
            <Alert tone="danger">{comparison.error}</Alert>
          ) : (
            <p className="text-sm text-muted">Choisissez deux versions différentes.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
