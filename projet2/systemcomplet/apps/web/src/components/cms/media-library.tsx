"use client";

import { Archive, Film, Link2, RefreshCw, RotateCcw, Search, Upload } from "lucide-react";
import { useState } from "react";

import { MediaThumb, thumbUrl } from "@/components/cms/media-picker";
import { Field, FileDrop, Input, Select, TagInput, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Drawer, Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, DescriptionList, EmptyState, PageTitle, Skeleton, Stat } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, fileSize, number } from "@/lib/format";
import { useApi, useDebounce } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

type Row = Record<string, any>;

function MediaDetail({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const media = useApi<Row>(`/cms/media/${id}`);
  const [edit, setEdit] = useState<Row | null>(null);
  const [replace, setReplace] = useState<File[]>([]);
  const [archiving, setArchiving] = useState(false);
  const [busy, setBusy] = useState(false);
  if (media.loading && !media.data) return <Skeleton className="h-96" />;
  if (!media.data) return <Alert tone="danger">{media.error}</Alert>;
  const m = media.data;
  const v = edit ?? { title: m.title ?? "", alt_text: m.alt_text ?? "", caption: m.caption ?? "", credits: m.credits ?? "", folder: m.folder ?? "general", tags: m.tags ?? [], focal_x: m.focal_x, focal_y: m.focal_y };
  const big = m.preview?.variants ? Object.values(m.preview.variants as Record<string, Row>).sort((a, b) => b.width - a.width)[0]?.url : m.preview?.url;
  const save = async () => {
    setBusy(true);
    try {
      await api(`/cms/media/${id}`, { method: "PATCH", body: { ...v, title: v.title || null, alt_text: v.alt_text || null, caption: v.caption || null, credits: v.credits || null } });
      setEdit(null);
      void media.reload();
      onChanged();
      toast.success("Média mis à jour");
    } catch (err) {
      toast.error("Mise à jour impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      {m.kind === "image" || m.kind === "svg" ? (
        <div className="relative overflow-hidden rounded-xl bg-slate-100">
          <img
            src={big ?? thumbUrl(m) ?? ""}
            alt={m.alt_text ?? m.title ?? ""}
            className="w-full cursor-crosshair"
            onClick={(e) => {
              if (!can("media:write")) return;
              const rect = (e.target as HTMLImageElement).getBoundingClientRect();
              setEdit({ ...v, focal_x: Math.round(((e.clientX - rect.left) / rect.width) * 100) / 100, focal_y: Math.round(((e.clientY - rect.top) / rect.height) * 100) / 100 });
            }}
          />
          {v.focal_x !== null && v.focal_x !== undefined ? <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent-500 shadow" style={{ left: `${v.focal_x * 100}%`, top: `${(v.focal_y ?? 0.5) * 100}%` }} /> : null}
        </div>
      ) : m.kind === "external_video" ? (
        <iframe title={m.title ?? "Vidéo"} src={m.preview?.embed_url} className="aspect-video w-full rounded-xl" allowFullScreen />
      ) : m.kind === "video" ? (
        <video src={m.preview?.url} controls className="w-full rounded-xl" />
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
          <MediaThumb asset={m} />
          <a href={m.preview?.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">
            Ouvrir le fichier
          </a>
        </div>
      )}
      {can("media:write") && (m.kind === "image" || m.kind === "svg") ? <p className="text-xs text-muted">Cliquez sur l'image pour définir le point focal (cadrage des recadrages automatiques).</p> : null}
      {!m.alt_text && m.kind === "image" ? <Alert tone="warning">Texte alternatif manquant : obligatoire pour l'accessibilité et le référencement.</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titre">
          <Input value={v.title} onChange={(e) => setEdit({ ...v, title: e.target.value })} disabled={!can("media:write")} />
        </Field>
        <Field label="Dossier">
          <Input value={v.folder} onChange={(e) => setEdit({ ...v, folder: e.target.value })} disabled={!can("media:write")} />
        </Field>
        <Field label="Texte alternatif" className="sm:col-span-2">
          <Input value={v.alt_text} onChange={(e) => setEdit({ ...v, alt_text: e.target.value })} disabled={!can("media:write")} />
        </Field>
        <Field label="Légende" className="sm:col-span-2">
          <Textarea value={v.caption} onChange={(e) => setEdit({ ...v, caption: e.target.value })} rows={2} disabled={!can("media:write")} />
        </Field>
        <Field label="Crédits">
          <Input value={v.credits} onChange={(e) => setEdit({ ...v, credits: e.target.value })} disabled={!can("media:write")} />
        </Field>
        <Field label="Mots-clés">
          <TagInput value={v.tags} onChange={(tags) => setEdit({ ...v, tags })} />
        </Field>
      </div>
      {edit && can("media:write") ? (
        <div className="flex gap-2">
          <Button size="sm" loading={busy} onClick={save}>
            Enregistrer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
            Annuler
          </Button>
        </div>
      ) : null}
      <DescriptionList
        items={[
          { label: "Type", value: optionLabel(m.kind) },
          { label: "Fichier", value: m.original_name ?? m.external_url },
          { label: "Taille", value: m.size_bytes ? fileSize(m.size_bytes) : "—" },
          { label: "Dimensions", value: m.width ? `${m.width} × ${m.height}` : "—" },
          { label: "Utilisations", value: number(m.usage_count ?? 0) },
          { label: "Ajouté le", value: dateTime(m.created_at) },
        ]}
      />
      {((m.usages ?? []) as Row[]).length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-muted">Utilisé dans</p>
          <ul className="space-y-1 text-sm">
            {(m.usages as Row[]).map((u, i) => (
              <li key={i}>
                {optionLabel(u.entity_type ?? u.type)} · {u.title ?? u.label ?? u.entity_id ?? ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {can("media:write") ? (
        <div className="space-y-3 border-t border-line pt-3">
          {m.kind !== "external_video" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Remplacer le fichier (même identifiant : tous les contenus sont mis à jour)</p>
              <FileDrop files={replace} onChange={setReplace} maxSizeMb={200} />
              <Button
                size="sm"
                variant="secondary"
                disabled={!replace.length}
                onClick={async () => {
                  try {
                    const fd = new FormData();
                    fd.append("file", replace[0]);
                    await api(`/cms/media/${id}/replace`, { method: "POST", form: fd });
                    setReplace([]);
                    void media.reload();
                    onChanged();
                    toast.success("Fichier remplacé");
                  } catch (err) {
                    toast.error("Remplacement impossible", errorMessage(err));
                  }
                }}
              >
                <RefreshCw className="h-4 w-4" /> Remplacer
              </Button>
            </div>
          ) : null}
          {m.status === "active" ? (
            <Button size="sm" variant="ghost" onClick={() => setArchiving(true)}>
              <Archive className="h-4 w-4" /> Archiver
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await api(`/cms/media/${id}/restore`, { method: "POST" });
                void media.reload();
                onChanged();
              }}
            >
              <RotateCcw className="h-4 w-4" /> Restaurer
            </Button>
          )}
        </div>
      ) : null}
      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        title="Archiver le média"
        text={m.usage_count ? `Ce média est utilisé ${m.usage_count} fois : l'archivage est refusé sauf forçage par un publicateur.` : "Le média n'apparaîtra plus dans la médiathèque active."}
        tone="danger"
        onConfirm={async () => {
          await api(`/cms/media/${id}/archive`, { method: "POST", query: { force: can("cms:publish") && m.usage_count > 0 } });
          onChanged();
          onClose();
        }}
      />
    </div>
  );
}

export function MediaLibraryPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("active");
  const [orphan, setOrphan] = useState("");
  const [pageSize, setPageSize] = useState(60);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [external, setExternal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadFolder, setUploadFolder] = useState("general");
  const [video, setVideo] = useState({ url: "", title: "", folder: "videos" });
  const [busy, setBusy] = useState(false);
  const query = useDebounce(q, 300);
  const folders = useApi<{ folder: string; count: number }[]>("/cms/media/folders");
  const list = useApi<{ items: Row[]; total: number }>("/cms/media", { q: query || undefined, folder: folder || undefined, kind: kind || undefined, status, orphan: orphan === "" ? undefined : orphan === "true", page_size: pageSize });
  const reload = () => {
    void list.reload();
    void folders.reload();
  };
  const missingAlt = (list.data?.items ?? []).filter((m) => m.kind === "image" && !m.alt_text).length;
  return (
    <div className="space-y-5">
      <PageTitle
        title="Médiathèque"
        subtitle="Images optimisées (WebP / AVIF, variantes responsives), vidéos, documents : tous les médias du site passent par ici."
        actions={
          can("media:write") ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setExternal(true)}>
                <Link2 className="h-4 w-4" /> Vidéo YouTube / Vimeo
              </Button>
              <Button onClick={() => setUploading(true)}>
                <Upload className="h-4 w-4" /> Envoyer des fichiers
              </Button>
            </div>
          ) : null
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Médias" value={number(list.data?.total ?? 0)} tone="info" />
        <Stat label="Dossiers" value={folders.data?.length ?? 0} />
        <Stat label="Sans texte alternatif (affichés)" value={missingAlt} tone={missingAlt ? "warning" : "success"} />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titre, nom de fichier, texte alternatif…" className="pl-9" />
        </div>
        <Select value={folder} onChange={(e) => setFolder(e.target.value)} options={[{ value: "", label: "Tous les dossiers" }, ...(folders.data ?? []).map((f) => ({ value: f.folder, label: `${f.folder} (${f.count})` }))]} aria-label="Dossier" />
        <Select value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "", label: "Tous types" }, { value: "image", label: "Images" }, { value: "svg", label: "SVG" }, { value: "video", label: "Vidéos" }, { value: "external_video", label: "YouTube / Vimeo" }, { value: "document", label: "Documents" }]} aria-label="Type" />
        <Select value={orphan} onChange={(e) => setOrphan(e.target.value)} options={[{ value: "", label: "Toutes utilisations" }, { value: "true", label: "Non utilisés" }, { value: "false", label: "Utilisés" }]} aria-label="Utilisation" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "active", label: "Actifs" }, { value: "archived", label: "Archivés" }]} aria-label="Statut" />
        {can("media:write") ? (
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                const res = await api<Row>("/cms/media-scan", { method: "POST" });
                toast.success("Analyse des utilisations terminée", Object.entries(res).map(([k, v]) => `${optionLabel(k)} : ${v}`).join(" · "));
                reload();
              } catch (err) {
                toast.error("Analyse impossible", errorMessage(err));
              }
            }}
          >
            <RefreshCw className="h-4 w-4" /> Recalculer les usages
          </Button>
        ) : null}
      </div>
      {list.error ? <Alert tone="danger">{list.error}</Alert> : null}
      {list.loading && !list.data ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : list.data?.items.length ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {list.data.items.map((m) => (
            <button key={m.id} type="button" onClick={() => setSelected(m.id)} className="group relative text-left">
              <MediaThumb asset={m} className="aspect-square w-full transition group-hover:ring-2 group-hover:ring-brand-300" />
              <span className="mt-1 block truncate text-xs">{m.title ?? m.original_name}</span>
              <span className="absolute left-1 top-1 flex gap-1">
                {m.kind === "external_video" || m.kind === "video" ? <Film className="h-4 w-4 rounded bg-black/50 p-0.5 text-white" /> : null}
                {!m.alt_text && m.kind === "image" ? <Badge tone="warning">ALT</Badge> : null}
                {!m.usage_count ? <Badge>libre</Badge> : null}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Card className="p-6">
          <EmptyState title="Aucun média" text="Envoyez vos photos de chantier, rendus 3D, vidéos et documents : ils seront optimisés automatiquement." />
        </Card>
      )}
      {list.data && list.data.items.length < list.data.total ? (
        <div className="text-center">
          <Button variant="secondary" onClick={() => setPageSize((n) => n + 60)}>
            Afficher plus ({list.data.total - list.data.items.length})
          </Button>
        </div>
      ) : null}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Média">
        {selected ? <MediaDetail id={selected} onChanged={reload} onClose={() => setSelected(null)} /> : null}
      </Drawer>
      <Modal
        open={uploading}
        onClose={() => setUploading(false)}
        title="Envoyer des fichiers"
        footer={
          <Button
            loading={busy}
            disabled={!files.length}
            onClick={async () => {
              setBusy(true);
              let ok = 0;
              for (const f of files) {
                try {
                  const fd = new FormData();
                  fd.append("file", f);
                  fd.append("folder", uploadFolder || "general");
                  fd.append("title", f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
                  await api("/cms/media", { method: "POST", form: fd });
                  ok += 1;
                } catch (err) {
                  toast.error(`${f.name} refusé`, errorMessage(err));
                }
              }
              setBusy(false);
              setFiles([]);
              setUploading(false);
              reload();
              if (ok) toast.success(`${ok} média(s) ajouté(s)`, "Complétez les textes alternatifs.");
            }}
          >
            Envoyer
          </Button>
        }
      >
        <div className="space-y-3">
          <FileDrop files={files} onChange={setFiles} multiple maxSizeMb={200} />
          <Field label="Dossier">
            <Input value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} list="media-folders" />
            <datalist id="media-folders">
              {(folders.data ?? []).map((f) => (
                <option key={f.folder} value={f.folder} />
              ))}
            </datalist>
          </Field>
        </div>
      </Modal>
      <Modal
        open={external}
        onClose={() => setExternal(false)}
        title="Vidéo YouTube / Vimeo"
        footer={
          <Button
            disabled={!video.url || video.title.length < 2}
            onClick={async () => {
              try {
                await api("/cms/media/external", { method: "POST", body: { url: video.url.trim(), title: video.title.trim(), folder: video.folder || "videos", tags: [] } });
                setVideo({ url: "", title: "", folder: "videos" });
                setExternal(false);
                reload();
              } catch (err) {
                toast.error("Ajout impossible", errorMessage(err));
              }
            }}
          >
            Ajouter
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Adresse de la vidéo" help="Lecture en mode « confidentialité renforcée » (youtube-nocookie).">
            <Input value={video.url} onChange={(e) => setVideo({ ...video, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" />
          </Field>
          <Field label="Titre">
            <Input value={video.title} onChange={(e) => setVideo({ ...video, title: e.target.value })} />
          </Field>
          <Field label="Dossier">
            <Input value={video.folder} onChange={(e) => setVideo({ ...video, folder: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
