"use client";

import { Bold, Code2, FileCode2, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Quote, RemoveFormatting, Underline } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { MediaLibraryModal } from "@/components/cms/media-picker";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";

type Row = Record<string, any>;

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Variantes d'image proposées à l'insertion (générées par la médiathèque). */
const IMAGE_SIZES = [
  { value: "md", label: "Moyenne (960 px)" },
  { value: "thumb", label: "Petite (320 px)" },
  { value: "lg", label: "Grande (1 920 px)" },
  { value: "original", label: "Originale" },
];
const IMAGE_ALIGNS = [
  { value: "center", label: "Centrée" },
  { value: "left", label: "À gauche, texte autour" },
  { value: "right", label: "À droite, texte autour" },
  { value: "full", label: "Pleine largeur" },
];

/** HTML assaini par l'API (exactement ce qui sera enregistré et affiché) + ce qui a été retiré. */
async function previewHtml(html: string): Promise<{ html: string; warnings: string[] }> {
  return api<{ html: string; warnings: string[] }>("/cms/html/preview", { method: "POST", body: { html } });
}

/** Insertion d'une image de la médiathèque : choix du média puis taille, alignement, texte alternatif, légende. */
function InsertImageDialog({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (html: string) => void }) {
  const toast = useToast();
  const [asset, setAsset] = useState<Row | null>(null);
  const [opts, setOpts] = useState({ size: "md", align: "center", alt: "", caption: "" });
  // La bibliothèque se ferme juste après la sélection : ne pas fermer l'insertion à ce moment-là.
  const picked = useRef(false);
  useEffect(() => {
    if (!open) setAsset(null);
    picked.current = false;
  }, [open]);
  const pick = async (ids: string[]) => {
    if (!ids[0]) return;
    try {
      const row = await api<Row>(`/cms/media/${ids[0]}`);
      setAsset(row);
      setOpts({ size: "md", align: "center", alt: row.alt_text ?? row.title ?? "", caption: row.caption ?? "" });
    } catch (err) {
      toast.error("Média indisponible", errorMessage(err));
      onClose();
    }
  };
  const variants: Row = asset?.preview?.variants ?? {};
  const variant = opts.size !== "original" && !variants[opts.size] ? "original" : opts.size;
  const dims = variant === "original" ? { width: asset?.width, height: asset?.height } : variants[variant] ?? {};
  const insert = () => {
    if (!asset) return;
    const size = dims.width && dims.height ? ` width="${dims.width}" height="${dims.height}"` : "";
    const img = `<img src="/api/v1/public/media/${asset.id}/${variant}" alt="${escapeHtml(opts.alt)}"${size} loading="lazy">`;
    const caption = opts.caption.trim() ? `<figcaption>${escapeHtml(opts.caption.trim())}</figcaption>` : "";
    onInsert(`<figure class="rt-figure rt-${opts.align}">${img}${caption}</figure><p><br></p>`);
    onClose();
  };
  if (!open) return null;
  if (!asset)
    return (
      <MediaLibraryModal
        open
        onClose={() => {
          if (!picked.current) onClose();
        }}
        onSelect={(ids) => {
          picked.current = true;
          void pick(ids);
        }}
        kind="image"
      />
    );
  return (
    <Modal
      open
      onClose={onClose}
      title="Insérer une image de la médiathèque"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              picked.current = false;
              setAsset(null);
            }}
          >
            Changer d&apos;image
          </Button>
          <Button onClick={insert}>Insérer l&apos;image</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <img src={variants.thumb?.url ?? asset.preview?.url} alt="" className="h-32 w-40 rounded-xl bg-slate-100 object-contain" />
        <div className="grid gap-3">
          <Field label="Taille">
            <Select value={opts.size} onChange={(e) => setOpts({ ...opts, size: e.target.value })} options={IMAGE_SIZES} />
          </Field>
          <Field label="Alignement">
            <Select value={opts.align} onChange={(e) => setOpts({ ...opts, align: e.target.value })} options={IMAGE_ALIGNS} />
          </Field>
        </div>
        <Field label="Texte alternatif" className="sm:col-span-2" help="Décrit l'image pour l'accessibilité et le référencement.">
          <Input value={opts.alt} onChange={(e) => setOpts({ ...opts, alt: e.target.value })} maxLength={300} />
        </Field>
        <Field label="Légende (facultative)" className="sm:col-span-2">
          <Input value={opts.caption} onChange={(e) => setOpts({ ...opts, caption: e.target.value })} maxLength={300} />
        </Field>
      </div>
    </Modal>
  );
}

/** Insertion de code HTML : aperçu exact (après assainissement par l'API) avant insertion à l'emplacement du curseur. */
function InsertHtmlDialog({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (html: string) => void }) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ html: string; warnings: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setCode("");
      setResult(null);
    }
  }, [open]);
  const check = async (): Promise<{ html: string; warnings: string[] } | null> => {
    setBusy(true);
    try {
      const res = await previewHtml(code);
      setResult(res);
      return res;
    } catch (err) {
      toast.error("Code HTML refusé", errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Insérer du code HTML"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => void check()} loading={busy} disabled={!code.trim()}>
            Aperçu
          </Button>
          <Button
            disabled={!code.trim() || busy}
            onClick={async () => {
              const res = result ?? (await check());
              if (!res) return;
              onInsert(res.html);
              onClose();
            }}
          >
            Insérer le code
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Collez ou saisissez du HTML (mise en page en colonnes, tableau, encadré, vidéo YouTube ou Vimeo, carte Google Maps…). Il est affiché tel quel sur le site après contrôle de sécurité : les scripts, formulaires et attributs d&apos;événement sont retirés, les images
          proviennent de la médiathèque.
        </p>
        <Textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setResult(null);
          }}
          rows={10}
          className="font-mono text-xs"
          placeholder={'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">\n  <div><h3>Conception</h3><p>…</p></div>\n  <div><h3>Réalisation</h3><p>…</p></div>\n</div>'}
          spellCheck={false}
        />
        {result?.warnings.length ? (
          <Alert tone="warning">
            <ul className="list-disc space-y-0.5 pl-4">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {result ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted">Aperçu (tel qu&apos;affiché sur le site)</p>
            {/* HTML assaini par l'API (nh3) : aucun script ni attribut d'événement. */}
            <div className="prose-globus max-h-80 overflow-auto rounded-xl border border-line bg-white p-4" dangerouslySetInnerHTML={{ __html: result.html || "<p><em>Rien à insérer.</em></p>" }} />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/** Éditeur de texte riche du CMS : mise en forme, liens, images de la médiathèque, code HTML (inséré ou édité en
 * source). Le HTML est de toute façon assaini côté serveur (nh3) avant enregistrement et affichage. */
export function RichTextEditor({ value, onChange, minHeight = 160, placeholder }: { value: string | null | undefined; onChange: (html: string) => void; minHeight?: number; placeholder?: string }) {
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string>("");
  const range = useRef<Range | null>(null);
  const [mode, setMode] = useState<"visual" | "source">("visual");
  const [source, setSource] = useState("");
  const [dialog, setDialog] = useState<null | "image" | "html">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "visual") return;
    const el = ref.current;
    if (!el) return;
    const html = value ?? "";
    if (html !== last.current) {
      el.innerHTML = html;
      last.current = html;
    }
  }, [value, mode]);

  const emit = () => {
    const html = ref.current?.innerHTML ?? "";
    last.current = html;
    onChange(html === "<br>" ? "" : html);
  };
  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };
  /** Mémorise la position du curseur avant d'ouvrir une fenêtre (la fenêtre prend le focus). */
  const saveRange = () => {
    const sel = window.getSelection();
    range.current = sel && sel.rangeCount && ref.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  };
  const insertHtml = (html: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel) {
      let target = range.current;
      if (!target) {
        target = document.createRange();
        target.selectNodeContents(el);
        target.collapse(false);
      }
      sel.removeAllRanges();
      sel.addRange(target);
    }
    document.execCommand("insertHTML", false, html);
    range.current = null;
    emit();
  };
  const toggleSource = async () => {
    if (mode === "visual") {
      setSource(value ?? "");
      setMode("source");
      return;
    }
    // Retour à l'édition visuelle : HTML assaini par l'API (rien d'actif n'est injecté dans la page d'édition).
    setBusy(true);
    try {
      const res = await previewHtml(source);
      onChange(res.html);
      if (res.warnings.length) toast.warning("Code HTML corrigé", res.warnings.join(" "));
      setMode("visual");
    } catch (err) {
      toast.error("Code HTML refusé", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const visual = mode === "visual";
  const Tool = ({ title, onClick, children, active, disabled }: { title: string; onClick: () => void; children: ReactNode; active?: boolean; disabled?: boolean }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      className={`rounded-lg p-1.5 hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`}
    >
      {children}
    </button>
  );
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white focus-within:ring-2 focus-within:ring-brand-200">
      <div className="flex flex-wrap gap-0.5 border-b border-line bg-slate-50 px-1.5 py-1">
        <Tool title="Gras" onClick={() => exec("bold")} disabled={!visual}>
          <Bold className="h-4 w-4" />
        </Tool>
        <Tool title="Italique" onClick={() => exec("italic")} disabled={!visual}>
          <Italic className="h-4 w-4" />
        </Tool>
        <Tool title="Souligné" onClick={() => exec("underline")} disabled={!visual}>
          <Underline className="h-4 w-4" />
        </Tool>
        <Tool title="Titre 2" onClick={() => exec("formatBlock", "h2")} disabled={!visual}>
          <Heading2 className="h-4 w-4" />
        </Tool>
        <Tool title="Titre 3" onClick={() => exec("formatBlock", "h3")} disabled={!visual}>
          <Heading3 className="h-4 w-4" />
        </Tool>
        <Tool title="Liste à puces" onClick={() => exec("insertUnorderedList")} disabled={!visual}>
          <List className="h-4 w-4" />
        </Tool>
        <Tool title="Liste numérotée" onClick={() => exec("insertOrderedList")} disabled={!visual}>
          <ListOrdered className="h-4 w-4" />
        </Tool>
        <Tool title="Citation" onClick={() => exec("formatBlock", "blockquote")} disabled={!visual}>
          <Quote className="h-4 w-4" />
        </Tool>
        <Tool
          title="Lien"
          disabled={!visual}
          onClick={() => {
            const url = window.prompt("Adresse du lien (https://…, /page, mailto:, tel:)");
            if (url && /^(https:\/\/|\/|mailto:|tel:|#)/.test(url.trim())) exec("createLink", url.trim());
          }}
        >
          <Link2 className="h-4 w-4" />
        </Tool>
        <Tool title="Image de la médiathèque" disabled={!visual} onClick={() => { saveRange(); setDialog("image"); }}>
          <ImagePlus className="h-4 w-4" />
        </Tool>
        <Tool title="Insérer du code HTML" disabled={!visual} onClick={() => { saveRange(); setDialog("html"); }}>
          <Code2 className="h-4 w-4" />
        </Tool>
        <Tool title="Effacer la mise en forme" onClick={() => exec("removeFormat")} disabled={!visual}>
          <RemoveFormatting className="h-4 w-4" />
        </Tool>
        <Tool title="Paragraphe" onClick={() => exec("formatBlock", "p")} disabled={!visual}>
          <span className="px-1 text-xs font-semibold">¶</span>
        </Tool>
        <span className="ml-auto" />
        <Tool title={visual ? "Code source HTML" : "Revenir à l'édition visuelle"} onClick={() => void toggleSource()} active={!visual} disabled={busy}>
          <FileCode2 className="h-4 w-4" />
        </Tool>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          // Collage en texte brut : évite d'importer des styles ou balises non autorisés (code HTML : bouton dédié).
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        data-placeholder={placeholder ?? "Saisissez le contenu…"}
        className={`rich-text-editor prose prose-sm max-w-none px-4 py-3 outline-none empty:before:text-muted empty:before:content-[attr(data-placeholder)] [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-accent-300 [&_blockquote]:pl-3 [&_a]:text-brand-600 [&_a]:underline ${visual ? "" : "hidden"}`}
        style={{ minHeight }}
      />
      {visual ? null : (
        <Textarea
          aria-label="Code source HTML"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            onChange(e.target.value);
          }}
          className="rounded-none border-0 font-mono text-xs focus:ring-0"
          style={{ minHeight }}
          rows={12}
          spellCheck={false}
        />
      )}
      <InsertImageDialog open={dialog === "image"} onClose={() => setDialog(null)} onInsert={insertHtml} />
      <InsertHtmlDialog open={dialog === "html"} onClose={() => setDialog(null)} onInsert={insertHtml} />
    </div>
  );
}
