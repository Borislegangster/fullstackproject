"use client";

import { Check, Film, FileText, Image as ImageIcon, Plus, Search, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Field, FileDrop, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Button, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi, useDebounce } from "@/lib/hooks";

type Row = Record<string, any>;

/** Plus petite variante d'image exploitable comme vignette (sinon l'original). */
export function thumbUrl(asset?: Row | null): string | null {
  const preview = asset?.preview ?? asset;
  if (!preview) return null;
  if (preview.kind === "external_video") return preview.poster_url ?? null;
  const variants = Object.values((preview.variants ?? {}) as Record<string, Row>).filter((v) => v?.url && v.width);
  variants.sort((a, b) => a.width - b.width);
  return (variants.find((v) => v.width >= 240) ?? variants[variants.length - 1])?.url ?? (String(preview.mime ?? preview.mime_type ?? "").startsWith("image/") ? preview.url : null);
}

export function MediaThumb({ asset, className = "h-20 w-20" }: { asset?: Row | null; className?: string }) {
  const url = thumbUrl(asset);
  const kind = asset?.kind ?? asset?.preview?.kind;
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ${className}`}>
      {url ? (
        <img src={url} alt={asset?.alt_text ?? asset?.title ?? ""} className="h-full w-full object-cover" loading="lazy" />
      ) : kind === "video" || kind === "external_video" ? (
        <Film className="h-6 w-6 text-muted" />
      ) : kind === "document" ? (
        <FileText className="h-6 w-6 text-muted" />
      ) : (
        <ImageIcon className="h-6 w-6 text-muted" />
      )}
    </span>
  );
}

function SelectedMedia({ id, onRemove }: { id: string; onRemove: () => void }) {
  const asset = useApi<Row>(`/cms/media/${id}`);
  return (
    <span className="relative inline-flex flex-col items-center gap-1">
      {asset.loading && !asset.data ? <Skeleton className="h-20 w-20" /> : <MediaThumb asset={asset.data} />}
      <span className="max-w-[5rem] truncate text-[11px] text-muted">{asset.data?.title ?? (asset.error ? "Introuvable" : "")}</span>
      <button type="button" onClick={onRemove} className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 shadow ring-1 ring-line" aria-label="Retirer le média">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/** Bibliothèque : recherche, filtres, envoi, sélection simple ou multiple. */
export function MediaLibraryModal({ open, onClose, onSelect, multiple = false, kind, initial = [] }: { open: boolean; onClose: () => void; onSelect: (ids: string[]) => void; multiple?: boolean; kind?: string; initial?: string[] }) {
  const { can } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [kindFilter, setKindFilter] = useState(kind ?? "");
  const [pageSize, setPageSize] = useState(48);
  const [picked, setPicked] = useState<string[]>(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadFolder, setUploadFolder] = useState("general");
  const [busy, setBusy] = useState(false);
  const query = useDebounce(q, 300);
  const folders = useApi<{ folder: string; count: number }[]>(open ? "/cms/media/folders" : null);
  const list = useApi<{ items: Row[]; total: number }>(open ? "/cms/media" : null, { q: query || undefined, folder: folder || undefined, kind: kindFilter || undefined, page_size: pageSize });
  useEffect(() => {
    if (open) setPicked(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const toggle = (id: string) => setPicked((p) => (multiple ? (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]) : [id]));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Médiathèque"
      size="xl"
      footer={
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{picked.length} sélectionné(s)</span>
          <Button
            disabled={!picked.length}
            onClick={() => {
              onSelect(picked);
              onClose();
            }}
          >
            <Check className="h-4 w-4" /> Utiliser
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titre, nom de fichier, texte alternatif…" className="pl-9" />
          </div>
          <Select value={folder} onChange={(e) => setFolder(e.target.value)} options={[{ value: "", label: "Tous les dossiers" }, ...(folders.data ?? []).map((f) => ({ value: f.folder, label: `${f.folder} (${f.count})` }))]} aria-label="Dossier" />
          {!kind ? <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} options={[{ value: "", label: "Tous types" }, { value: "image", label: "Images" }, { value: "video", label: "Vidéos" }, { value: "external_video", label: "Vidéos YouTube / Vimeo" }, { value: "svg", label: "SVG" }, { value: "document", label: "Documents et modèles 3D" }]} aria-label="Type" /> : null}
        </div>
        {can("media:write") ? (
          <details className="rounded-xl border border-dashed border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">
              <Upload className="mr-1 inline h-4 w-4" /> Envoyer de nouveaux fichiers
            </summary>
            <div className="mt-3 space-y-2">
              <FileDrop files={files} onChange={setFiles} multiple maxSizeMb={200} />
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Dossier">
                  <Input value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} />
                </Field>
                <Button
                  size="sm"
                  loading={busy}
                  disabled={!files.length}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const ids: string[] = [];
                      for (const f of files) {
                        const fd = new FormData();
                        fd.append("file", f);
                        fd.append("folder", uploadFolder || "general");
                        fd.append("title", f.name.replace(/\.[^.]+$/, ""));
                        ids.push((await api<Row>("/cms/media", { method: "POST", form: fd })).id);
                      }
                      setFiles([]);
                      setPicked((p) => (multiple ? [...p, ...ids] : ids.slice(-1)));
                      void list.reload();
                      void folders.reload();
                      toast.success("Médias envoyés", "Pensez à renseigner le texte alternatif (accessibilité, SEO).");
                    } catch (err) {
                      toast.error("Envoi impossible", errorMessage(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" /> Envoyer
                </Button>
              </div>
            </div>
          </details>
        ) : null}
        {list.error ? <Alert tone="danger">{list.error}</Alert> : null}
        <div className="grid max-h-[55vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-5 lg:grid-cols-6">
          {list.loading && !list.data
            ? Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)
            : (list.data?.items ?? []).map((a) => {
                const on = picked.includes(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => toggle(a.id)} className={`group relative text-left ${on ? "ring-2 ring-accent-500" : ""} rounded-xl`}>
                    <MediaThumb asset={a} className="aspect-square w-full" />
                    <span className="mt-1 block truncate text-[11px]">{a.title ?? a.original_name}</span>
                    {!a.alt_text && a.kind === "image" ? <span className="absolute left-1 top-1 rounded bg-amber-500 px-1 text-[10px] font-bold text-white">ALT</span> : null}
                    {on ? <Check className="absolute right-1 top-1 h-5 w-5 rounded-full bg-accent-500 p-0.5 text-white" /> : null}
                  </button>
                );
              })}
        </div>
        {list.data && list.data.items.length < list.data.total ? (
          <div className="text-center">
            <Button variant="secondary" size="sm" onClick={() => setPageSize((n) => n + 48)}>
              Afficher plus ({list.data.total - list.data.items.length})
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/** Champ de formulaire « média » : identifiant(s) de la médiathèque uniquement (jamais d'URL libre). */
export function MediaPicker({ value, onChange, multiple = false, kind, label = "Choisir" }: { value: string | string[] | null | undefined; onChange: (v: any) => void; multiple?: boolean; kind?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const ids = (Array.isArray(value) ? value : value ? [value] : []).map(String);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        {ids.map((id) => (
          <SelectedMedia key={id} id={id} onRemove={() => onChange(multiple ? ids.filter((x) => x !== id) : null)} />
        ))}
        <button type="button" onClick={() => setOpen(true)} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-xs text-muted hover:border-brand-300 hover:text-brand-600">
          <ImageIcon className="h-5 w-5" />
          {ids.length && !multiple ? "Changer" : label}
        </button>
      </div>
      <MediaLibraryModal open={open} onClose={() => setOpen(false)} multiple={multiple} kind={kind} initial={ids} onSelect={(picked) => onChange(multiple ? picked : picked[0] ?? null)} />
    </div>
  );
}
