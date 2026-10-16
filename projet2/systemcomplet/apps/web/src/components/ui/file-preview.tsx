"use client";

import clsx from "clsx";
import {
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Loader2,
  Presentation,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { api, errorMessage } from "@/lib/api";
import { fileSize } from "@/lib/format";

/** Fichier à prévisualiser : `url` = lien d'accès contrôlé existant (affichage en ligne), jamais un lien public. */
export interface PreviewSource {
  url: string;
  name: string;
  mime?: string | null;
  size?: number | null;
  downloadUrl?: string | null;
}

type Kind = "pdf" | "image" | "video" | "audio" | "office" | "other";
interface Sheet {
  name: string;
  columns: number;
  rows: string[][];
  total_rows: number;
  truncated: boolean;
}
type Converted =
  | { kind: "table"; sheets: Sheet[] }
  | { kind: "html"; html: string }
  | { kind: "slides"; slides: { index: number; title: string; lines: string[] }[]; total: number }
  | { kind: "text"; text: string; truncated: boolean };

const OFFICE = /\.(xlsx|xlsm|xls|ods|csv|tsv|docx|odt|pptx|odp|txt|md|json|xml|log|ifc|ya?ml|ini|sql)$/i;
const MAX_CONVERT = 25 * 1024 * 1024;

export function previewKind(name: string, mime?: string | null): Kind {
  const m = (mime ?? "").toLowerCase();
  const n = name.toLowerCase();
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif|svg|bmp)$/.test(n)) return "image";
  if (m.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/.test(n)) return "video";
  if (m.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac)$/.test(n)) return "audio";
  if (OFFICE.test(n)) return "office";
  return "other";
}

export function canPreview(name: string, mime?: string | null): boolean {
  return previewKind(name, mime) !== "other";
}

/** Libellé lisible du format (au lieu du type MIME brut). */
export function formatLabel(name: string, mime?: string | null): string {
  const n = name.toLowerCase();
  const kind = previewKind(name, mime);
  if (kind === "pdf") return "Document PDF";
  if (kind === "image") return "Image";
  if (kind === "video") return "Vidéo";
  if (kind === "audio") return "Audio";
  if (/\.(xlsx|xlsm|xls)$/.test(n)) return "Classeur Excel";
  if (n.endsWith(".ods")) return "Classeur OpenDocument";
  if (/\.(csv|tsv)$/.test(n)) return "Tableau CSV";
  if (n.endsWith(".docx")) return "Document Word";
  if (n.endsWith(".odt")) return "Texte OpenDocument";
  if (n.endsWith(".pptx")) return "Présentation PowerPoint";
  if (n.endsWith(".odp")) return "Présentation OpenDocument";
  if (kind === "office") return "Texte";
  return mime || "Fichier";
}

function KindIcon({ name, mime, className }: { name: string; mime?: string | null; className?: string }) {
  const kind = previewKind(name, mime);
  const n = name.toLowerCase();
  if (kind === "image") return <FileImage className={clsx("text-emerald-500", className)} />;
  if (kind === "video") return <FileVideo className={clsx("text-violet-500", className)} />;
  if (kind === "audio") return <FileAudio className={clsx("text-sky-500", className)} />;
  if (/\.(xlsx|xlsm|xls|ods|csv|tsv)$/.test(n)) return <FileSpreadsheet className={clsx("text-green-600", className)} />;
  if (/\.(pptx|odp)$/.test(n)) return <Presentation className={clsx("text-orange-500", className)} />;
  if (/\.(zip|rar|7z)$/.test(n)) return <FileArchive className={clsx("text-amber-600", className)} />;
  return <FileText className={clsx(kind === "pdf" ? "text-red-500" : "text-brand-500", className)} />;
}

function TableView({ sheets }: { sheets: Sheet[] }) {
  const [active, setActive] = useState(0);
  const [q, setQ] = useState("");
  const sheet = sheets[active] ?? sheets[0];
  const head = sheet?.rows[0];
  const rows = useMemo(() => {
    const body = (sheet?.rows ?? []).slice(1);
    const needle = q.trim().toLowerCase();
    return needle ? body.filter((r) => r.some((c) => c.toLowerCase().includes(needle))) : body;
  }, [sheet, q]);
  if (!sheet) return <Empty text="Classeur vide." />;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer les lignes…" className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-300" />
        </div>
        <p className="text-xs text-muted">
          {rows.length} ligne(s) affichée(s){sheet.truncated ? ` · aperçu des ${sheet.rows.length} premières sur ${sheet.total_rows}` : ""}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          {head ? (
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 w-12 border-b border-r border-line bg-brand-50 px-2 py-2 text-right text-[11px] font-medium text-muted">#</th>
                {head.map((c, i) => (
                  <th key={i} className="whitespace-nowrap border-b border-r border-line bg-brand-50 px-3 py-2 text-left font-semibold text-brand-900">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-brand-50/50">
                <td className="sticky left-0 border-b border-r border-line bg-white px-2 py-1.5 text-right text-[11px] text-muted">{i + 2}</td>
                {r.map((c, j) => (
                  <td key={j} className={clsx("max-w-[28rem] truncate border-b border-r border-line px-3 py-1.5", /^-?[\d\s.,]+%?$/.test(c) && c.trim() ? "text-right tabular-nums" : "")} title={c}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheets.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-t border-line bg-surface px-2 py-1.5">
          {sheets.map((s, i) => (
            <button key={s.name + i} type="button" onClick={() => setActive(i)} className={clsx("shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition", i === active ? "bg-white text-brand-800 shadow ring-1 ring-line" : "text-muted hover:bg-white/70")}>
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const DOC_CSS = `body{font:15px/1.65 Poppins,system-ui,sans-serif;color:#1b2236;max-width:820px;margin:0 auto;padding:40px 32px;background:#fff}
h1,h2,h3,h4{font-family:Gilroy,Poppins,sans-serif;color:#141f3b;line-height:1.25}h1{font-size:28px}h2{font-size:22px}h3{font-size:18px}
table{border-collapse:collapse;width:100%;margin:16px 0;font-size:13px}th,td{border:1px solid #e2e5ec;padding:6px 10px;text-align:left}th{background:#eef2fa}
li{margin:4px 0}`;

function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
      <span className="rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white shadow-lg">
        <Eye className="h-7 w-7" />
      </span>
      <p className="max-w-md text-sm text-muted">{text}</p>
      {action}
    </div>
  );
}

/** Visionneuse intégrée : PDF, images (zoom), vidéo, audio, tableurs (onglets, filtre), Word / OpenDocument
 * (HTML assaini dans un cadre isolé), présentations (diapositives), CSV et texte. */
export function FileViewer({ source, className, onResolved }: { source: PreviewSource; className?: string; onResolved?: (name: string, mime: string) => void }) {
  const resolvedCallback = useRef(onResolved);
  resolvedCallback.current = onResolved;
  const declared = previewKind(source.name, source.mime);
  const native = declared === "pdf" || declared === "image" || declared === "video" || declared === "audio";
  const [resolved, setResolved] = useState<{ kind: Kind; url: string; name: string }>({ kind: declared, url: source.url, name: source.name });
  const [converted, setConverted] = useState<Converted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!native);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setConverted(null);
    setError(null);
    setZoom(1);
    setResolved({ kind: declared, url: source.url, name: source.name });
    if (native) {
      setLoading(false);
      return;
    }
    if (source.size && source.size > MAX_CONVERT) {
      setLoading(false);
      setError("Fichier trop volumineux pour un aperçu (25 Mo max) : téléchargez-le.");
      return;
    }
    // Format inconnu ou bureautique : le lien d'accès existant est lu une fois (en-têtes = nom et type réels).
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setLoading(true);
    (async () => {
      try {
        const response = await fetch(source.url, { credentials: "include", signal: controller.signal, headers: { "X-Client-App": "web" } });
        if (!response.ok) throw new Error(response.status === 403 ? "Accès refusé à ce document." : "Document indisponible.");
        const disposition = response.headers.get("content-disposition") ?? "";
        const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
        const name = match ? decodeURIComponent(match[1] ?? match[2]) : source.name;
        const mime = (response.headers.get("content-type") ?? source.mime ?? "").split(";")[0];
        const kind = previewKind(name, mime);
        resolvedCallback.current?.(name, mime);
        const blob = await response.blob();
        if (kind === "office") {
          const form = new FormData();
          form.append("file", blob, name);
          setConverted(await api<Converted>("/files/preview", { form, signal: controller.signal }));
          setResolved({ kind, url: source.url, name });
        } else if (kind === "other") {
          setResolved({ kind, url: source.url, name });
        } else {
          objectUrl = URL.createObjectURL(blob);
          setResolved({ kind, url: objectUrl, name });
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(errorMessage(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source.url, source.name, source.mime, source.size, declared, native]);

  const download = source.downloadUrl ?? source.url;
  const fallback = (
    <a href={download} className="btn-brand !py-2.5 text-sm" download={source.name}>
      <Download className="h-4 w-4" /> Télécharger
    </a>
  );
  const kind = resolved.kind;
  let body: ReactNode;
  if (loading)
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted">
        <Loader2 className="h-7 w-7 animate-spin text-brand-500" /> Préparation de l&apos;aperçu…
      </div>
    );
  else if (error) body = <Empty text={error} action={fallback} />;
  else if (kind === "pdf") body = <iframe title={`Aperçu de ${resolved.name}`} src={resolved.url} className="h-full w-full bg-slate-100" />;
  else if (kind === "image")
    body = (
      <div className="relative h-full overflow-auto bg-[conic-gradient(#f3f4f6_25%,#fff_0_50%,#f3f4f6_0_75%,#fff_0)] bg-[length:24px_24px]">
        <div className="flex min-h-full min-w-full items-center justify-center p-4">
          <img src={resolved.url} alt={resolved.name} className="max-w-none origin-center shadow-xl transition-transform duration-200" style={{ transform: `scale(${zoom})`, maxHeight: zoom === 1 ? "100%" : undefined, maxWidth: zoom === 1 ? "100%" : undefined }} />
        </div>
        <div className="glass absolute bottom-4 right-4 flex items-center gap-1 rounded-full p-1">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))} className="rounded-full p-2 hover:bg-white" aria-label="Zoom arrière">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setZoom(1)} className="min-w-[3.5rem] rounded-full px-2 py-1 text-xs font-semibold tabular-nums hover:bg-white">
            {Math.round(zoom * 100)} %
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.min(6, z * 1.25))} className="rounded-full p-2 hover:bg-white" aria-label="Zoom avant">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  else if (kind === "video")
    body = (
      <div className="flex h-full items-center justify-center bg-night p-4">
        <video src={resolved.url} controls className="max-h-full max-w-full rounded-xl shadow-2xl" />
      </div>
    );
  else if (kind === "audio")
    body = (
      <div className="flex h-full items-center justify-center bg-night p-6">
        <audio src={resolved.url} controls className="w-full max-w-xl" />
      </div>
    );
  else if (kind === "other") body = <Empty text="Ce format ne peut pas être affiché dans le navigateur (plans CAO, archives…). Téléchargez le fichier ou utilisez la visionneuse BIM pour les maquettes." action={fallback} />;
  else if (!converted) body = <Empty text="Aperçu indisponible." action={fallback} />;
  else if (converted.kind === "table") body = <TableView sheets={converted.sheets} />;
  else if (converted.kind === "html")
    body = <iframe title={`Aperçu de ${resolved.name}`} sandbox="" srcDoc={`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${DOC_CSS}</style></head><body>${converted.html}</body></html>`} className="h-full w-full bg-white" />;
  else if (converted.kind === "slides")
    body = (
      <div className="grid h-full content-start gap-5 overflow-auto bg-surface p-5 sm:grid-cols-2 xl:grid-cols-3">
        {converted.slides.map((s) => (
          <article key={s.index} className="relative flex aspect-video flex-col overflow-hidden rounded-2xl bg-night p-5 text-white shadow-lg">
            <div className="absolute inset-0 bg-blueprint opacity-30" />
            <span className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-300">Diapositive {s.index}</span>
            <h3 className="relative mt-2 line-clamp-2 font-title text-lg font-bold text-white">{s.title}</h3>
            <ul className="relative mt-2 space-y-1 overflow-hidden text-xs text-brand-100">
              {s.lines.slice(0, 7).map((l, i) => (
                <li key={i} className="line-clamp-1">
                  • {l}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    );
  else
    body = (
      <pre className="h-full overflow-auto whitespace-pre-wrap bg-night p-5 font-mono text-xs leading-relaxed text-brand-50">
        {converted.text}
        {converted.truncated ? "\n\n… aperçu tronqué" : ""}
      </pre>
    );
  return <div className={clsx("relative min-h-0 overflow-hidden", className ?? "h-full")}>{body}</div>;
}

/** Aperçu plein écran (Échap pour fermer). */
export function FilePreviewModal({ source, onClose }: { source: PreviewSource | null; onClose: () => void }) {
  const [meta, setMeta] = useState<{ name: string; mime: string } | null>(null);
  useEffect(() => setMeta(null), [source]);
  useEffect(() => {
    if (!source) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [source, onClose]);
  if (!source || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-night-950/75 p-0 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label={`Aperçu : ${source.name}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-7xl animate-fade-in flex-col overflow-hidden bg-white shadow-2xl sm:h-[92vh] sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <span className="rounded-2xl bg-surface p-2.5">
            <KindIcon name={meta?.name ?? source.name} mime={meta?.mime ?? source.mime} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{meta?.name ?? source.name}</p>
            <p className="text-xs text-muted">
              {[formatLabel(meta?.name ?? source.name, meta?.mime ?? source.mime), source.size ? fileSize(source.size) : null, "aperçu sécurisé"].filter(Boolean).join(" · ")}
            </p>
          </div>
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="hidden rounded-xl p-2 text-muted transition hover:bg-surface hover:text-ink sm:inline-flex" aria-label="Ouvrir dans un nouvel onglet">
            <ExternalLink className="h-5 w-5" />
          </a>
          <a href={source.downloadUrl ?? source.url} download={meta?.name ?? source.name} className="rounded-xl p-2 text-muted transition hover:bg-surface hover:text-ink" aria-label="Télécharger">
            <Download className="h-5 w-5" />
          </a>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-muted transition hover:bg-surface hover:text-ink" aria-label="Fermer l'aperçu">
            <X className="h-5 w-5" />
          </button>
        </header>
        <FileViewer source={source} className="flex-1" onResolved={(name, mime) => setMeta({ name, mime })} />
      </div>
    </div>,
    document.body,
  );
}

/** Bouton « Aperçu » autonome (gère sa propre fenêtre). */
export function PreviewButton({ source, label = "Aperçu", className, iconOnly = false }: { source: PreviewSource; label?: string; className?: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx("inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50", className)}
        aria-label={iconOnly ? `${label} : ${source.name}` : undefined}
        title={`${label} : ${source.name}`}
      >
        <Eye className="h-3.5 w-3.5" />
        {iconOnly ? null : label}
      </button>
      <FilePreviewModal source={open ? source : null} onClose={() => setOpen(false)} />
    </>
  );
}

/** Liens de fichiers servis par l'API (contrôle d'accès inchangé) ouverts en aperçu plutôt que téléchargés. */
const FILE_LINK =
  /^\/api\/v1\/(?:files\/signed\/[^/?]+|.+\/(?:file|pdf|download|receipt|proof|payslip|evidence|recording)|.+\/(?:files|photos|documents)\/[0-9a-f-]{36})(?:\?.*)?$/i;

/** Intercepte, dans les espaces connectés, les clics simples sur les liens de fichiers pour afficher l'aperçu
 * intégré (Ctrl / Cmd / clic du milieu et attribut `download` gardent le comportement natif). */
export function FilePreviewHost() {
  const [source, setSource] = useState<PreviewSource | null>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.hasAttribute("download") || link.dataset.noPreview !== undefined) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || !FILE_LINK.test(url.pathname + url.search)) return;
      e.preventDefault();
      const label = (link.getAttribute("aria-label") || link.getAttribute("title") || link.textContent || "Document").trim();
      setSource({ url: url.pathname + url.search, name: label.slice(0, 120) || "Document" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return <FilePreviewModal source={source} onClose={() => setSource(null)} />;
}
