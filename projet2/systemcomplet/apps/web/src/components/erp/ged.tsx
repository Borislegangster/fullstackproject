"use client";

import { CheckCheck, ChevronRight, Download, Eye, FileText, Files, Folder, FolderPlus, FolderUp, GitCompare, Lock, PenLine, Search, Send, ShieldCheck, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { RefSelect } from "@/components/forms/ref-select";
import { SchemaForm } from "@/components/forms/schema-form";
import { FilePreviewModal, FileViewer, canPreview, type PreviewSource } from "@/components/ui/file-preview";
import { Checkbox, Field, FileDrop, Input, Select, TagInput, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { OtpDialog, type OtpChallenge } from "@/components/ui/otp-dialog";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ApiError, api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, fileSize } from "@/lib/format";
import { useApi, useDebounce } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS, type RefSource } from "@/lib/refs";

const opts = (values: string[]) => values.map((v) => ({ value: v, label: optionLabel(v) }));
/** Type posé par le module BIM sur les maquettes déposées depuis le Hub BIM (pas proposé au dépôt GED). */
const BIM_DOC_TYPE = "maquette_bim";
export const DOC_TYPES = ["plan", "contrat", "avenant", "facture", "devis", "pv", "rapport", "note_calcul", "cctp", "photo", "video", "fonciers", "administratif", "technique", "qhse", "rh", "autre"];
const DISCIPLINES = ["architecture", "structure", "electricite", "plomberie", "cvc", "vrd", "topographie", "geotechnique", "securite", "autre"];
const CONFIDENTIALITY = ["public", "internal", "confidential", "very_sensitive"];
const PHOTO_EXT = ["jpg", "jpeg", "png", "heic", "heif", "webp", "gif", "bmp", "tif", "tiff"];
const VIDEO_EXT = ["mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp", "wmv", "mpg", "mpeg"];
/** Type proposé d'après l'extension (photo, vidéo) ; sinon le type choisi pour l'ensemble du dépôt. */
export function guessDocType(name: string): string | null {
  const ext = name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
  if (PHOTO_EXT.includes(ext)) return "photo";
  if (VIDEO_EXT.includes(ext)) return "video";
  return null;
}
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
          const first = f[0];
          if (first) setV((cur) => ({ ...cur, title: cur.title || fileStem(first.name).replace(/[_-]+/g, " "), doc_type: guessDocType(first.name) ?? cur.doc_type }));
          if (first && !tags.length) setTags([fileStem(first.name)]);
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
        <Field label="Discipline" required>
          <Select value={v.discipline} onChange={(e) => setV({ ...v, discipline: e.target.value })} options={opts(DISCIPLINES)} placeholder="Choisir…" invalid={!!files.length && !v.discipline} />
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
          <RefSelect key={v.project_id ?? "global"} source={folderRef(v.project_id)} value={v.folder_id} onChange={(id) => setV({ ...v, folder_id: id })} placeholder="Racine" />
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
        <Field label="Étiquettes" help="Le nom du fichier par défaut." className="sm:col-span-2">
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
          disabled={!files.length || v.title.trim().length < 2 || !v.discipline}
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

/* ----------------------------------------------------------------------------- import multiple / dossier */

/** Source du sélecteur de dossier : tous les dossiers du projet choisi (ou de la GED générale), avec leur chemin. */
export const folderRef = (projectId?: string | null): RefSource => ({
  path: "/document-folders/tree",
  query: projectId ? { project_id: projectId } : undefined,
  label: (r) => r.path ?? r.name,
  sublabel: (r) => `${r.documents ?? 0} document${r.documents > 1 ? "s" : ""}`,
  paginated: false,
  searchable: false,
});

/** Nom du fichier sans extension : titre et mot-clé du document. */
export const fileStem = (name: string) => name.replace(/\.[^./\\]+$/, "").trim() || name;

const IGNORED_FILES = /^(\.|~\$|thumbs\.db$|desktop\.ini$)/i;
const MAX_IMPORT_MB = 500;

type ImportStatus = "pending" | "uploading" | "done" | "duplicate" | "twin" | "error";
interface ImportItem {
  key: string;
  file: File;
  dir: string;
  status: ImportStatus;
  message?: string;
  sha?: string;
  /** Propriétés propres à chaque fichier (proposées par les valeurs communes, modifiables ligne par ligne). */
  doc_type: string;
  discipline: string;
  tags: string;
}

async function sha256(file: File): Promise<string | undefined> {
  if (typeof crypto === "undefined" || !crypto.subtle || file.size > 300 * 1024 * 1024) return undefined;
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Glisser-déposer d'un dossier : parcours récursif des entrées (Chrome, Edge, Firefox, Safari). */
async function filesFromDrop(items: DataTransferItemList): Promise<{ file: File; dir: string }[]> {
  const out: { file: File; dir: string }[] = [];
  const walk = async (entry: any, dir: string): Promise<void> => {
    if (!entry) return;
    if (entry.isFile) {
      const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject));
      out.push({ file, dir });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const sub = dir ? `${dir}/${entry.name}` : entry.name;
      for (;;) {
        const batch: any[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const child of batch) await walk(child, sub);
      }
    }
  };
  const entries = Array.from(items).map((i) => (typeof i.webkitGetAsEntry === "function" ? i.webkitGetAsEntry() : null));
  for (const entry of entries) await walk(entry, "");
  return out;
}

const STATUS_TEXT: Record<ImportStatus, string> = {
  pending: "En attente",
  uploading: "Envoi…",
  done: "Déposé",
  duplicate: "Déjà dans la GED — ignoré",
  twin: "En double dans la sélection — ignoré",
  error: "Erreur",
};

export function BulkImport({ projectId, folderId, defaultConfidentiality, onDone, onCancel }: { projectId?: string | null; folderId?: string | null; defaultConfidentiality?: string | null; onDone: () => void; onCancel: () => void }) {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [meta, setMeta] = useState({ doc_type: "autre", discipline: "", confidentiality: defaultConfidentiality || "internal", project_id: projectId ?? null, folder_id: folderId ?? null });
  const [keepTree, setKeepTree] = useState(true);
  const [phase, setPhase] = useState<"select" | "running" | "finished">("select");
  const [step, setStep] = useState("");
  const [over, setOver] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    dirInput.current?.setAttribute("webkitdirectory", "");
    dirInput.current?.setAttribute("directory", "");
  }, []);

  const add = (picked: { file: File; dir: string }[]) => {
    setItems((prev) => {
      const seen = new Set(prev.map((i) => `${i.dir}/${i.file.name}/${i.file.size}`));
      const next = [...prev];
      for (const { file, dir } of picked) {
        if (IGNORED_FILES.test(file.name)) continue;
        const id = `${dir}/${file.name}/${file.size}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const tooBig = file.size > MAX_IMPORT_MB * 1024 * 1024;
        next.push({
          key: id,
          file,
          dir,
          status: tooBig ? "error" : "pending",
          message: tooBig ? `Plus de ${MAX_IMPORT_MB} Mo` : undefined,
          doc_type: guessDocType(file.name) ?? meta.doc_type,
          discipline: meta.discipline,
          tags: fileStem(file.name),
        });
      }
      return next;
    });
  };
  const fromInput = (list: FileList | null) => {
    if (!list) return;
    add(
      Array.from(list).map((file) => {
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";
        return { file, dir: rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "" };
      }),
    );
  };
  const patchItem = (key: string, change: Partial<ImportItem>) => setItems((all) => all.map((i) => (i.key === key ? { ...i, ...change } : i)));
  /** Valeur commune : appliquée à tous les fichiers de la liste (puis modifiable fichier par fichier). */
  const applyAll = (key: "doc_type" | "discipline", value: string) => {
    setMeta((m) => ({ ...m, [key]: value }));
    if (value) setItems((all) => all.map((i) => (i.status === "pending" ? { ...i, [key]: value } : i)));
  };

  const run = async () => {
    setPhase("running");
    let queue = items.filter((i) => i.status === "pending");
    // 1. Empreintes : doublons dans la sélection, puis fichiers déjà présents dans la GED du projet
    setStep("Contrôle des doublons…");
    const bySha = new Map<string, string>();
    const hashed: ImportItem[] = [];
    for (const item of queue) {
      const sha = await sha256(item.file).catch(() => undefined);
      if (sha && bySha.has(sha)) {
        patchItem(item.key, { status: "twin", message: `Même contenu que « ${bySha.get(sha)} »` });
        continue;
      }
      if (sha) bySha.set(sha, item.file.name);
      hashed.push({ ...item, sha });
    }
    queue = hashed;
    try {
      const shas = queue.map((i) => i.sha).filter((x): x is string => !!x);
      for (let i = 0; i < shas.length; i += 1000) {
        const found = await api<Row[]>("/documents/check-duplicates", { method: "POST", body: { project_id: meta.project_id, checksums: shas.slice(i, i + 1000) } });
        const where = new Map(found.map((f) => [f.checksum, f.where]));
        queue = queue.filter((item) => {
          if (item.sha && where.has(item.sha)) {
            patchItem(item.key, { status: "duplicate", message: where.get(item.sha) });
            return false;
          }
          return true;
        });
      }
    } catch {
      /* le serveur refuse de toute façon chaque doublon au dépôt */
    }
    // 2. Arborescence : sous-dossiers recréés sous le dossier de destination
    const folderOf = new Map<string, string | null>();
    if (keepTree) {
      const dirs = [...new Set(queue.map((i) => i.dir).filter(Boolean))];
      if (dirs.length) {
        setStep("Création des dossiers…");
        try {
          for (let i = 0; i < dirs.length; i += 500) {
            const ids = await api<Record<string, string>>("/document-folders/ensure", { method: "POST", body: { project_id: meta.project_id, parent_id: meta.folder_id, paths: dirs.slice(i, i + 500), default_confidentiality: meta.confidentiality } });
            for (const [path, id] of Object.entries(ids)) folderOf.set(path, id);
          }
        } catch (err) {
          for (const item of queue) patchItem(item.key, { status: "error", message: `Dossiers : ${errorMessage(err)}` });
          setStep("");
          setPhase("finished");
          return;
        }
      }
    }
    // 3. Dépôt : 3 envois en parallèle ; titre et mot-clé = nom du fichier
    setStep("Envoi des fichiers…");
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const item = queue[next++];
        patchItem(item.key, { status: "uploading" });
        const fd = new FormData();
        const stem = fileStem(item.file.name);
        fd.append("file", item.file);
        fd.append("title", stem.slice(0, 300));
        fd.append("tags", item.tags.trim() || stem.replace(/,/g, " ").slice(0, 100));
        fd.append("doc_type", item.doc_type);
        fd.append("confidentiality", meta.confidentiality);
        if (item.discipline) fd.append("discipline", item.discipline);
        if (meta.project_id) fd.append("project_id", meta.project_id);
        const folder = keepTree && item.dir ? folderOf.get(item.dir) ?? meta.folder_id : meta.folder_id;
        if (folder) fd.append("folder_id", folder);
        try {
          await api<Row>("/documents", { method: "POST", form: fd });
          patchItem(item.key, { status: "done", message: undefined });
        } catch (err) {
          const duplicate = err instanceof ApiError && err.code === "DUPLICATE_DOCUMENT";
          patchItem(item.key, { status: duplicate ? "duplicate" : "error", message: errorMessage(err) });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setStep("");
    setPhase("finished");
  };

  const count = (s: ImportStatus) => items.filter((i) => i.status === s).length;
  const finished = items.filter((i) => i.status !== "pending" && i.status !== "uploading").length;
  const pending = count("pending");
  const missing = items.filter((i) => i.status === "pending" && !i.discipline).length;
  return (
    <div className="space-y-4">
      {phase === "select" ? (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void filesFromDrop(e.dataTransfer.items).then(add);
            }}
            className={`rounded-xl border-2 border-dashed p-6 text-center text-sm ${over ? "border-brand-500 bg-brand-50" : "border-line"}`}
          >
            <p className="font-medium">Glissez ici des fichiers ou un dossier entier</p>
            <p className="mt-1 text-xs text-muted">Chaque fichier devient un document : titre et étiquette = nom du fichier. Type, discipline et étiquettes se règlent fichier par fichier dans la liste. Les doublons sont détectés et ignorés.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => filesInput.current?.click()}>
                <Files className="h-4 w-4" /> Choisir des fichiers
              </Button>
              <Button size="sm" variant="secondary" onClick={() => dirInput.current?.click()}>
                <FolderUp className="h-4 w-4" /> Choisir un dossier
              </Button>
            </div>
            <input ref={filesInput} type="file" multiple hidden onChange={(e) => { fromInput(e.target.files); e.target.value = ""; }} />
            <input ref={dirInput} type="file" multiple hidden onChange={(e) => { fromInput(e.target.files); e.target.value = ""; }} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Projet">
              <RefSelect source={REFS.projects} value={meta.project_id} onChange={(id) => setMeta({ ...meta, project_id: id, folder_id: null })} placeholder="Documents généraux" />
            </Field>
            <Field label="Dossier de destination">
              <RefSelect key={meta.project_id ?? "global"} source={folderRef(meta.project_id)} value={meta.folder_id} onChange={(id) => setMeta({ ...meta, folder_id: id })} placeholder="Racine" />
            </Field>
            <Field label="Type (appliqué à tous les fichiers)" required>
              <Select value={meta.doc_type} onChange={(e) => applyAll("doc_type", e.target.value)} options={opts(DOC_TYPES)} />
            </Field>
            <Field label="Discipline (appliquée à tous les fichiers)" required help="Puis modifiable fichier par fichier dans la liste.">
              <Select value={meta.discipline} onChange={(e) => applyAll("discipline", e.target.value)} options={opts(DISCIPLINES)} placeholder="Choisir…" />
            </Field>
            <Field label="Confidentialité" required>
              <Select value={meta.confidentiality} onChange={(e) => setMeta({ ...meta, confidentiality: e.target.value })} options={opts(CONFIDENTIALITY)} />
            </Field>
            <div className="flex items-end">
              <Checkbox label="Recréer les sous-dossiers" description="Pour un dossier importé : même arborescence dans la GED." checked={keepTree} onChange={setKeepTree} />
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${items.length ? (finished * 100) / items.length : 0}%` }} />
          </div>
          <p className="text-sm text-muted">
            {step || "Terminé."} {finished}/{items.length} traités — {count("done")} déposé{count("done") > 1 ? "s" : ""}, {count("duplicate") + count("twin")} doublon{count("duplicate") + count("twin") > 1 ? "s" : ""} ignoré{count("duplicate") + count("twin") > 1 ? "s" : ""}, {count("error")} erreur{count("error") > 1 ? "s" : ""}.
          </p>
        </div>
      )}
      {phase === "select" && missing ? (
        <Alert tone="warning">
          {missing} fichier{missing > 1 ? "s" : ""} sans discipline : choisissez-la pour tous les fichiers ci-dessus, ou fichier par fichier dans la liste.
        </Alert>
      ) : null}
      {items.length ? (
        <div className="max-h-[22rem] overflow-y-auto rounded-xl border border-line">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-1.5 font-medium">Fichier et étiquettes</th>
                <th className="px-2 py-1.5 font-medium">Type</th>
                <th className="px-2 py-1.5 font-medium">Discipline</th>
                <th className="px-3 py-1.5 text-right font-medium">Taille</th>
                <th className="px-3 py-1.5 font-medium">État</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((i) => (
                <tr key={i.key} className="align-top">
                  <td className="min-w-[12rem] px-3 py-1.5">
                    <span className="block truncate font-medium" title={i.file.name}>
                      {i.file.name}
                    </span>
                    {i.dir && keepTree ? <span className="block truncate text-xs text-muted">{i.dir}</span> : null}
                    {phase === "select" && i.status === "pending" ? (
                      <Input value={i.tags} onChange={(e) => patchItem(i.key, { tags: e.target.value })} aria-label={`Étiquettes de ${i.file.name}`} placeholder="Étiquettes (séparées par des virgules)" className="mt-1 !py-1 !text-xs" />
                    ) : (
                      <span className="block truncate text-xs text-muted">{i.tags}</span>
                    )}
                  </td>
                  <td className="w-36 px-2 py-1.5">
                    {phase === "select" && i.status === "pending" ? (
                      <Select value={i.doc_type} onChange={(e) => patchItem(i.key, { doc_type: e.target.value })} options={opts(DOC_TYPES)} aria-label={`Type de ${i.file.name}`} className="!py-1 !text-xs" />
                    ) : (
                      <span className="text-xs">{optionLabel(i.doc_type)}</span>
                    )}
                  </td>
                  <td className="w-40 px-2 py-1.5">
                    {phase === "select" && i.status === "pending" ? (
                      <Select value={i.discipline} onChange={(e) => patchItem(i.key, { discipline: e.target.value })} options={opts(DISCIPLINES)} placeholder="Choisir…" invalid={!i.discipline} aria-label={`Discipline de ${i.file.name}`} className="!py-1 !text-xs" />
                    ) : (
                      <span className="text-xs">{i.discipline ? optionLabel(i.discipline) : "—"}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs text-muted">{fileSize(i.file.size)}</td>
                  <td className={`px-3 py-1.5 text-xs ${i.status === "done" ? "text-emerald-700" : i.status === "error" ? "text-red-600" : i.status === "duplicate" || i.status === "twin" ? "text-amber-700" : "text-muted"}`}>
                    {STATUS_TEXT[i.status]}
                    {i.message ? <span className="block">{i.message}</span> : null}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {phase === "select" ? (
                      <button type="button" aria-label="Retirer le fichier" className="rounded p-1 text-muted hover:text-red-600" onClick={() => setItems((all) => all.filter((x) => x.key !== i.key))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        {phase === "finished" ? (
          <Button onClick={onDone}>Terminer</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onCancel} disabled={phase === "running"}>
              Annuler
            </Button>
            <Button loading={phase === "running"} disabled={!pending || missing > 0} onClick={() => void run()}>
              <Upload className="h-4 w-4" /> Importer {pending} fichier{pending > 1 ? "s" : ""}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Actions groupées sur les documents cochés : soumission en revue, validation, publication (double regard). */
/** Nombre maximal de documents par appel à /documents/bulk-transition (BulkTransitionIn). */
const BULK_LIMIT = 200;
/** Nombre maximal de documents par appel à /documents/bulk-update et /documents/bulk-sign (un code par lot). */
const BULK_EDIT_LIMIT = 500;
const SIGN_CHANNELS = [
  { value: "email", label: "Par e-mail" },
  { value: "sms", label: "Par SMS" },
  { value: "whatsapp", label: "Par WhatsApp" },
];
type Tri = "" | "yes" | "no";
const TRI_OPTIONS = [
  { value: "yes", label: "Oui, pour toute la sélection" },
  { value: "no", label: "Non, pour toute la sélection" },
];
type BulkResult = { done: Row[]; errors: Row[] };

/** Propriétés communes à plusieurs documents : seules les valeurs renseignées sont appliquées. */
function BulkPropertiesDialog({ open, rows, onClose, onResult }: { open: boolean; rows: Row[]; onClose: () => void; onResult: (label: string, res: BulkResult) => void }) {
  const { can } = useAuth();
  const empty = { client_visible: "" as Tri, partner_visible: "" as Tri, paid_deliverable: "" as Tri, doc_type: "", discipline: "", confidentiality: "", move: "" as "" | "root" | "folder", folder_id: null as string | null };
  const [v, setV] = useState(empty);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setV({ client_visible: "", partner_visible: "", paid_deliverable: "", doc_type: "", discipline: "", confidentiality: "", move: "", folder_id: null });
      setTags([]);
      setError(null);
    }
  }, [open]);
  // Déplacement possible si toute la sélection est dans le même espace (un projet, ou la GED générale).
  const spaces = new Set(rows.map((r) => (r.project_id as string | null) ?? ""));
  const space = spaces.size === 1 ? [...spaces][0] || null : undefined;
  const changes: Row = {};
  for (const key of ["client_visible", "partner_visible", "paid_deliverable"] as const) if (v[key]) changes[key] = v[key] === "yes";
  for (const key of ["doc_type", "discipline", "confidentiality"] as const) if (v[key]) changes[key] = v[key];
  // « Racine » : folder_id explicitement nul (le document sort de tout dossier) ; « Inchangé » : rien d'envoyé.
  if (v.move === "root") changes.folder_id = null;
  else if (v.move === "folder" && v.folder_id) changes.folder_id = v.folder_id;
  if (tags.length) changes.add_tags = tags;
  const unpublished = v.client_visible === "yes" || v.partner_visible === "yes" ? rows.filter((r) => !r.published_version_id).length : 0;
  const submit = async () => {
    setBusy(true);
    setError(null);
    const res: BulkResult = { done: [], errors: [] };
    try {
      for (let i = 0; i < rows.length; i += BULK_EDIT_LIMIT) {
        const part = await api<BulkResult>("/documents/bulk-update", { method: "POST", body: { document_ids: rows.slice(i, i + BULK_EDIT_LIMIT).map((r) => r.id), ...changes } });
        res.done.push(...part.done);
        res.errors.push(...part.errors);
      }
      onClose();
      onResult("Propriétés", res);
    } catch (err) {
      if (res.done.length) {
        onClose();
        onResult("Propriétés", { done: res.done, errors: [...res.errors, { document_id: "lot", code: "Envoi interrompu", message: errorMessage(err) }] });
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const tri = (key: "client_visible" | "partner_visible" | "paid_deliverable", label: string, help?: string) => (
    <Field label={label} help={help}>
      <Select value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value as Tri })} options={TRI_OPTIONS} placeholder="Inchangé" />
    </Field>
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Propriétés de ${rows.length} document${rows.length > 1 ? "s" : ""}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={busy} disabled={!Object.keys(changes).length} onClick={() => void submit()}>
            Appliquer à la sélection
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">Seules les propriétés renseignées sont modifiées ; les autres restent telles quelles sur chaque document.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {can("documents:publish") ? (
            <>
              {tri("client_visible", "Visible par le client", "Publie la version en vigueur dans l'espace client (un seul message au client).")}
              {tri("partner_visible", "Visible par les partenaires")}
            </>
          ) : null}
          {tri("paid_deliverable", "Livrable d'études payant", "Aperçu filigrané pour le client ; l'original lui est remis après règlement de la facture d'études.")}
          <Field label="Type de document">
            <Select value={v.doc_type} onChange={(e) => setV({ ...v, doc_type: e.target.value })} options={opts(DOC_TYPES)} placeholder="Inchangé" />
          </Field>
          <Field label="Discipline">
            <Select value={v.discipline} onChange={(e) => setV({ ...v, discipline: e.target.value })} options={opts(DISCIPLINES)} placeholder="Inchangée" />
          </Field>
          <Field label="Confidentialité">
            <Select value={v.confidentiality} onChange={(e) => setV({ ...v, confidentiality: e.target.value })} options={opts(CONFIDENTIALITY)} placeholder="Inchangée" />
          </Field>
          <Field label="Déplacer" help={space === undefined ? "Sélection répartie sur plusieurs projets : déplacez les documents projet par projet." : undefined}>
            <Select
              value={v.move}
              onChange={(e) => setV({ ...v, move: e.target.value as "" | "root" | "folder", folder_id: null })}
              options={[
                { value: "folder", label: "Dans un dossier…" },
                { value: "root", label: "À la racine (hors dossier)" },
              ]}
              placeholder="Inchangé"
              disabled={space === undefined}
            />
          </Field>
          {v.move === "folder" && space !== undefined ? (
            <Field label="Dossier de destination" required>
              <RefSelect key={space ?? "global"} source={folderRef(space)} value={v.folder_id} onChange={(id) => setV({ ...v, folder_id: id })} placeholder="Choisir…" />
            </Field>
          ) : null}
          <Field label="Ajouter des étiquettes" className="sm:col-span-2">
            <TagInput value={tags} onChange={setTags} />
          </Field>
        </div>
        {unpublished ? (
          <Alert tone="info">
            {unpublished} document{unpublished > 1 ? "s" : ""} de la sélection {unpublished > 1 ? "n'ont" : "n'a"} pas encore de version publiée : ils seront visibles dès leur publication (« bon pour exécution »).
          </Alert>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </Modal>
  );
}

/** Signature de plusieurs documents avec un seul code : la version validée ou publiée de chacun. */
function BulkSignDialog({ open, rows, onClose, onResult }: { open: boolean; rows: Row[]; onClose: () => void; onResult: (label: string, res: BulkResult) => void }) {
  const { user } = useAuth();
  const [consent, setConsent] = useState(false);
  const [role, setRole] = useState("");
  const [info, setInfo] = useState<{ eligible: Row[]; skipped: Row[] } | null>(null);
  useEffect(() => {
    if (open) {
      setConsent(false);
      setInfo(null);
    }
  }, [open]);
  const ids = rows.slice(0, BULK_EDIT_LIMIT).map((r) => r.id as string);
  return (
    <OtpDialog
      open={open}
      onClose={onClose}
      title={`Signer ${ids.length} document${ids.length > 1 ? "s" : ""}`}
      description="Un seul code valide votre signature électronique sur la version validée ou publiée de chaque document sélectionné : empreinte de chaque fichier, horodatage et identité sont scellés."
      channels={SIGN_CHANNELS}
      request={async (channel) => {
        const res = await api<OtpChallenge & { eligible: Row[]; skipped: Row[] }>("/documents/bulk-sign/otp", { method: "POST", body: { document_ids: ids, channel } });
        setInfo({ eligible: res.eligible, skipped: res.skipped });
        return res;
      }}
      canConfirm={consent}
      confirm={async (challenge, code) => {
        const res = await api<{ done: Row[]; errors: Row[]; skipped: Row[] }>("/documents/bulk-sign", { method: "POST", body: { document_ids: ids, otp_token: challenge.otp_token, code, consent, role: role || null } });
        onResult("Signature", { done: res.done, errors: [...res.errors, ...res.skipped] });
      }}
      confirmLabel="Signer la sélection"
    >
      <div className="space-y-3">
        {rows.length > BULK_EDIT_LIMIT ? <Alert tone="warning">Les {BULK_EDIT_LIMIT} premiers documents sont signés en une fois : signez les suivants ensuite.</Alert> : null}
        {info ? (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p>
              <strong>{info.eligible.length}</strong> document{info.eligible.length > 1 ? "s" : ""} à signer
              {info.skipped.length ? `, ${info.skipped.length} écarté${info.skipped.length > 1 ? "s" : ""}` : ""}.
            </p>
            {info.skipped.length ? (
              <ul className="mt-1 max-h-28 overflow-y-auto text-xs text-muted">
                {info.skipped.map((x) => (
                  <li key={x.document_id}>
                    {x.code} — {x.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <Field label="Qualité du signataire">
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={user?.roles?.[0] ? optionLabel(user.roles[0]) : "Maître d'œuvre"} />
        </Field>
        <Checkbox label="J'accepte de signer électroniquement ces documents ; ma signature a la même valeur qu'une signature manuscrite." checked={consent} onChange={setConsent} />
      </div>
    </OtpDialog>
  );
}

function GedBulkActions({ rows, done }: { rows: Row[]; done: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<{ title: string; errors: Row[] } | null>(null);
  const [editing, setEditing] = useState(false);
  const [signing, setSigning] = useState(false);
  const showResult = (label: string, res: BulkResult) => {
    // Le récapitulatif vit dans la barre de sélection : la sélection n'est vidée (done) qu'à sa fermeture.
    if (res.errors.length) setReport({ title: `${label} : ${res.done.length} document${res.done.length > 1 ? "s" : ""} traité${res.done.length > 1 ? "s" : ""}`, errors: res.errors });
    else {
      toast.success(`${label} : ${res.done.length} document${res.done.length > 1 ? "s" : ""}`);
      done();
    }
  };
  const runBulk = async (target: string, label: string) => {
    const eligible = rows.filter((r) => (VERSION_FLOW[r.current_version?.status] ?? []).includes(target));
    if (!eligible.length) {
      toast.error(label, "Aucun document sélectionné n'est au bon statut pour cette action.");
      return;
    }
    setBusy(target);
    // L'API accepte 200 documents par appel : la sélection (qui peut couvrir plusieurs pages) part par lots.
    const res: BulkResult = { done: [], errors: [] };
    try {
      for (let i = 0; i < eligible.length; i += BULK_LIMIT) {
        const part = await api<BulkResult>("/documents/bulk-transition", { method: "POST", body: { document_ids: eligible.slice(i, i + BULK_LIMIT).map((r) => r.id), target } });
        res.done.push(...part.done);
        res.errors.push(...part.errors);
      }
      const skipped = rows.length - eligible.length;
      if (res.errors.length || skipped) {
        setReport({ title: `${label} : ${res.done.length} effectué${res.done.length > 1 ? "s" : ""}${skipped ? `, ${skipped} ignoré${skipped > 1 ? "s" : ""} (statut)` : ""}`, errors: res.errors });
      } else {
        toast.success(`${label} : ${res.done.length} document${res.done.length > 1 ? "s" : ""}`);
        done();
      }
    } catch (err) {
      if (res.done.length) {
        // Un lot a échoué après d'autres déjà enregistrés : récapitulatif de ce qui est fait ; la fermeture vide la
        // sélection et recharge la liste (statuts à jour avant toute nouvelle tentative).
        setReport({
          title: `${label} : ${res.done.length} effectué${res.done.length > 1 ? "s" : ""}, interrompu`,
          errors: [...res.errors, { document_id: "lot", code: "Envoi interrompu", message: errorMessage(err) }],
        });
      } else toast.error(label, errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const actions = [
    { target: "in_review", label: "Soumettre en revue", icon: <Send className="h-4 w-4" /> },
    { target: "validated", label: "Valider", icon: <CheckCheck className="h-4 w-4" /> },
    { target: "published", label: "Publier", icon: <ShieldCheck className="h-4 w-4" /> },
  ].filter((a) => can(TRANSITION_PERMS[a.target]));
  return (
    <>
      {actions.map((a) => (
        <Button key={a.target} size="sm" variant="secondary" loading={busy === a.target} disabled={!!busy} onClick={() => void runBulk(a.target, a.label)}>
          {a.icon} {a.label}
        </Button>
      ))}
      {can("documents:write") ? (
        <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => setEditing(true)}>
          <SlidersHorizontal className="h-4 w-4" /> Propriétés
        </Button>
      ) : null}
      <Button size="sm" variant="accent" disabled={!!busy} onClick={() => setSigning(true)}>
        <PenLine className="h-4 w-4" /> Signer
      </Button>
      <BulkPropertiesDialog open={editing} rows={rows} onClose={() => setEditing(false)} onResult={showResult} />
      <BulkSignDialog open={signing} rows={rows} onClose={() => setSigning(false)} onResult={showResult} />
      <Modal open={!!report} onClose={() => { setReport(null); done(); }} title={report?.title ?? ""}>
        {report?.errors.length ? (
          <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
            {report.errors.map((e) => (
              <li key={e.document_id}>
                <span className="font-semibold">{e.code}</span> — {e.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Les documents ignorés n&apos;étaient pas au statut requis.</p>
        )}
      </Modal>
    </>
  );
}

/* ----------------------------------------------------------------------------- explorateur */

interface FolderNode {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  project_id: string | null;
  project: { id: string; code: string; name: string } | null;
  /** Documents lisibles du dossier lui-même, puis du dossier et de tous ses sous-dossiers. */
  documents: number;
  total: number;
  children: FolderNode[];
}

function buildTree(rows: Row[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>(
    rows.map((r) => [r.id, { id: r.id, name: r.name, path: r.path, parent_id: r.parent_id ?? null, project_id: r.project_id ?? null, project: r.project ?? null, documents: Number(r.documents ?? 0), total: 0, children: [] }]),
  );
  const roots: FolderNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sum = (n: FolderNode): number => (n.total = n.documents + n.children.reduce((acc, c) => acc + sum(c), 0));
  roots.forEach(sum);
  const byName = (a: FolderNode, b: FolderNode) => a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true });
  const sort = (list: FolderNode[]) => {
    list.sort(byName);
    list.forEach((n) => sort(n.children));
  };
  roots.forEach((n) => sort(n.children));
  // Racine : dossiers généraux d'abord, puis ceux de chaque projet (par code), chacun par nom.
  roots.sort((a, b) => Number(!!a.project) - Number(!!b.project) || (a.project?.code ?? "").localeCompare(b.project?.code ?? "") || byName(a, b));
  return roots;
}

function FolderTree({ nodes, selected, onSelect, collapsed, onToggle, showProject, depth = 0 }: { nodes: FolderNode[]; selected: string | null; onSelect: (id: string | null) => void; collapsed: Set<string>; onToggle: (id: string) => void; showProject: boolean; depth?: number }) {
  return (
    <ul>
      {nodes.map((n) => {
        const open = !collapsed.has(n.id);
        return (
          <li key={n.id}>
            <div className={`flex items-center rounded-lg hover:bg-brand-50 ${selected === n.id ? "bg-brand-100 font-semibold text-brand-800" : ""}`} style={{ paddingLeft: `${0.25 + depth * 0.9}rem` }}>
              {n.children.length ? (
                <button type="button" aria-label={`${open ? "Replier" : "Déplier"} ${n.name}`} aria-expanded={open} onClick={() => onToggle(n.id)} className="rounded p-0.5 text-muted hover:text-ink">
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
                </button>
              ) : (
                <span className="w-[1.125rem] shrink-0" />
              )}
              <button type="button" onClick={() => onSelect(n.id)} title={`${n.project ? `${n.project.code} — ${n.project.name}` : "Documents généraux"} · ${n.path}`} className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1 text-left text-sm">
                <Folder className="h-4 w-4 shrink-0 text-accent-500" />
                <span className="truncate">{n.name}</span>
                {showProject && depth === 0 && n.project ? <span className="max-w-[6.5rem] shrink-0 truncate rounded bg-brand-50 px-1 text-[10px] font-medium text-brand-700 ring-1 ring-brand-100">{n.project.code}</span> : null}
                {n.total ? <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-1.5 text-xs tabular-nums text-muted">{n.total}</span> : null}
              </button>
            </div>
            {n.children.length && open ? <FolderTree nodes={n.children} selected={selected} onSelect={onSelect} collapsed={collapsed} onToggle={onToggle} showProject={showProject} depth={depth + 1} /> : null}
          </li>
        );
      })}
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
  const [importing, setImporting] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [newFolderProject, setNewFolderProject] = useState<string | null>(null);
  const [folderLevel, setFolderLevel] = useState("internal");
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  // Sans projet choisi : tous les dossiers (GED générale et chaque projet) ; le projet choisi filtre l'arborescence.
  const folders = useApi<Row[]>("/document-folders/tree", projectId ? { project_id: projectId } : { all_projects: true });
  const tree = useMemo(() => buildTree(folders.data ?? []), [folders.data]);
  const nodes = useMemo(() => {
    const map = new Map<string, FolderNode>();
    const walk = (list: FolderNode[]) =>
      list.forEach((n) => {
        map.set(n.id, n);
        walk(n.children);
      });
    walk(tree);
    return map;
  }, [tree]);
  const current = folderId ? nodes.get(folderId) : undefined;
  const currentRow = folderId ? folders.data?.find((f) => f.id === folderId) : undefined;
  // Espace des dépôts et des nouveaux sous-dossiers : celui du dossier sélectionné, sinon le projet filtré.
  const space = current ? current.project_id : projectId;
  const refresh = () => {
    void folders.reload();
    setListKey((k) => k + 1);
  };
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="space-y-5">
      <PageTitle
        title="GED"
        subtitle="Documents versionnés, circuit d'approbation, publication « bon pour exécution », signature OTP, filigrane et traçabilité des accès."
        actions={
          can("documents:write") ? (
            <>
              <Button variant="secondary" onClick={() => setImporting(true)}>
                <FolderUp className="h-4 w-4" /> Importer plusieurs fichiers ou un dossier
              </Button>
              <Button onClick={() => setUploading(true)}>
                <Upload className="h-4 w-4" /> Déposer un document
              </Button>
            </>
          ) : null
        }
      />
      <FullTextSearch projectId={projectId} />
      <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <Card className="space-y-3 p-3">
          <RefSelect
            source={REFS.projects}
            value={projectId}
            onChange={(v) => {
              setProjectId(v);
              setFolderId(null);
            }}
            placeholder="Tous les projets"
          />
          <button type="button" onClick={() => setFolderId(null)} className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm hover:bg-brand-50 ${folderId === null ? "bg-brand-100 font-semibold text-brand-800" : ""}`}>
            <FileText className="h-4 w-4" /> {projectId ? "Tous les documents du projet" : "Tous les documents"}
          </button>
          {folders.loading && !folders.data ? (
            <Skeleton className="h-24" />
          ) : folders.error ? (
            <Alert tone="danger">{folders.error}</Alert>
          ) : tree.length ? (
            <div className="max-h-[32rem] overflow-y-auto">
              <FolderTree nodes={tree} selected={folderId} onSelect={setFolderId} collapsed={collapsed} onToggle={toggle} showProject={!projectId} />
            </div>
          ) : (
            <p className="px-2 text-xs text-muted">Aucun dossier {projectId ? "dans ce projet" : ""}.</p>
          )}
          {can("documents:write") ? (
            <div className="flex flex-wrap gap-1 border-t border-line pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNewFolder("");
                  setNewFolderProject(projectId);
                  setFolderLevel(currentRow?.default_confidentiality ?? "internal");
                }}
              >
                <FolderPlus className="h-4 w-4" /> {current ? "Sous-dossier" : "Nouveau dossier"}
              </Button>
              {current ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setRenaming(current.name)}>
                    <PenLine className="h-4 w-4" /> Renommer
                  </Button>
                  <Button size="sm" variant="ghost" disabled={current.total > 0} title={current.total > 0 ? "Le dossier contient des documents" : "Supprimer ce dossier vide"} onClick={() => setDeleting(true)}>
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
          {current && current.total > 0 && can("documents:write") ? <p className="px-1 text-xs text-muted">Un dossier se supprime une fois vide : déplacez ou supprimez d&apos;abord ses documents.</p> : null}
        </Card>
        <ResourceView
          key={`${projectId ?? "g"}-${folderId ?? "all"}-${listKey}`}
          embedded
          config={{
            title: current ? `${current.project ? `${current.project.code} · ` : ""}${current.path}` : projectId ? "Documents du projet" : "Tous les documents",
            path: "/documents",
            query: { project_id: projectId ?? undefined, folder_id: folderId ?? undefined, recursive: folderId ? true : undefined },
            href: (r) => `/erp/ged/documents/${r.id}`,
            columns: [
              { key: "code", label: "Code", sortable: true, render: (r) => <CellLink href={`/erp/ged/documents/${r.id}`}>{r.code}</CellLink> },
              { key: "title", label: "Titre", sortable: true },
              {
                key: "place",
                label: "Emplacement",
                render: (r) => (
                  <span className="block max-w-[16rem] text-xs">
                    <span className="block truncate font-medium" title={r.project ? `${r.project.code} — ${r.project.name}` : "Documents généraux"}>
                      {r.project ? `${r.project.code} — ${r.project.name}` : "Documents généraux"}
                    </span>
                    <span className="flex items-center gap-1 truncate text-muted" title={r.folder_path ?? "Racine"}>
                      <Folder className="h-3 w-3 shrink-0" /> {r.folder_path ?? "Racine"}
                    </span>
                  </span>
                ),
              },
              { key: "doc_type", label: "Type", format: "option", hideOnMobile: true },
              { key: "discipline", label: "Discipline", format: "option", hideOnMobile: true },
              { key: "current_version", label: "Version", render: (r) => (r.current_version ? `${r.current_version.label}` : "—") },
              { key: "status", label: "Statut", render: (r) => <StatusBadge status={r.current_version?.status} /> },
              {
                key: "visibility",
                label: "Diffusion",
                hideOnMobile: true,
                render: (r) => (
                  <span className="flex flex-wrap gap-1">
                    {r.client_visible ? <Badge tone="info">Client</Badge> : null}
                    {r.partner_visible ? <Badge tone="info">Partenaires</Badge> : null}
                    {r.paid_deliverable ? <Badge tone="accent">Livrable payant</Badge> : null}
                    {!r.client_visible && !r.partner_visible && !r.paid_deliverable ? <span className="text-xs text-muted">Interne</span> : null}
                  </span>
                ),
              },
              { key: "confidentiality", label: "Niveau", render: (r) => <ConfidentialityBadge level={r.confidentiality} />, hideOnMobile: true },
              { key: "updated_at", label: "Modifié", format: "datetime", sortable: true, hideOnMobile: true },
            ],
            filters: [
              { key: "doc_type", label: "Type", options: opts([...DOC_TYPES, BIM_DOC_TYPE]) },
              { key: "discipline", label: "Discipline", options: opts(DISCIPLINES) },
              { key: "status", label: "Statut", options: opts(VERSION_STATUSES) },
            ],
            emptyText: current ? "Aucun document dans ce dossier ni dans ses sous-dossiers." : "Aucun document.",
            bulkActions: (rows, done) => <GedBulkActions rows={rows} done={done} />,
          }}
        />
      </div>
      <Modal open={importing} onClose={() => setImporting(false)} title="Importer plusieurs fichiers ou un dossier" size="xl">
        {importing ? (
          <BulkImport
            projectId={space}
            folderId={folderId}
            defaultConfidentiality={currentRow?.default_confidentiality}
            onCancel={() => setImporting(false)}
            onDone={() => {
              setImporting(false);
              refresh();
            }}
          />
        ) : null}
      </Modal>
      <Modal open={uploading} onClose={() => setUploading(false)} title="Déposer un document" size="lg">
        <DocumentUpload projectId={space} folderId={folderId} defaultConfidentiality={currentRow?.default_confidentiality} onCancel={() => setUploading(false)} onDone={(doc) => router.push(`/erp/ged/documents/${doc.id}`)} />
      </Modal>
      <Modal
        open={newFolder !== null}
        onClose={() => setNewFolder(null)}
        title={current ? `Sous-dossier de « ${current.name} »` : "Nouveau dossier"}
        footer={
          <Button
            loading={saving}
            disabled={!newFolder?.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                const created = await api<Row>("/document-folders", { method: "POST", body: { name: newFolder?.trim(), parent_id: folderId, project_id: current ? current.project_id : newFolderProject, default_confidentiality: folderLevel } });
                setNewFolder(null);
                await folders.reload();
                setFolderId(created.id);
                toast.success("Dossier créé", created.path);
              } catch (err) {
                toast.error("Création impossible", errorMessage(err));
              } finally {
                setSaving(false);
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
        {current ? (
          <p className="mt-2 text-xs text-muted">
            Dans {current.project ? `${current.project.code} · ` : "Documents généraux · "}
            {current.path}
          </p>
        ) : (
          <Field label="Projet" help="Vide : dossier de la GED générale (documents de l'entreprise)." className="mt-3">
            <RefSelect source={REFS.projects} value={newFolderProject} onChange={setNewFolderProject} placeholder="Documents généraux" />
          </Field>
        )}
        <Field label="Confidentialité par défaut" help="Niveau proposé pour les documents déposés dans ce dossier (modifiable à chaque dépôt)." className="mt-3">
          <Select value={folderLevel} onChange={(e) => setFolderLevel(e.target.value)} options={opts(CONFIDENTIALITY)} />
        </Field>
      </Modal>
      <Modal
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Renommer le dossier"
        footer={
          <Button
            loading={saving}
            disabled={!renaming?.trim() || renaming.trim() === current?.name}
            onClick={async () => {
              if (!current) return;
              setSaving(true);
              try {
                const renamed = await api<Row>(`/document-folders/${current.id}`, { method: "PATCH", body: { name: renaming?.trim() } });
                setRenaming(null);
                refresh();
                toast.success("Dossier renommé", renamed.path);
              } catch (err) {
                toast.error("Renommage impossible", errorMessage(err));
              } finally {
                setSaving(false);
              }
            }}
          >
            Renommer
          </Button>
        }
      >
        <Field label="Nouveau nom">
          <Input value={renaming ?? ""} onChange={(e) => setRenaming(e.target.value)} autoFocus />
        </Field>
      </Modal>
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Supprimer le dossier « ${current?.name ?? ""} »`}
        text={current?.children.length ? "Ce dossier et ses sous-dossiers ne contiennent aucun document : ils seront supprimés définitivement." : "Ce dossier ne contient aucun document : il sera supprimé définitivement."}
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={async () => {
          if (!current) return;
          await api(`/document-folders/${current.id}`, { method: "DELETE" });
          toast.success("Dossier supprimé", current.path);
          setFolderId(current.parent_id);
          refresh();
        }}
      />
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
              { label: "Projet", value: d.project ? <CellLink href={`/erp/chantiers/${d.project.id}`}>{`${d.project.code} — ${d.project.name}`}</CellLink> : "Documents généraux" },
              { label: "Dossier", value: d.folder_path ?? "Racine" },
              { label: "Mots-clés", value: (d.tags ?? []).join(", ") || "—" },
              { label: "Conservation jusqu'au", value: d.retention_until ? date(d.retention_until) : "—" },
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
            doc_type: { options: opts(d.doc_type === BIM_DOC_TYPE ? [...DOC_TYPES, BIM_DOC_TYPE] : DOC_TYPES) },
            discipline: { options: opts(DISCIPLINES) },
            confidentiality: { options: opts(CONFIDENTIALITY) },
            folder_id: { ref: folderRef(d.project_id) },
            tags: { widget: "tags" },
            client_visible: { help: "Publie la version en vigueur dans l'espace client (notification envoyée)." },
            retention_until: { help: "Date jusqu'à laquelle le document doit être conservé (archivage légal)." },
            paid_deliverable: { label: "Livrable d'études payant", help: "Le client le consulte en aperçu filigrané et le valide ; l'original lui est remis après règlement de la facture d'études." },
            unlock_invoice_id: {
              label: "Facture d'études qui débloque le livrable",
              ref: { ...REFS.clientInvoices, query: d.project_id ? { project_id: d.project_id } : undefined },
              visibleIf: (v) => !!v.paid_deliverable,
            },
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
