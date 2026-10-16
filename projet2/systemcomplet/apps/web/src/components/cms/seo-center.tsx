"use client";

import { FileUp, Save, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { cleanSeo, SeoEditor } from "@/components/cms/seo-editor";
import { ResourceView, type Row } from "@/components/erp/resource";
import type { FieldConfig } from "@/components/forms/schema-form";
import { FileDrop, Input, Select } from "@/components/ui/form";
import { Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, PageTitle, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

/** Types schema.org proposés (propriétés simples, éditables sans code). */
const SCHEMA_TYPES: { value: string; label: string; props: string[] }[] = [
  { value: "Organization", label: "Organisation (entreprise)", props: ["name", "alternateName", "description", "slogan", "foundingDate", "areaServed", "telephone", "email", "url"] },
  { value: "LocalBusiness", label: "Établissement local", props: ["name", "description", "address", "areaServed", "telephone", "email", "openingHours", "priceRange", "url"] },
  { value: "Service", label: "Service", props: ["name", "serviceType", "description", "category", "areaServed", "audience"] },
  { value: "Article", label: "Article", props: ["headline", "description", "author", "datePublished", "dateModified", "articleSection", "keywords"] },
  { value: "WebPage", label: "Page web", props: ["name", "description", "about", "keywords", "inLanguage"] },
  { value: "WebSite", label: "Site web", props: ["name", "alternateName", "description", "inLanguage"] },
];
const SCHEMA_TYPE_LABEL: Record<string, string> = { ...Object.fromEntries(SCHEMA_TYPES.map((t) => [t.value, t.label])), FAQPage: "Page de FAQ", BreadcrumbList: "Fil d'Ariane" };
const SCHEMA_PROP_LABEL: Record<string, string> = {
  name: "Nom",
  alternateName: "Autre nom",
  description: "Description",
  slogan: "Slogan",
  foundingDate: "Date de création",
  areaServed: "Zone desservie",
  telephone: "Téléphone",
  email: "E-mail",
  url: "Adresse du site",
  address: "Adresse",
  openingHours: "Horaires d'ouverture",
  priceRange: "Gamme de prix",
  serviceType: "Type de service",
  category: "Catégorie",
  audience: "Public visé",
  headline: "Titre",
  author: "Auteur",
  datePublished: "Date de publication",
  dateModified: "Date de mise à jour",
  articleSection: "Rubrique",
  keywords: "Mots-clés",
  about: "Sujet",
  inLanguage: "Langue",
};
const SCHEMA_DATE_PROPS = new Set(["foundingDate", "datePublished", "dateModified"]);

/** Propriétés schema.org d'une donnée structurée : une ligne par propriété (catalogue du type choisi). Les propriétés
 * déjà enregistrées hors catalogue restent affichées et conservées. */
function SchemaPropsEditor({ schemaType, value, onChange }: { schemaType?: string; value: unknown; onChange: (v: Row) => void }) {
  let data: Row = {};
  if (typeof value === "string") {
    try {
      data = value.trim() ? JSON.parse(value) : {};
    } catch {
      data = {};
    }
  } else if (value && typeof value === "object") data = value as Row;
  const catalogue = SCHEMA_TYPES.find((t) => t.value === schemaType)?.props ?? Object.keys(SCHEMA_PROP_LABEL);
  const keys = Object.keys(data);
  const free = catalogue.filter((p) => !keys.includes(p));
  const [adding, setAdding] = useState("");
  const set = (key: string, v: unknown) => onChange({ ...data, [key]: v });
  const remove = (key: string) => onChange(Object.fromEntries(Object.entries(data).filter(([k]) => k !== key)));
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      {keys.length ? null : <p className="text-xs text-muted">Aucune propriété : ajoutez celles qui décrivent la page (nom, zone desservie…).</p>}
      {keys.map((key) => {
        const v = data[key];
        const simple = v === null || ["string", "number", "boolean"].includes(typeof v);
        return (
          <div key={key} className="grid items-center gap-2 sm:grid-cols-[12rem_1fr_auto]">
            <span className="text-sm font-medium">{SCHEMA_PROP_LABEL[key] ?? key}</span>
            {simple ? (
              <Input aria-label={SCHEMA_PROP_LABEL[key] ?? key} type={SCHEMA_DATE_PROPS.has(key) ? "date" : "text"} value={v === null || v === undefined ? "" : String(v)} onChange={(e) => set(key, e.target.value)} maxLength={2000} />
            ) : (
              <span className="text-xs text-muted">Valeur composée conservée</span>
            )}
            <Button size="sm" variant="ghost" onClick={() => remove(key)} aria-label={`Retirer ${SCHEMA_PROP_LABEL[key] ?? key}`}>
              Retirer
            </Button>
          </div>
        );
      })}
      {free.length ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Select value={adding} onChange={(e) => setAdding(e.target.value)} options={free.map((p) => ({ value: p, label: SCHEMA_PROP_LABEL[p] ?? p }))} placeholder="Propriété à ajouter…" className="max-w-xs" />
          <Button
            size="sm"
            variant="secondary"
            disabled={!adding}
            onClick={() => {
              set(adding, "");
              setAdding("");
            }}
          >
            Ajouter la propriété
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Page du site cible (clé interne de la page choisie dans la liste). */
function PageTargetSelect({ value, onChange }: { value: unknown; onChange: (v: string) => void }) {
  const pages = useApi<Row[]>("/cms/pages");
  const options = (pages.data ?? []).map((p) => ({ value: p.route_key, label: `${p.title} (${p.path})` }));
  const current = typeof value === "string" ? value : "";
  if (current && pages.data && !options.some((o) => o.value === current)) options.push({ value: current, label: "Page supprimée" });
  return <Select value={current} onChange={(e) => onChange(e.target.value)} options={options} placeholder={pages.loading ? "Chargement…" : "Choisir une page…"} />;
}

const SCHEMA_FIELDS: Record<string, FieldConfig> = {
  schema_type: { label: "Type", options: SCHEMA_TYPES.map((t) => ({ value: t.value, label: t.label })) },
  target_key: { label: "Page du site", render: ({ value, onChange }) => <PageTargetSelect value={value} onChange={onChange} /> },
  target_type: { hidden: true },
  data: { span: 2, label: "Propriétés", help: "Informations ajoutées au code de la page pour les moteurs de recherche (schema.org).", render: ({ value, onChange, values }) => <SchemaPropsEditor schemaType={values.schema_type} value={value} onChange={onChange} /> },
};
const NETWORKS = ["facebook", "instagram", "linkedin", "tiktok", "youtube", "x", "whatsapp"];

export function SeoOverview() {
  const { can } = useAuth();
  const toast = useToast();
  const rows = useApi<Row[]>("/cms/seo/overview");
  const [q, setQ] = useState("");
  const [onlyIssues, setOnlyIssues] = useState("issues");
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const filtered = useMemo(
    () =>
      (rows.data ?? []).filter((r) => (!q || `${r.title} ${r.path}`.toLowerCase().includes(q.toLowerCase())) && (onlyIssues === "all" || (onlyIssues === "issues" ? (r.issues ?? []).length > 0 : !(r.issues ?? []).length))),
    [rows.data, q, onlyIssues],
  );
  const withIssues = (rows.data ?? []).filter((r) => (r.issues ?? []).length).length;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Contenus indexables" value={rows.data?.length ?? 0} tone="info" />
        <Stat label="À corriger" value={withIssues} tone={withIssues ? "warning" : "success"} />
        <Stat label="Conformes" value={(rows.data?.length ?? 0) - withIssues} tone="success" />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer par titre ou chemin…" className="pl-9" />
        </div>
        <Select value={onlyIssues} onChange={(e) => setOnlyIssues(e.target.value)} options={[{ value: "issues", label: "À corriger" }, { value: "ok", label: "Conformes" }, { value: "all", label: "Tous" }]} aria-label="Filtre" />
      </div>
      <Card>
        {rows.loading && !rows.data ? (
          <Skeleton className="m-4 h-48" />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {filtered.map((r) => (
              <li key={`${r.target_type}:${r.target_key}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="min-w-0">
                  <span className="font-medium">{r.title}</span> <span className="text-xs text-muted">· {optionLabel(r.target_type)}</span>
                  <span className="block font-mono text-xs text-muted">{r.path ?? "—"}</span>
                  {(r.issues ?? []).length ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {(r.issues as string[]).map((issue) => (
                        <Badge key={issue} tone="warning">
                          {issue}
                        </Badge>
                      ))}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {can("seo:write") ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(r);
                        setDraft(r.seo ?? {});
                      }}
                    >
                      Optimiser
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
            {!filtered.length ? <li className="px-5 py-6 text-center text-muted">Aucun contenu dans ce filtre.</li> : null}
          </ul>
        )}
      </Card>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`SEO — ${editing?.title ?? ""}`}
        size="lg"
        footer={
          <Button
            loading={busy}
            onClick={async () => {
              if (!editing) return;
              setBusy(true);
              try {
                await api(`/cms/seo/${editing.target_type}/${encodeURIComponent(editing.target_key)}`, { method: "PUT", body: cleanSeo(draft) });
                toast.success("Métadonnées enregistrées");
                setEditing(null);
                void rows.reload();
              } catch (err) {
                toast.error("Enregistrement impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save className="h-4 w-4" /> Enregistrer
          </Button>
        }
      >
        {editing ? <SeoEditor value={draft} onChange={setDraft} fallbackTitle={editing.title} path={editing.path} /> : null}
      </Modal>
    </div>
  );
}

export function RedirectsView() {
  const { can } = useAuth();
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File[]>([]);
  const [version, setVersion] = useState(0);
  return (
    <>
      <ResourceView
        key={version}
        embedded
        config={{
          title: "Redirections",
          subtitle: "301 / 302 / 410 ; créées automatiquement lors d'un changement d'adresse d'un contenu publié.",
          path: "/cms/redirects",
          columns: [
            { key: "source_path", label: "Ancienne adresse", render: (r) => <span className="font-mono text-xs">{r.source_path}</span> },
            { key: "target_path", label: "Nouvelle adresse", render: (r) => <span className="font-mono text-xs">{r.target_path ?? "—"}</span> },
            { key: "status_code", label: "Code" },
            { key: "hits", label: "Utilisations", format: "number" },
            { key: "auto_generated", label: "Auto", format: "bool", hideOnMobile: true },
            { key: "is_active", label: "Active", format: "bool" },
          ],
          create: { endpoint: "POST /cms/redirects", label: "Nouvelle redirection", perms: ["seo:write"], fields: { status_code: { options: [{ value: "301", label: "301 — définitive" }, { value: "302", label: "302 — temporaire" }, { value: "410", label: "410 — supprimé" }] } } },
          update: { endpoint: "PATCH /cms/redirects/{item_id}", perms: ["seo:write"] },
          remove: { path: (r) => `/cms/redirects/${r.id}`, perms: ["seo:write"] },
          toolbar: can("seo:write") ? (
            <Button size="sm" variant="secondary" onClick={() => setImporting(true)}>
              <FileUp className="h-4 w-4" /> Importer un CSV
            </Button>
          ) : undefined,
        }}
      />
      <Modal
        open={importing}
        onClose={() => setImporting(false)}
        title="Importer des redirections"
        footer={
          <Button
            disabled={!file.length}
            onClick={async () => {
              try {
                const fd = new FormData();
                fd.append("file", file[0]);
                const res = await api<Row>("/cms/redirects/import", { method: "POST", form: fd });
                toast.success("Import terminé", `${res.created} créée(s), ${res.updated} mise(s) à jour`);
                setFile([]);
                setImporting(false);
                setVersion((v) => v + 1);
              } catch (err) {
                toast.error("Import impossible", errorMessage(err));
              }
            }}
          >
            Importer
          </Button>
        }
      >
        <p className="mb-3 text-sm text-muted">Colonnes : ancienne adresse ; nouvelle adresse ; code (301 par défaut). Séparateur « ; » ou « , ».</p>
        <FileDrop files={file} onChange={setFile} accept=".csv,text/csv" maxSizeMb={5} />
      </Modal>
    </>
  );
}

function PageName({ routeKey }: { routeKey?: string }) {
  const pages = useApi<Row[]>("/cms/pages");
  const page = pages.data?.find((p) => p.route_key === routeKey);
  return <span>{page ? page.title : pages.loading ? "…" : "Page supprimée"}</span>;
}

export function StructuredDataView() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Données structurées (schema.org)",
        path: "/cms/schema-markups",
        columns: [
          { key: "schema_type", label: "Type", render: (r) => SCHEMA_TYPE_LABEL[r.schema_type] ?? r.schema_type },
          { key: "target_key", label: "Page", render: (r) => <PageName routeKey={r.target_key} /> },
          { key: "enabled", label: "Actif", format: "bool" },
        ],
        create: { endpoint: "POST /cms/schema-markups", label: "Ajouter", perms: ["seo:write"], fixed: { target_type: "page" }, initial: { schema_type: "WebPage", data: {} }, fields: SCHEMA_FIELDS },
        update: { endpoint: "PATCH /cms/schema-markups/{item_id}", perms: ["seo:write"], fields: SCHEMA_FIELDS },
        detailFields: [
          { key: "schema_type", label: "Type", render: (r) => SCHEMA_TYPE_LABEL[r.schema_type] ?? r.schema_type },
          { key: "target_key", label: "Page", render: (r) => <PageName routeKey={r.target_key} /> },
          { key: "data", label: "Propriétés", render: (r) => Object.entries(r.data ?? {}).map(([k, v]) => `${SCHEMA_PROP_LABEL[k] ?? k} : ${typeof v === "object" ? "…" : String(v)}`).join(" · ") || "—" },
          { key: "enabled", label: "Actif", format: "bool" },
        ],
        remove: { path: (r) => `/cms/schema-markups/${r.id}`, perms: ["seo:write"] },
      }}
    />
  );
}

export function SocialLinksView() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Réseaux sociaux",
        path: "/cms/social-links",
        columns: [
          { key: "sort_order", label: "Ordre" },
          { key: "network", label: "Réseau", format: "option" },
          { key: "url", label: "Adresse" },
          { key: "is_active", label: "Actif", format: "bool" },
        ],
        create: { endpoint: "POST /cms/social-links", label: "Ajouter", perms: ["cms:publish"], fields: { network: { options: NETWORKS.map((n) => ({ value: n, label: optionLabel(n) })) } } },
        update: { endpoint: "PATCH /cms/social-links/{item_id}", perms: ["cms:publish"], fields: { network: { options: NETWORKS.map((n) => ({ value: n, label: optionLabel(n) })) } } },
        remove: { path: (r) => `/cms/social-links/${r.id}`, perms: ["cms:publish"] },
      }}
    />
  );
}

export function SeoCenter() {
  const [tab, setTab] = useState("audit");
  return (
    <div className="space-y-5">
      <PageTitle title="SEO" subtitle="Audit des métadonnées, redirections, données structurées, réseaux sociaux ; sitemap et robots générés automatiquement." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "audit", label: "Audit et métadonnées" },
          { key: "redirections", label: "Redirections" },
          { key: "schema", label: "Données structurées" },
          { key: "social", label: "Réseaux sociaux" },
        ]}
      />
      {tab === "audit" ? <SeoOverview /> : null}
      {tab === "redirections" ? <RedirectsView /> : null}
      {tab === "schema" ? <StructuredDataView /> : null}
      {tab === "social" ? <SocialLinksView /> : null}
      <Card className="p-4 text-sm text-muted">
        <CardHeader title="Fichiers publics" className="p-0" />
        <p className="mt-1">
          Plan du site : <a className="text-brand-600 hover:underline" href="/sitemap.xml" target="_blank" rel="noopener noreferrer">/sitemap.xml</a> · Robots : <a className="text-brand-600 hover:underline" href="/robots.txt" target="_blank" rel="noopener noreferrer">/robots.txt</a>
        </p>
      </Card>
      <Alert tone="info">Les modifications publiées invalident le cache du site public en quelques secondes.</Alert>
    </div>
  );
}
