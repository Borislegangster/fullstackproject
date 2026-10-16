"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { createContext, useContext, useState } from "react";

import { MediaPicker } from "@/components/cms/media-picker";
import { RichTextEditor } from "@/components/cms/rich-text";
import { MultiRefSelect } from "@/components/forms/ref-select";
import { Checkbox, Field, Input, Select, TagInput, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/primitives";
import { useApi } from "@/lib/hooks";
import type { RefSource } from "@/lib/refs";

type Row = Record<string, any>;
type Opt = { value: string; label: string };
type FieldType = "text" | "textarea" | "html" | "number" | "select" | "bool" | "media" | "medias" | "cta" | "ctas" | "strings" | "items" | "ids" | "universe" | "universes" | "form";

export interface Spec {
  key: string;
  label: string;
  type: FieldType;
  options?: Opt[];
  fields?: Spec[];
  help?: string;
  media?: string;
  source?: RefSource;
  numeric?: boolean;
  min?: number;
  max?: number;
  step?: number;
  itemLabel?: string;
  newItem?: () => Row;
}

const o = (pairs: [string, string][]): Opt[] => pairs.map(([value, label]) => ({ value, label }));
const catalog = (path: string, attr = "name"): RefSource => ({ path, label: (r) => r[attr] ?? r.title ?? r.name, sublabel: (r) => r.status, paginated: true, searchable: true });

const CTA_STYLES = o([["primary", "Principal (bleu)"], ["accent", "Accent (orange)"], ["secondary", "Secondaire"], ["ghost", "Discret"], ["whatsapp", "WhatsApp"]]);
const FEATURE_ITEM: Spec[] = [
  { key: "icon", label: "Icône (nom Lucide)", type: "text", help: "Ex. shield-check, hard-hat, ruler" },
  { key: "title", label: "Titre", type: "text" },
  { key: "text", label: "Texte", type: "textarea" },
  { key: "media_id", label: "Image", type: "media", media: "image" },
  { key: "href", label: "Lien", type: "text", help: "/page, #ancre, https://…" },
];
const EYEBROW: Spec = { key: "eyebrow", label: "Sur-titre", type: "text", help: "Court libellé au-dessus du titre" };
const SELECTION_COMMON = (kind: "testimonials" | "projects"): Spec[] => [
  EYEBROW,
  { key: "title", label: "Titre", type: "text" },
  { key: "subtitle", label: "Sous-titre", type: "textarea" },
  { key: "mode", label: "Sélection", type: "select", options: o([["featured", "Mis en avant"], ["universe", "Par univers"], ["ids", "Choix manuel"], ["latest", "Les plus récents"]]) },
  { key: "universe", label: "Univers", type: "universe" },
  { key: "ids", label: "Éléments choisis", type: "ids", source: kind === "testimonials" ? catalog("/cms/testimonials", "author_name") : catalog("/cms/projects", "title") },
  { key: "limit", label: "Nombre maximum", type: "number", min: 1, max: 24 },
  { key: "layout", label: "Présentation", type: "select", options: o([["grid", "Grille"], ["carousel", "Défilement continu"]]) },
];
const CATALOG_SOURCES: Record<string, RefSource> = {
  expertises: catalog("/cms/expertises"),
  services: catalog("/cms/services"),
  team: catalog("/cms/team-members"),
  partners: catalog("/cms/partners"),
  certifications: catalog("/cms/certifications"),
  videos: catalog("/cms/videos", "title"),
  blog: catalog("/cms/blog-posts", "title"),
  faq: catalog("/cms/faq-items", "question"),
};
const CATALOG_SPEC = (kind: string): Spec[] => [
  EYEBROW,
  { key: "title", label: "Titre", type: "text" },
  { key: "subtitle", label: "Sous-titre", type: "textarea" },
  { key: "ids", label: "Éléments choisis (sinon automatique)", type: "ids", source: CATALOG_SOURCES[kind] },
  { key: "category", label: "Catégorie", type: "text" },
  { key: "universe", label: "Univers", type: "universe" },
  { key: "family", label: "Famille (vidéos)", type: "text" },
  { key: "limit", label: "Nombre maximum", type: "number", min: 1, max: 30 },
  { key: "media_id", label: "Illustration (FAQ, certifications…)", type: "media", media: "image" },
];

export const BLOCK_SPECS: Record<string, { label: string; fields: Spec[]; init: () => Row }> = {
  hero: {
    label: "Bandeau d'accueil (hero)",
    init: () => ({ layout: "image", title: "", ctas: [], slides: [], trust_points: [], overlay_opacity: 0.45 }),
    fields: [
      { key: "layout", label: "Mise en page", type: "select", options: o([["image", "Image"], ["video_then_slides", "Vidéo puis diaporama"], ["split", "Texte + visuel"], ["minimal", "Minimal"]]) },
      { key: "eyebrow", label: "Sur-titre", type: "text" },
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "textarea" },
      { key: "media_id", label: "Image de fond", type: "media", media: "image" },
      { key: "video_media_id", label: "Vidéo de fond", type: "media", media: "video" },
      { key: "overlay_opacity", label: "Opacité du voile (0 à 1)", type: "number", min: 0, max: 1, step: 0.05 },
      { key: "ctas", label: "Boutons d'action", type: "ctas" },
      { key: "trust_points", label: "Points de réassurance", type: "strings" },
      {
        key: "slides",
        label: "Diapositives",
        type: "items",
        itemLabel: "Diapositive",
        newItem: () => ({ title: "", media_id: null }),
        fields: [
          { key: "title", label: "Titre", type: "text" },
          { key: "subtitle", label: "Sous-titre", type: "textarea" },
          { key: "media_id", label: "Image", type: "media", media: "image" },
          { key: "cta", label: "Bouton", type: "cta" },
        ],
      },
    ],
  },
  rich_text: {
    label: "Texte riche",
    init: () => ({ html: "", media_position: "right" }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "html", label: "Contenu", type: "html" },
      { key: "media_id", label: "Illustration", type: "media", media: "image" },
      { key: "media_position", label: "Position de l'illustration", type: "select", options: o([["right", "À droite"], ["left", "À gauche"]]) },
    ],
  },
  features: {
    label: "Atouts / caractéristiques",
    init: () => ({ columns: 3, style: "cards", items: [{ title: "" }] }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "textarea" },
      { key: "columns", label: "Colonnes", type: "select", numeric: true, options: o([["2", "2"], ["3", "3"], ["4", "4"]]) },
      { key: "style", label: "Style", type: "select", options: o([["cards", "Cartes illustrées"], ["bento", "Mosaïque (bento)"], ["minimal", "Icônes épurées"]]) },
      { key: "items", label: "Éléments", type: "items", itemLabel: "Élément", newItem: () => ({ title: "" }), fields: FEATURE_ITEM },
    ],
  },
  stats: {
    label: "Chiffres clés",
    init: () => ({ source: "key_figures", items: [] }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "media_id", label: "Photo de fond", type: "media", media: "image" },
      { key: "source", label: "Source", type: "select", options: o([["key_figures", "Chiffres clés publiés (CMS)"], ["inline", "Saisis ici"]]) },
      {
        key: "items",
        label: "Chiffres (si saisis ici)",
        type: "items",
        itemLabel: "Chiffre",
        newItem: () => ({ value: 0, label: "" }),
        fields: [
          { key: "value", label: "Valeur", type: "number" },
          { key: "prefix", label: "Préfixe", type: "text" },
          { key: "suffix", label: "Suffixe", type: "text" },
          { key: "label", label: "Libellé", type: "text" },
        ],
      },
    ],
  },
  steps: {
    label: "Étapes / parcours",
    init: () => ({ style: "timeline", items: [{ title: "" }] }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "media_id", label: "Illustration (frise)", type: "media", media: "image" },
      { key: "subtitle", label: "Sous-titre", type: "textarea" },
      { key: "style", label: "Style", type: "select", options: o([["timeline", "Frise"], ["cards", "Cartes"], ["funnel", "Entonnoir"]]) },
      {
        key: "items",
        label: "Étapes",
        type: "items",
        itemLabel: "Étape",
        newItem: () => ({ title: "" }),
        fields: [
          { key: "title", label: "Titre", type: "text" },
          { key: "text", label: "Texte", type: "textarea" },
          { key: "icon", label: "Icône", type: "text" },
          { key: "media_id", label: "Image", type: "media", media: "image" },
        ],
      },
    ],
  },
  cta: {
    label: "Appel à l'action",
    init: () => ({ title: "", ctas: [{ label: "", href: "", style: "primary" }], theme: "primary" }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "text", label: "Texte", type: "textarea" },
      { key: "ctas", label: "Boutons", type: "ctas" },
      { key: "media_id", label: "Image", type: "media", media: "image" },
      { key: "theme", label: "Thème", type: "select", options: o([["primary", "Bleu"], ["accent", "Orange"], ["dark", "Sombre"], ["light", "Clair"]]) },
    ],
  },
  media: {
    label: "Image",
    init: () => ({ media_id: null, layout: "contained" }),
    fields: [
      { key: "media_id", label: "Média", type: "media" },
      { key: "caption", label: "Légende", type: "text" },
      { key: "layout", label: "Largeur", type: "select", options: o([["contained", "Contenue"], ["full", "Pleine largeur"]]) },
    ],
  },
  gallery: {
    label: "Galerie",
    init: () => ({ media_ids: [], layout: "grid" }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "textarea" },
      { key: "media_ids", label: "Images", type: "medias", media: "image" },
      { key: "layout", label: "Disposition", type: "select", options: o([["grid", "Grille"], ["masonry", "Mosaïque"], ["carousel", "Carrousel"]]) },
    ],
  },
  video: {
    label: "Vidéo",
    init: () => ({ media_id: null, autoplay: false }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "textarea" },
      { key: "media_id", label: "Vidéo (fichier ou YouTube / Vimeo)", type: "media" },
      { key: "caption", label: "Légende", type: "text" },
      { key: "autoplay", label: "Lecture automatique (muette)", type: "bool" },
    ],
  },
  testimonials: { label: "Témoignages", init: () => ({ mode: "featured", ids: [], limit: 6 }), fields: SELECTION_COMMON("testimonials") },
  projects: { label: "Réalisations", init: () => ({ mode: "featured", ids: [], limit: 6 }), fields: SELECTION_COMMON("projects") },
  universes: {
    label: "Univers",
    init: () => ({ keys: [] }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "textarea" },
      { key: "keys", label: "Univers affichés (vide = tous)", type: "universes" },
    ],
  },
  offers: {
    label: "Offres",
    init: () => ({ ids: [] }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "textarea" },
      { key: "universe", label: "Univers", type: "universe" },
      { key: "ids", label: "Offres choisies", type: "ids", source: catalog("/cms/offers") },
    ],
  },
  expertises: { label: "Expertises", init: () => ({ ids: [], limit: 6 }), fields: CATALOG_SPEC("expertises") },
  services: { label: "Services", init: () => ({ ids: [], limit: 6 }), fields: CATALOG_SPEC("services") },
  team: { label: "Équipe", init: () => ({ ids: [], limit: 12 }), fields: CATALOG_SPEC("team") },
  partners: { label: "Partenaires", init: () => ({ ids: [], limit: 12 }), fields: CATALOG_SPEC("partners") },
  certifications: { label: "Certifications", init: () => ({ ids: [], limit: 6 }), fields: CATALOG_SPEC("certifications") },
  videos: { label: "Vidéothèque", init: () => ({ ids: [], limit: 6 }), fields: CATALOG_SPEC("videos") },
  blog: { label: "Articles de blog", init: () => ({ ids: [], limit: 3 }), fields: CATALOG_SPEC("blog") },
  faq: { label: "FAQ", init: () => ({ ids: [], limit: 8 }), fields: CATALOG_SPEC("faq") },
  comparison: {
    label: "Tableau comparatif",
    init: () => ({ columns: ["", ""], rows: [{ label: "", values: ["", ""] }] }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "textarea" },
      { key: "columns", label: "Colonnes (2 à 5)", type: "strings" },
      { key: "highlight_column", label: "Colonne mise en avant", type: "number", min: 0, max: 4, help: "0 = première colonne ; vide = aucune" },
      { key: "rows", label: "Lignes", type: "items", itemLabel: "Ligne", newItem: () => ({ label: "", values: [] }), fields: [{ key: "label", label: "Critère", type: "text" }, { key: "values", label: "Valeurs (une par colonne)", type: "strings" }] },
    ],
  },
  trust: {
    label: "Preuves de confiance",
    init: () => ({ items: [{ title: "" }] }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "textarea" },
      { key: "media_id", label: "Illustration", type: "media", media: "image" },
      { key: "items", label: "Preuves", type: "items", itemLabel: "Preuve", newItem: () => ({ title: "" }), fields: FEATURE_ITEM },
    ],
  },
  map: {
    label: "Carte",
    init: () => ({ zoom: 14 }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "latitude", label: "Latitude", type: "number", step: 0.000001 },
      { key: "longitude", label: "Longitude", type: "number", step: 0.000001 },
      { key: "zoom", label: "Zoom (1-20)", type: "number", min: 1, max: 20 },
      { key: "address", label: "Adresse", type: "text" },
    ],
  },
  form: {
    label: "Formulaire",
    init: () => ({ form_key: "" }),
    fields: [
      { key: "form_key", label: "Formulaire", type: "form" },
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "text", label: "Texte", type: "textarea" },
      { key: "media_id", label: "Visuel d'accompagnement", type: "media", media: "image" },
    ],
  },
  model3d: {
    label: "Maquette 3D",
    init: () => ({ media_id: null }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "media_id", label: "Fichier GLB / glTF", type: "media", media: "document" },
      { key: "caption", label: "Légende", type: "text" },
    ],
  },
  quote: {
    label: "Citation",
    init: () => ({ text: "" }),
    fields: [
      { key: "text", label: "Citation", type: "textarea" },
      { key: "author", label: "Auteur", type: "text" },
      { key: "role", label: "Fonction", type: "text" },
      { key: "media_id", label: "Portrait", type: "media", media: "image" },
      { key: "background_media_id", label: "Photo de fond", type: "media", media: "image" },
    ],
  },
  before_after: {
    label: "Avant / après",
    init: () => ({ items: [{ before_media_id: null, after_media_id: null }] }),
    fields: [
      EYEBROW,
      { key: "title", label: "Titre", type: "text" },
      { key: "subtitle", label: "Sous-titre", type: "textarea" },
      {
        key: "items",
        label: "Comparaisons",
        type: "items",
        itemLabel: "Comparaison",
        newItem: () => ({ before_media_id: null, after_media_id: null }),
        fields: [
          { key: "before_media_id", label: "Avant", type: "media", media: "image" },
          { key: "after_media_id", label: "Après", type: "media", media: "image" },
          { key: "caption", label: "Légende", type: "text" },
        ],
      },
    ],
  },
  contact_info: {
    label: "Coordonnées (depuis les réglages du site)",
    init: () => ({}),
    fields: [EYEBROW, { key: "title", label: "Titre", type: "text" }, { key: "subtitle", label: "Sous-titre", type: "textarea" }, { key: "media_id", label: "Photo (bureaux, équipe…)", type: "media", media: "image" }],
  },
};

export function newBlock(kind: string): Row {
  return { kind, ...(BLOCK_SPECS[kind]?.init() ?? {}) };
}

/* ----------------------------------------------------------------------------- champs */

const Lookups = createContext<{ universes: Opt[]; forms: Opt[] }>({ universes: [], forms: [] });

export function CmsLookupsProvider({ children }: { children: React.ReactNode }) {
  const universes = useApi<{ items: Row[] }>("/cms/universes", { page_size: 50 });
  const forms = useApi<{ items: Row[] }>("/cms/forms", { page_size: 100 });
  return (
    <Lookups.Provider
      value={{
        universes: (universes.data?.items ?? []).map((u) => ({ value: u.key, label: u.name })),
        forms: (forms.data?.items ?? []).map((f) => ({ value: f.key, label: f.title })),
      }}
    >
      {children}
    </Lookups.Provider>
  );
}

function CtaEditor({ value, onChange }: { value: Row | null | undefined; onChange: (v: Row | null) => void }) {
  if (!value)
    return (
      <Button size="sm" variant="ghost" onClick={() => onChange({ label: "", href: "", style: "primary" })}>
        <Plus className="h-4 w-4" /> Ajouter un bouton
      </Button>
    );
  return (
    <div className="grid gap-2 rounded-xl bg-surface p-2 sm:grid-cols-[1fr_1fr_10rem_auto]">
      <Input value={value.label ?? ""} onChange={(e) => onChange({ ...value, label: e.target.value })} placeholder="Libellé (ex. Décrire mon projet)" />
      <Input value={value.href ?? ""} onChange={(e) => onChange({ ...value, href: e.target.value })} placeholder="/decrire-mon-projet" />
      <Select value={value.style ?? "primary"} onChange={(e) => onChange({ ...value, style: e.target.value })} options={CTA_STYLES} aria-label="Style" />
      <button type="button" aria-label="Retirer le bouton" className="rounded p-1.5 text-muted hover:text-red-600" onClick={() => onChange(null)}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function SpecField({ spec, value, onChange }: { spec: Spec; value: any; onChange: (v: any) => void }) {
  const lookups = useContext(Lookups);
  switch (spec.type) {
    case "text":
      return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />;
    case "html":
      return <RichTextEditor value={value ?? ""} onChange={onChange} />;
    case "number":
      return <Input type="number" value={value ?? ""} min={spec.min} max={spec.max} step={spec.step ?? "any"} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
    case "select":
      return <Select value={value === null || value === undefined ? "" : String(value)} onChange={(e) => onChange(spec.numeric ? Number(e.target.value) : e.target.value)} options={spec.options ?? []} />;
    case "bool":
      return <Checkbox label={spec.label} checked={!!value} onChange={onChange} />;
    case "media":
      return <MediaPicker value={value} onChange={onChange} kind={spec.media} />;
    case "medias":
      return <MediaPicker value={value ?? []} onChange={onChange} multiple kind={spec.media} label="Ajouter" />;
    case "cta":
      return <CtaEditor value={value} onChange={onChange} />;
    case "ctas": {
      const list: Row[] = value ?? [];
      return (
        <div className="space-y-2">
          {list.map((cta, i) => (
            <CtaEditor key={i} value={cta} onChange={(v) => onChange(v ? list.map((x, j) => (j === i ? v : x)) : list.filter((_, j) => j !== i))} />
          ))}
          {list.length < 3 ? (
            <Button size="sm" variant="ghost" onClick={() => onChange([...list, { label: "", href: "", style: list.length ? "secondary" : "primary" }])}>
              <Plus className="h-4 w-4" /> Bouton
            </Button>
          ) : null}
        </div>
      );
    }
    case "strings":
      return <TagInput value={(value ?? []).map(String)} onChange={onChange} />;
    case "ids":
      return spec.source ? <MultiRefSelect source={spec.source} value={(value ?? []).map(String)} onChange={onChange} /> : null;
    case "universe":
      return <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} options={[{ value: "", label: "—" }, ...lookups.universes]} />;
    case "universes":
      return (
        <div className="flex flex-wrap gap-3">
          {lookups.universes.map((u) => (
            <Checkbox key={u.value} label={u.label} checked={(value ?? []).includes(u.value)} onChange={(c) => onChange(c ? [...(value ?? []), u.value] : (value ?? []).filter((x: string) => x !== u.value))} />
          ))}
        </div>
      );
    case "form":
      return <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)} options={[{ value: "", label: "Choisir…" }, ...lookups.forms]} />;
    case "items": {
      const list: Row[] = value ?? [];
      return (
        <div className="space-y-2">
          {list.map((item, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
                <span>
                  {spec.itemLabel ?? "Élément"} {i + 1}
                </span>
                <span className="flex gap-1">
                  <button type="button" aria-label="Monter" disabled={i === 0} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => onChange(move(list, i, -1))}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Descendre" disabled={i === list.length - 1} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => onChange(move(list, i, 1))}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Retirer" className="rounded p-1 hover:text-red-600" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
              <SpecFields specs={spec.fields ?? []} value={item} onChange={(v) => onChange(list.map((x, j) => (j === i ? v : x)))} />
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => onChange([...list, spec.newItem?.() ?? {}])}>
            <Plus className="h-4 w-4" /> {spec.itemLabel ?? "Élément"}
          </Button>
        </div>
      );
    }
    default:
      return null;
  }
}

function move<T>(list: T[], i: number, delta: number): T[] {
  const next = list.slice();
  const [item] = next.splice(i, 1);
  next.splice(i + delta, 0, item);
  return next;
}

export function SpecFields({ specs, value, onChange }: { specs: Spec[]; value: Row; onChange: (v: Row) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {specs.map((spec) => {
        const wide = ["textarea", "html", "medias", "ctas", "items", "ids", "universes", "strings"].includes(spec.type);
        const set = (v: any) => onChange({ ...value, [spec.key]: v });
        if (spec.type === "bool")
          return (
            <div key={spec.key} className={wide ? "sm:col-span-2" : ""}>
              <SpecField spec={spec} value={value[spec.key]} onChange={set} />
            </div>
          );
        return (
          <Field key={spec.key} label={spec.label} help={spec.help} className={wide ? "sm:col-span-2" : ""}>
            <SpecField spec={spec} value={value[spec.key]} onChange={set} />
          </Field>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------- liste de blocs */

export interface EditableBlock {
  id?: string | null;
  visible: boolean;
  data: Row;
}

function BlockCard({ block, index, count, onChange, onRemove, onMove, onDuplicate, withVisibility }: { block: EditableBlock; index: number; count: number; onChange: (b: EditableBlock) => void; onRemove: () => void; onMove: (delta: number) => void; onDuplicate: () => void; withVisibility: boolean }) {
  const [open, setOpen] = useState(index === 0);
  const spec = BLOCK_SPECS[block.data.kind];
  const title = block.data.title || block.data.eyebrow || spec?.label || block.data.kind;
  return (
    <div className={`rounded-2xl border ${block.visible ? "border-line bg-white" : "border-dashed border-line bg-slate-50 opacity-70"}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2 text-left text-sm font-medium" aria-expanded={open}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-brand-700">{spec?.label ?? block.data.kind}</span>
          <span className="truncate">{typeof title === "string" ? title : ""}</span>
        </button>
        {withVisibility ? (
          <button type="button" title={block.visible ? "Masquer" : "Afficher"} aria-label={block.visible ? "Masquer le bloc" : "Afficher le bloc"} className="rounded p-1.5 text-muted hover:bg-slate-100" onClick={() => onChange({ ...block, visible: !block.visible })}>
            {block.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        ) : null}
        <button type="button" aria-label="Monter le bloc" disabled={index === 0} className="rounded p-1.5 text-muted hover:bg-slate-100 disabled:opacity-30" onClick={() => onMove(-1)}>
          <ArrowUp className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Descendre le bloc" disabled={index === count - 1} className="rounded p-1.5 text-muted hover:bg-slate-100 disabled:opacity-30" onClick={() => onMove(1)}>
          <ArrowDown className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Dupliquer le bloc" className="rounded p-1.5 text-muted hover:bg-slate-100" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Supprimer le bloc" className="rounded p-1.5 text-muted hover:text-red-600" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && spec ? (
        <div className="border-t border-line p-4">
          <SpecFields specs={spec.fields} value={block.data} onChange={(data) => onChange({ ...block, data: { ...data, kind: block.data.kind } })} />
        </div>
      ) : null}
    </div>
  );
}

export function BlockAdder({ onAdd }: { onAdd: (kind: string) => void }) {
  const [kind, setKind] = useState("rich_text");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={kind} onChange={(e) => setKind(e.target.value)} options={Object.entries(BLOCK_SPECS).map(([value, s]) => ({ value, label: s.label }))} aria-label="Type de bloc" />
      <Button size="sm" variant="secondary" onClick={() => onAdd(kind)}>
        <Plus className="h-4 w-4" /> Ajouter le bloc
      </Button>
    </div>
  );
}

/** Liste de blocs typés (sections de page : avec visibilité ; contenus de collection : données seules). */
export function BlocksEditor({ value, onChange, max = 30, withVisibility = true }: { value: EditableBlock[]; onChange: (v: EditableBlock[]) => void; max?: number; withVisibility?: boolean }) {
  return (
    <div className="space-y-2">
      {value.map((b, i) => (
        <BlockCard
          key={b.id ?? `new-${i}`}
          block={b}
          index={i}
          count={value.length}
          onChange={(nb) => onChange(value.map((x, j) => (j === i ? nb : x)))}
          onRemove={() => onChange(value.filter((_, j) => j !== i))}
          onMove={(d) => onChange(move(value, i, d))}
          onDuplicate={() => onChange([...value.slice(0, i + 1), { visible: b.visible, data: JSON.parse(JSON.stringify(b.data)) }, ...value.slice(i + 1)])}
          withVisibility={withVisibility}
        />
      ))}
      {value.length < max ? <BlockAdder onAdd={(kind) => onChange([...value, { visible: true, data: newBlock(kind) }])} /> : null}
    </div>
  );
}

/** Variante pour les champs `body_blocks` des collections (liste de blocs sans enveloppe). */
export function BodyBlocksField({ value, onChange }: { value: Row[] | null | undefined; onChange: (v: Row[]) => void }) {
  const blocks: EditableBlock[] = (Array.isArray(value) ? value : []).map((data) => ({ visible: true, data }));
  return <BlocksEditor value={blocks} withVisibility={false} onChange={(list) => onChange(list.map((b) => b.data))} />;
}
