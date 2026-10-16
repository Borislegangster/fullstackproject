"use client";

import { MediaPicker } from "@/components/cms/media-picker";
import { Checkbox, Field, Input, Select, TagInput, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";

type Row = Record<string, any>;

export const EMPTY_SEO: Row = {
  title: "",
  description: "",
  slug: "",
  canonical_url: "",
  robots_index: true,
  robots_follow: true,
  og_title: "",
  og_description: "",
  og_image_media_id: null,
  twitter_card: "summary_large_image",
  twitter_image_media_id: null,
  h1: "",
  keywords: [],
  sitemap_priority: 0.5,
  sitemap_changefreq: "weekly",
};

const SEO_KEYS = Object.keys(EMPTY_SEO);

/** Ne conserve que les champs acceptés par l'API (schéma strict) et convertit les chaînes vides en null. */
export function cleanSeo(seo: Row | null | undefined): Row | null {
  if (!seo) return null;
  const out: Row = {};
  for (const key of SEO_KEYS) {
    const v = seo[key];
    out[key] = v === "" ? null : (v ?? EMPTY_SEO[key]);
  }
  out.keywords = (out.keywords ?? []).filter(Boolean);
  out.sitemap_priority = Number(out.sitemap_priority ?? 0.5);
  return out;
}

function Counter({ value, ideal, max }: { value?: string | null; ideal: [number, number]; max: number }) {
  const n = (value ?? "").length;
  const tone = n === 0 ? "neutral" : n > max ? "danger" : n < ideal[0] || n > ideal[1] ? "warning" : "success";
  return (
    <Badge tone={tone}>
      {n} / {ideal[0]}–{ideal[1]}
    </Badge>
  );
}

/** Métadonnées SEO d'une page ou d'un contenu : titre, description, aperçu Google, Open Graph, indexation, sitemap. */
export function SeoEditor({ value, onChange, fallbackTitle, path }: { value: Row | null | undefined; onChange: (v: Row) => void; fallbackTitle?: string; path?: string | null }) {
  const v = { ...EMPTY_SEO, ...(value ?? {}) };
  const set = (patch: Row) => onChange({ ...v, ...patch });
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-4">
        <p className="mb-1 text-xs text-muted">Aperçu dans les résultats de recherche</p>
        <p className="truncate text-lg text-[#1a0dab]">{v.title || fallbackTitle || "Titre de la page"}</p>
        <p className="truncate text-xs text-[#006621]">{path ?? "/"}</p>
        <p className="line-clamp-2 text-sm text-slate-600">{v.description || "Ajoutez une description (150 à 160 caractères) qui donne envie de cliquer."}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre SEO" help={<Counter value={v.title} ideal={[30, 60]} max={160} />} className="sm:col-span-2">
          <Input value={v.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Méta-description" help={<Counter value={v.description} ideal={[120, 160]} max={320} />} className="sm:col-span-2">
          <Textarea value={v.description ?? ""} onChange={(e) => set({ description: e.target.value })} rows={2} />
        </Field>
        <Field label="Titre H1 (si différent)">
          <Input value={v.h1 ?? ""} onChange={(e) => set({ h1: e.target.value })} />
        </Field>
        <Field label="URL canonique" help="https://… ou /chemin">
          <Input value={v.canonical_url ?? ""} onChange={(e) => set({ canonical_url: e.target.value })} />
        </Field>
        <Field label="Mots-clés" className="sm:col-span-2">
          <TagInput value={v.keywords ?? []} onChange={(k) => set({ keywords: k })} />
        </Field>
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <Checkbox label="Indexer (index)" checked={!!v.robots_index} onChange={(c) => set({ robots_index: c })} />
          <Checkbox label="Suivre les liens (follow)" checked={!!v.robots_follow} onChange={(c) => set({ robots_follow: c })} />
        </div>
        <Field label="Priorité sitemap (0 à 1)">
          <Input type="number" min={0} max={1} step={0.1} value={v.sitemap_priority ?? 0.5} onChange={(e) => set({ sitemap_priority: Number(e.target.value) })} />
        </Field>
        <Field label="Fréquence de mise à jour">
          <Select value={v.sitemap_changefreq} onChange={(e) => set({ sitemap_changefreq: e.target.value })} options={["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"].map((x) => ({ value: x, label: { always: "Permanente", hourly: "Horaire", daily: "Quotidienne", weekly: "Hebdomadaire", monthly: "Mensuelle", yearly: "Annuelle", never: "Jamais" }[x] ?? x }))} />
        </Field>
        <Field label="Titre de partage (Open Graph)">
          <Input value={v.og_title ?? ""} onChange={(e) => set({ og_title: e.target.value })} />
        </Field>
        <Field label="Format de carte (X / Twitter)">
          <Select value={v.twitter_card} onChange={(e) => set({ twitter_card: e.target.value })} options={[{ value: "summary_large_image", label: "Grande image" }, { value: "summary", label: "Résumé" }]} />
        </Field>
        <Field label="Description de partage" className="sm:col-span-2">
          <Textarea value={v.og_description ?? ""} onChange={(e) => set({ og_description: e.target.value })} rows={2} />
        </Field>
        <Field label="Image de partage (1200 × 630)">
          <MediaPicker value={v.og_image_media_id} onChange={(id) => set({ og_image_media_id: id })} kind="image" />
        </Field>
        <Field label="Image X / Twitter">
          <MediaPicker value={v.twitter_image_media_id} onChange={(id) => set({ twitter_image_media_id: id })} kind="image" />
        </Field>
      </div>
    </div>
  );
}
