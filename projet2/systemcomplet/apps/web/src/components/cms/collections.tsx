"use client";

import { useState } from "react";

import { BodyBlocksField, CmsLookupsProvider, SpecFields } from "@/components/cms/blocks-editor";
import { CollectionPreview, type CollectionPreviewPayload } from "@/components/cms/collection-preview";
import { MediaPicker, MediaThumb } from "@/components/cms/media-picker";
import { CMS_TRANSITIONS, RevisionsPanel } from "@/components/cms/page-editor";
import { RichTextEditor } from "@/components/cms/rich-text";
import { ResourceView, type Row, type RowAction } from "@/components/erp/resource";
import type { FieldConfig } from "@/components/forms/schema-form";
import { MultiRefSelect } from "@/components/forms/ref-select";
import { Select, TagInput } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, StatusBadge } from "@/components/ui/primitives";
import type { Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { REFS } from "@/lib/refs";

type Render = NonNullable<FieldConfig["render"]>;
const opts = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

/* ----------------------------------------------------------------------------- champs réutilisables */

const media = (kind?: string): FieldConfig => ({ span: 2, render: ({ value, onChange }) => <MediaPicker value={value} onChange={onChange} kind={kind} /> });
const medias = (kind?: string): FieldConfig => ({ span: 2, render: ({ value, onChange }) => <MediaPicker value={value ?? []} onChange={onChange} multiple kind={kind} label="Ajouter" /> });
const html: FieldConfig = { span: 2, render: ({ value, onChange }) => <RichTextEditor value={value} onChange={onChange} /> };
const blocks: FieldConfig = { span: 2, label: "Contenu (blocs)", render: ({ value, onChange }) => <BodyBlocksField value={value} onChange={onChange} /> };
const tags: FieldConfig = { widget: "tags" };

function UniverseField({ value, onChange, byId }: { value: any; onChange: (v: any) => void; byId?: boolean }) {
  const universes = useApi<{ items: Row[] }>("/cms/universes", { page_size: 50 });
  return <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} options={[{ value: "", label: "—" }, ...(universes.data?.items ?? []).map((u) => ({ value: byId ? u.id : u.key, label: u.name }))]} />;
}
const universe: FieldConfig = { render: ({ value, onChange }) => <UniverseField value={value} onChange={onChange} /> };
const universeId: FieldConfig = { label: "Univers", render: ({ value, onChange }) => <UniverseField value={value} onChange={onChange} byId /> };
const multiRef = (source: (typeof REFS)[keyof typeof REFS]): FieldConfig => ({ span: 2, render: ({ value, onChange }) => <MultiRefSelect source={source} value={(value ?? []).map(String)} onChange={onChange} /> });
const beforeAfter: FieldConfig = {
  span: 2,
  label: "Avant / après",
  render: (({ value, onChange }) => (
    <SpecFields
      specs={[
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
      ]}
      value={{ items: value ?? [] }}
      onChange={(v) => onChange(v.items)}
    />
  )) as Render,
};

/** Liste d'éléments structurés éditée en lignes (sans JSON) ; les anciennes valeurs texte sont reprises. */
const itemsField = (label: string, itemLabel: string, fields: { key: string; label: string; type: "text" | "textarea" }[], help?: string): FieldConfig => ({
  span: 2,
  label,
  help,
  render: (({ value, onChange }) => (
    <SpecFields
      specs={[{ key: "items", label: "", type: "items", itemLabel, newItem: () => Object.fromEntries(fields.map((f) => [f.key, ""])), fields }]}
      value={{ items: (Array.isArray(value) ? value : []).map((v: unknown) => (typeof v === "string" ? { [fields[0].key]: v } : v)) }}
      onChange={(v) => onChange(v.items)}
    />
  )) as Render,
});
const stringsField = (label: string, help: string): FieldConfig => ({
  span: 2,
  label,
  help,
  render: ({ value, onChange }) => <TagInput value={(Array.isArray(value) ? value : []).map(String)} onChange={onChange} />,
});

/* ----------------------------------------------------------------------------- définitions */

interface CollectionDef {
  key: string;
  label: string;
  path: string;
  title: string;
  columns?: Column<Row>[];
  fields: Record<string, FieldConfig>;
  workflow?: boolean;
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
}

const STATUS_FILTER = { key: "status", label: "Statut", options: opts([["draft", "Brouillon"], ["in_review", "En relecture"], ["validated", "Validé"], ["published", "Publié"], ["archived", "Archivé"]]) };
const VIDEO_FAMILIES = opts([["PROJECTION", "Projection (se projeter)"], ["EXPERTISE", "Expertise"], ["PREUVE", "Preuve (réalisations)"], ["REASSURANCE", "Réassurance"], ["TRANSPARENCE", "Transparence (chantier)"]]);

export const CMS_COLLECTIONS: CollectionDef[] = [
  { key: "universes", label: "Univers", path: "/cms/universes", title: "name", fields: { hero_media_id: media("image"), body_blocks: blocks, funnel: stringsField("Parcours client (étapes affichées dans l'ordre)", "Tapez une étape puis Entrée, ex. « Analyse du terrain », « Conception », « Construction »…") } },
  { key: "offers", label: "Offres", path: "/cms/offers", title: "name", fields: { universe_id: universeId, media_id: media("image"), deliverables: tags, body_blocks: blocks, steps: itemsField("Étapes de l'offre", "Étape", [{ key: "title", label: "Titre de l'étape", type: "text" }, { key: "text", label: "Description", type: "textarea" }]) } },
  { key: "expertises", label: "Expertises", path: "/cms/expertises", title: "name", fields: { media_id: media("image"), body_blocks: blocks } },
  {
    key: "services",
    label: "Services",
    path: "/cms/services",
    title: "name",
    fields: { media_id: media("image"), deliverables: tags, related_offer_ids: { ...multiRef(REFS.offers), label: "Offres liées" }, faq_item_ids: { ...multiRef(REFS.faqItems), label: "Questions fréquentes liées" }, body_blocks: blocks, category: { options: opts([["architecture", "Architecture"], ["etudes", "Études"], ["ingenierie", "Ingénierie"], ["construction", "Construction"], ["renovation", "Rénovation"], ["management", "Management de projet"]]) } },
  },
  {
    key: "projects",
    label: "Réalisations",
    path: "/cms/projects",
    title: "title",
    fields: {
      universe,
      cover_media_id: media("image"),
      gallery_media_ids: medias("image"),
      video_media_ids: medias(),
      model_media_id: media("document"),
      before_after: beforeAfter,
      testimonial_id: { ref: "testimonials" },
      erp_project_id: { ref: "projects", label: "Projet ERP (avancement réel)" },
      delivery_status: { options: opts([["delivered", "Livré"], ["in_progress", "En cours"]]) },
      results: itemsField("Résultats chiffrés", "Résultat", [{ key: "label", label: "Indicateur", type: "text" }, { key: "value", label: "Valeur", type: "text" }], "Ex. « Délai tenu » : « 100 % »."),
      body_blocks: blocks,
    },
    filters: [STATUS_FILTER, { key: "delivery_status", label: "Avancement", options: opts([["delivered", "Livré"], ["in_progress", "En cours"]]) }],
  },
  {
    key: "blog_posts",
    label: "Articles",
    path: "/cms/blog-posts",
    title: "title",
    fields: { cover_media_id: media("image"), category_id: { ref: "blogCategories" }, author_id: { ref: "blogAuthors" }, tags, universe, content_family: { options: VIDEO_FAMILIES }, body_blocks: blocks },
  },
  { key: "help_articles", label: "Centre d'aide", path: "/cms/help-articles", title: "title", fields: { category_id: { ref: "helpCategories" }, keywords: tags, audience: { options: opts([["public", "Public"], ["client", "Clients"], ["partner", "Partenaires"]]) }, body_blocks: blocks } },
  { key: "faq_items", label: "FAQ", path: "/cms/faq-items", title: "question", fields: { category_id: { ref: "faqCategories" }, answer: html, universe } },
  { key: "testimonials", label: "Témoignages", path: "/cms/testimonials", title: "author_name", fields: { photo_media_id: media("image"), video_media_id: media(), portfolio_project_id: { ref: "portfolioProjects" }, universe, consent_reference: { help: "Référence de l'accord écrit du client (obligatoire avant publication)." }, rating: { help: "1 à 5" } } },
  { key: "team_members", label: "Équipe", path: "/cms/team-members", title: "name", fields: { photo_media_id: media("image") } },
  { key: "partners", label: "Partenaires", path: "/cms/partners", title: "name", fields: { logo_media_id: media("image") } },
  { key: "certifications", label: "Certifications", path: "/cms/certifications", title: "name", fields: { logo_media_id: media("image"), document_media_id: media("document") } },
  { key: "key_figures", label: "Chiffres clés", path: "/cms/key-figures", title: "label", fields: { source_note: { help: "Source vérifiable du chiffre (exigence de preuve)." } } },
  { key: "videos", label: "Vidéothèque", path: "/cms/videos", title: "title", fields: { media_id: media(), family: { options: VIDEO_FAMILIES }, universe } },
  {
    key: "banners",
    label: "Bannières / popups",
    path: "/cms/banners",
    title: "title",
    fields: { media_id: media("image"), kind: { options: opts([["banner", "Bannière"], ["popup", "Fenêtre (popup)"]]) }, position: { options: opts([["top", "Haut"], ["bottom", "Bas"], ["center", "Centre"]]) }, frequency: { options: opts([["once", "Une fois"], ["session", "Une fois par visite"], ["always", "À chaque page"]]) }, route_keys: { widget: "tags", help: "Clés de pages ciblées (vide = toutes)." } },
  },
];

export const CMS_TAXONOMIES = [
  { key: "blog_categories", label: "Catégories du blog", path: "/cms/blog-categories" },
  { key: "blog_authors", label: "Auteurs du blog", path: "/cms/blog-authors" },
  { key: "faq_categories", label: "Catégories FAQ", path: "/cms/faq-categories" },
  { key: "help_categories", label: "Catégories d'aide", path: "/cms/help-categories" },
];

const IMAGE_COLUMN: Record<string, string> = { universes: "hero_media_id", offers: "media_id", expertises: "media_id", services: "media_id", projects: "cover_media_id", blog_posts: "cover_media_id", testimonials: "photo_media_id", team_members: "photo_media_id", partners: "logo_media_id", certifications: "logo_media_id" };

function Thumb({ id }: { id?: string | null }) {
  const asset = useApi<Row>(id ? `/cms/media/${id}` : null);
  return <MediaThumb asset={asset.data} className="h-10 w-14" />;
}

/* ----------------------------------------------------------------------------- vue générique */

export function CollectionView({ def }: { def: CollectionDef }) {
  const toast = useToast();
  const [preview, setPreview] = useState<CollectionPreviewPayload | null>(null);
  const [history, setHistory] = useState<Row | null>(null);
  const [version, setVersion] = useState(0);
  const imageKey = IMAGE_COLUMN[def.key];
  const transitions: RowAction[] = Object.entries(CMS_TRANSITIONS).flatMap(([from, list]) =>
    list.map((t) => ({
      key: `${from}-${t.target}`,
      label: t.label,
      path: (row: Row) => `/cms/collections/${def.key}/${row.id}/transition`,
      when: (row: Row) => row.status === from,
      perms: [t.perm],
      body: (_row: Row, reason: string) => ({ target: t.target, note: reason || null }),
      reasonLabel: t.target === "draft" || t.target === "archived" ? "Motif (historique)" : undefined,
      confirm: `${t.label} ?`,
      success: t.label,
      tone: t.target === "published" ? ("accent" as const) : t.target === "archived" ? ("danger" as const) : undefined,
    })),
  );
  return (
    <>
      <ResourceView
        key={`${def.key}-${version}`}
        embedded
        config={{
          title: def.label,
          path: def.path,
          columns: [
            ...(imageKey ? [{ key: imageKey, label: "", render: (r: Row) => <Thumb id={r[imageKey]} /> }] : []),
            { key: def.title, label: "Titre", sortable: true, render: (r: Row) => <span className="font-medium">{r[def.title]}</span> },
            ...(def.columns ?? []),
            { key: "featured", label: "Mis en avant", render: (r: Row) => (r.featured ? <Badge tone="accent">À la une</Badge> : "") , hideOnMobile: true },
            { key: "updated_at", label: "Mise à jour", format: "datetime" as const, sortable: true, hideOnMobile: true },
            { key: "status", label: "Statut", render: (r: Row) => <StatusBadge status={r.status} /> },
          ],
          filters: def.filters ?? [STATUS_FILTER],
          create: { endpoint: `POST ${def.path}`, label: `Nouveau — ${def.label}`, perms: ["cms:write"], fields: def.fields },
          update: { endpoint: `PATCH ${def.path}/{item_id}`, perms: ["cms:write"], fields: def.fields },
          remove: { path: (r) => `${def.path}/${r.id}`, perms: ["cms:publish"], confirm: "Supprimer définitivement cet élément ? (préférez l'archivage pour un contenu publié)" },
          actions: [
            ...transitions,
            {
              key: "preview",
              label: "Aperçu",
              run: async (row) => {
                try {
                  setPreview(await api<CollectionPreviewPayload>(`/cms/collections/${def.key}/${row.id}/preview`));
                } catch (err) {
                  toast.error("Aperçu impossible", errorMessage(err));
                }
              },
            },
            { key: "history", label: "Historique", run: (row) => setHistory(row) },
          ],
        }}
      />
      {preview ? <CollectionPreview preview={preview} onClose={() => setPreview(null)} /> : null}
      <Modal open={!!history} onClose={() => setHistory(null)} title={`Historique — ${history?.[def.title] ?? ""}`} size="lg">
        {history ? (
          <RevisionsPanel
            entityType={def.key}
            entityId={history.id}
            onRestored={() => {
              setHistory(null);
              setVersion((v) => v + 1);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

export function TaxonomyView({ path, label }: { path: string; label: string }) {
  return (
    <ResourceView
      embedded
      config={{
        title: label,
        path,
        columns: [
          { key: "name", label: "Nom", sortable: true },
          { key: "slug", label: "Slug" },
          { key: "sort_order", label: "Ordre" },
        ],
        create: { endpoint: `POST ${path}`, label: "Ajouter", perms: ["cms:write"], fields: { photo_media_id: media("image") } },
        update: { endpoint: `PATCH ${path}/{item_id}`, perms: ["cms:write"], fields: { photo_media_id: media("image") } },
        remove: { path: (r) => `${path}/${r.id}`, perms: ["cms:write"] },
      }}
    />
  );
}

export function CollectionsHub() {
  const [key, setKey] = useState(CMS_COLLECTIONS[0].key);
  const def = CMS_COLLECTIONS.find((c) => c.key === key);
  const taxonomy = CMS_TAXONOMIES.find((t) => t.key === key);
  return (
    <CmsLookupsProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {CMS_COLLECTIONS.map((c) => (
            <button key={c.key} type="button" onClick={() => setKey(c.key)} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${key === c.key ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-line hover:bg-brand-50"}`}>
              {c.label}
            </button>
          ))}
          <span className="mx-1 w-px bg-line" />
          {CMS_TAXONOMIES.map((t) => (
            <button key={t.key} type="button" onClick={() => setKey(t.key)} className={`rounded-full px-3 py-1 text-xs ring-1 ${key === t.key ? "bg-accent-500 text-white ring-accent-500" : "bg-white text-muted ring-line hover:bg-accent-50"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {def ? <CollectionView key={def.key} def={def} /> : null}
        {taxonomy ? <TaxonomyView key={taxonomy.key} path={taxonomy.path} label={taxonomy.label} /> : null}
        {!def && !taxonomy ? <Alert tone="warning">Collection inconnue.</Alert> : null}
      </div>
    </CmsLookupsProvider>
  );
}
