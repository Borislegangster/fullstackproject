"use client";

import { ArrowDown, ArrowUp, ChevronRight, Download, Plus, Reply, Save, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { SpecFields } from "@/components/cms/blocks-editor";
import { AutoReplyEditor, FormDefinitionEditor } from "@/components/cms/form-editor";
import { MediaPicker } from "@/components/cms/media-picker";
import { ResourceView, type Row } from "@/components/erp/resource";
import { Checkbox, Field, Input, Select, TagInput, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, download, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { useApi, useList } from "@/lib/hooks";

/* ----------------------------------------------------------------------------- réglages du site */

/** Textes du bandeau cookies (vides = textes par défaut du site). */
const CONSENT_TEXTS: { key: string; label: string; placeholder: string; long?: boolean }[] = [
  { key: "title", label: "Titre du bandeau", placeholder: "Vos choix en matière de cookies" },
  { key: "banner", label: "Message du bandeau", placeholder: "Nous utilisons des cookies nécessaires au fonctionnement du site et, avec votre accord, des cookies de mesure d'audience et publicitaires.", long: true },
  { key: "necessary", label: "Cookies nécessaires", placeholder: "Sécurité, session, préférences. Toujours actifs." },
  { key: "analytics", label: "Mesure d'audience", placeholder: "Statistiques de visite pour améliorer le site (Google Analytics, mesure interne)." },
  { key: "marketing", label: "Marketing", placeholder: "Mesure des campagnes et publicités personnalisées (Google Ads, Meta, TikTok, LinkedIn)." },
];

/** Pages exclues des moteurs de recherche : stockées comme lignes « Disallow: /chemin » du robots.txt. */
const robotsPaths = (extra: unknown): string[] =>
  String(extra ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.toLowerCase().startsWith("disallow:"))
    .map((l) => l.slice(9).trim())
    .filter(Boolean);

/** Aperçu des déclinaisons de l'icône unique de la plateforme + pack pour les applications mobile et bureau. */
function PlatformIconPreview({ name }: { name: string }) {
  const toast = useToast();
  const brand = useApi<Row>("/public/brand");
  if (brand.loading && !brand.data) return <Skeleton className="h-24 w-full" />;
  const b = brand.data;
  if (!b) return null;
  const tiles: { label: string; node: ReactNode }[] = [
    {
      label: "Onglet du navigateur",
      node: (
        <span className="flex h-9 w-44 items-center gap-2 rounded-t-lg border border-b-0 border-line bg-white px-2.5 text-xs">
          <img src={b.favicon_png} alt="" className="h-4 w-4" />
          <span className="truncate">{name}</span>
        </span>
      ),
    },
    { label: "Application installée", node: <img src={b.sizes?.["192"]} alt="" className="h-14 w-14 rounded-2xl bg-white shadow ring-1 ring-line" /> },
    { label: "Android (adaptative)", node: <img src={b.icons?.find((i: Row) => i.purpose === "maskable")?.src} alt="" className="h-14 w-14 rounded-full shadow ring-1 ring-line" /> },
    { label: "iPhone / iPad", node: <img src={b.apple_touch_icon} alt="" className="h-14 w-14 rounded-[22%] shadow ring-1 ring-line" /> },
    {
      label: "Assistant du site",
      node: (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow ring-2 ring-brand-400">
          <img src={b.sizes?.["192"]} alt="" className="h-9 w-9 object-contain" />
        </span>
      ),
    },
  ];
  return (
    <div className="space-y-3 rounded-xl border border-line bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-end gap-5">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-1.5">
            {t.node}
            <span className="text-[11px] text-muted">{t.label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">
          {b.origin === "default" ? "Icône GLOBUS par défaut (aucune icône choisie)." : "Icône choisie dans la médiathèque."} Les navigateurs peuvent garder l'ancienne icône en cache quelques minutes.
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => download("/cms/brand/icon-pack", "icones-plateforme.zip").catch((err) => toast.error("Téléchargement impossible", errorMessage(err)))}
        >
          <Download className="h-4 w-4" /> Pack d'icônes (applications)
        </Button>
      </div>
    </div>
  );
}

const TRACKING_KEYS: [string, string][] = [
  ["ga4_id", "Google Analytics 4 (G-…)"],
  ["gads_id", "Google Ads (AW-…)"],
  ["meta_pixel", "Pixel Meta"],
  ["tiktok_pixel", "Pixel TikTok"],
  ["linkedin_partner", "LinkedIn Insight (partner id)"],
];
const LEGAL_KEYS: [string, string][] = [
  ["forme", "Forme juridique"],
  ["capital", "Capital social"],
  ["rccm", "RCCM"],
  ["niu", "NIU"],
  ["siege", "Siège social"],
  ["directeur_publication", "Directeur de la publication"],
  ["hebergeur", "Hébergeur"],
];

export function SiteSettingsEditor() {
  const { can } = useAuth();
  const toast = useToast();
  const settings = useApi<Row>("/cms/site-settings");
  const [v, setV] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [iconKey, setIconKey] = useState(0);
  useEffect(() => {
    if (settings.data && !v) setV(settings.data);
  }, [settings.data, v]);
  if (settings.loading && !v) return <Skeleton className="h-96" />;
  if (!v) return <Alert tone="danger">{settings.error}</Alert>;
  const set = (patch: Row) => setV({ ...v, ...patch });
  const nested = (key: string, sub: string, value: string) => set({ [key]: { ...(v[key] ?? {}), [sub]: value || undefined } });
  const editable = can("cms:publish");
  return (
    <div className="space-y-5">
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <p className="font-semibold sm:col-span-2">Identité</p>
        <Field label="Raison sociale">
          <Input value={v.company_name ?? ""} onChange={(e) => set({ company_name: e.target.value })} />
        </Field>
        <Field label="Slogan">
          <Input value={v.slogan ?? ""} onChange={(e) => set({ slogan: e.target.value })} />
        </Field>
        <Field label="Promesse" className="sm:col-span-2">
          <Textarea value={v.promise ?? ""} onChange={(e) => set({ promise: e.target.value })} rows={2} />
        </Field>
        <Field label="Logo">
          <MediaPicker value={v.logo_media_id} onChange={(id) => set({ logo_media_id: id })} kind="image" />
        </Field>
        <Field label="Logo (fond sombre)">
          <MediaPicker value={v.logo_dark_media_id} onChange={(id) => set({ logo_dark_media_id: id })} kind="image" />
        </Field>
        <Field label="Image de partage par défaut">
          <MediaPicker value={v.default_og_media_id} onChange={(id) => set({ default_og_media_id: id })} kind="image" />
        </Field>
        <Field
          label="Icône de la plateforme"
          className="sm:col-span-2"
          help="Icône unique, appliquée partout dès l'enregistrement : onglet du navigateur, application installée, raccourci iPhone, assistant du site, notifications et futures applications mobile et bureau. Image carrée PNG ou WebP, idéalement 512 px ou plus, fond transparent de préférence. Le logo reste réservé aux en-têtes, pieds de page et documents."
        >
          <div className="space-y-3">
            <MediaPicker value={v.favicon_media_id} onChange={(id) => set({ favicon_media_id: id })} kind="image" />
            <PlatformIconPreview key={iconKey} name={v.company_name ?? "GLOBUS ENGINEERING"} />
          </div>
        </Field>
      </Card>
      <Card className="grid gap-4 p-5 sm:grid-cols-3">
        <p className="font-semibold sm:col-span-3">Coordonnées</p>
        <Field label="E-mail">
          <Input type="email" value={v.email ?? ""} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Téléphone">
          <Input value={v.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="WhatsApp">
          <Input value={v.whatsapp ?? ""} onChange={(e) => set({ whatsapp: e.target.value })} />
        </Field>
        <Field label="Adresse" className="sm:col-span-3">
          <Textarea value={v.address ?? ""} onChange={(e) => set({ address: e.target.value })} rows={2} />
        </Field>
        <Field label="Ville">
          <Input value={v.city ?? ""} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="Pays">
          <Input value={v.country ?? ""} onChange={(e) => set({ country: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Latitude">
            <Input type="number" step="any" value={v.latitude ?? ""} onChange={(e) => set({ latitude: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Longitude">
            <Input type="number" step="any" value={v.longitude ?? ""} onChange={(e) => set({ longitude: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Horaires d'ouverture" className="sm:col-span-3">
          <SpecFields
            specs={[{ key: "items", label: "", type: "items", itemLabel: "Créneau", newItem: () => ({ days: "", hours: "" }), fields: [{ key: "days", label: "Jours", type: "text" }, { key: "hours", label: "Horaires", type: "text" }] }]}
            value={{ items: v.opening_hours ?? [] }}
            onChange={(x) => set({ opening_hours: x.items })}
          />
        </Field>
        <Field label="Fiche Google Business (URL)" className="sm:col-span-3">
          <Input value={v.google_business_url ?? ""} onChange={(e) => set({ google_business_url: e.target.value })} />
        </Field>
      </Card>
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <p className="font-semibold sm:col-span-2">Mentions légales</p>
        {LEGAL_KEYS.map(([k, label]) => (
          <Field key={k} label={label}>
            <Input value={v.legal_info?.[k] ?? ""} onChange={(e) => nested("legal_info", k, e.target.value)} />
          </Field>
        ))}
      </Card>
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <p className="font-semibold sm:col-span-2">SEO et mesure d'audience</p>
        <Field label="Modèle de titre" help="%s est remplacé par le titre de la page.">
          <Input value={v.seo_title_template ?? ""} onChange={(e) => set({ seo_title_template: e.target.value })} />
        </Field>
        <Field label="Vérification Search Console">
          <Input value={v.search_console_verification ?? ""} onChange={(e) => set({ search_console_verification: e.target.value })} />
        </Field>
        <Field label="Méta-description par défaut" className="sm:col-span-2">
          <Textarea value={v.default_meta_description ?? ""} onChange={(e) => set({ default_meta_description: e.target.value })} rows={2} />
        </Field>
        {TRACKING_KEYS.map(([k, label]) => (
          <Field key={k} label={label} help="Chargé uniquement après consentement.">
            <Input value={v.tracking?.[k] ?? ""} onChange={(e) => nested("tracking", k, e.target.value)} />
          </Field>
        ))}
        <Field label="Pages à exclure des moteurs de recherche" className="sm:col-span-2" help="Adresse de chaque page à ne pas référencer, ex. /offres/ancienne-offre (les espaces privés sont déjà exclus).">
          <TagInput
            value={robotsPaths(v.robots_extra)}
            placeholder="/adresse-de-la-page puis Entrée"
            onChange={(paths) => set({ robots_extra: paths.map((p) => p.trim()).filter((p) => p.startsWith("/")).map((p) => `Disallow: ${p}`).join("\n") || null })}
          />
        </Field>
      </Card>
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <p className="font-semibold sm:col-span-2">Consentement et maintenance</p>
        <Field label="Version de la politique de consentement" help="Changer la version redemande le consentement aux visiteurs.">
          <Input value={v.consent_policy_version ?? ""} onChange={(e) => set({ consent_policy_version: e.target.value })} />
        </Field>
        <p className="text-sm font-medium sm:col-span-2">Textes du bandeau cookies <span className="font-normal text-muted">(vides : textes par défaut affichés en grisé)</span></p>
        {CONSENT_TEXTS.map((t) => (
          <Field key={t.key} label={t.label} className={t.long ? "sm:col-span-2" : undefined}>
            {t.long ? (
              <Textarea value={v.consent_texts?.[t.key] ?? ""} placeholder={t.placeholder} onChange={(e) => nested("consent_texts", t.key, e.target.value)} rows={2} />
            ) : (
              <Input value={v.consent_texts?.[t.key] ?? ""} placeholder={t.placeholder} onChange={(e) => nested("consent_texts", t.key, e.target.value)} />
            )}
          </Field>
        ))}
        <Field label="Message de maintenance (vide = site ouvert)" className="sm:col-span-2">
          <Textarea value={v.maintenance_message ?? ""} onChange={(e) => set({ maintenance_message: e.target.value })} rows={2} />
        </Field>
      </Card>
      {editable ? (
        <div className="sticky bottom-4 flex justify-end">
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const body = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === "" ? null : val]));
                setV(await api<Row>("/cms/site-settings", { method: "PUT", body }));
                setIconKey((k) => k + 1);
                toast.success("Réglages enregistrés", "Le site public est mis à jour (cache invalidé).");
              } catch (err) {
                toast.error("Enregistrement impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save className="h-4 w-4" /> Enregistrer
          </Button>
        </div>
      ) : (
        <Alert tone="info">Modification réservée aux publicateurs (cms:publish).</Alert>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------- navigation */

interface NavItem {
  label: string;
  link_type: "page" | "path" | "url" | "anchor";
  page_route_key: string | null;
  url: string | null;
  description: string | null;
  icon: string | null;
  open_new_tab: boolean;
  highlight: boolean;
  visible: boolean;
  children: NavItem[];
}

const MENUS: [string, string][] = [
  ["header", "En-tête"],
  ["mobile", "Menu mobile"],
  ["cta", "Boutons d'action de l'en-tête"],
  ["footer_main", "Pied de page — principal"],
  ["footer_services", "Pied de page — services"],
  ["footer_legal", "Pied de page — légal"],
];

const newItem = (): NavItem => ({ label: "", link_type: "page", page_route_key: null, url: null, description: null, icon: null, open_new_tab: false, highlight: false, visible: true, children: [] });

function NavItemsEditor({ items, onChange, pages, depth = 0 }: { items: NavItem[]; onChange: (v: NavItem[]) => void; pages: { value: string; label: string }[]; depth?: number }) {
  const set = (i: number, patch: Partial<NavItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => {
    const next = items.slice();
    const [it] = next.splice(i, 1);
    next.splice(i + d, 0, it);
    onChange(next);
  };
  return (
    <div className={`space-y-2 ${depth ? "ml-6 border-l-2 border-brand-100 pl-3" : ""}`}>
      {items.map((it, i) => (
        <div key={i} className="rounded-xl border border-line bg-white p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_9rem_1fr_auto]">
            <Input value={it.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Libellé" />
            <Select value={it.link_type} onChange={(e) => set(i, { link_type: e.target.value as NavItem["link_type"] })} options={[{ value: "page", label: "Page CMS" }, { value: "path", label: "Chemin" }, { value: "url", label: "URL externe" }, { value: "anchor", label: "Ancre" }]} aria-label="Type de lien" />
            {it.link_type === "page" ? (
              <Select value={it.page_route_key ?? ""} onChange={(e) => set(i, { page_route_key: e.target.value || null })} options={[{ value: "", label: "Choisir une page…" }, ...pages]} aria-label="Page" />
            ) : (
              <Input value={it.url ?? ""} onChange={(e) => set(i, { url: e.target.value })} placeholder={it.link_type === "url" ? "https://…" : it.link_type === "anchor" ? "#section" : "/chemin"} />
            )}
            <span className="flex items-center gap-1">
              <button type="button" aria-label="Monter" disabled={i === 0} className="rounded p-1.5 text-muted hover:bg-slate-100 disabled:opacity-30" onClick={() => move(i, -1)}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Descendre" disabled={i === items.length - 1} className="rounded p-1.5 text-muted hover:bg-slate-100 disabled:opacity-30" onClick={() => move(i, 1)}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Supprimer" className="rounded p-1.5 text-muted hover:text-red-600" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Input value={it.description ?? ""} onChange={(e) => set(i, { description: e.target.value || null })} placeholder="Description (méga-menu)" className="h-8 max-w-xs" />
            <Input value={it.icon ?? ""} onChange={(e) => set(i, { icon: e.target.value || null })} placeholder="Icône" className="h-8 w-28" />
            <Checkbox label="Visible" checked={it.visible} onChange={(c) => set(i, { visible: c })} />
            <Checkbox label="Mis en avant" checked={it.highlight} onChange={(c) => set(i, { highlight: c })} />
            <Checkbox label="Nouvel onglet" checked={it.open_new_tab} onChange={(c) => set(i, { open_new_tab: c })} />
          </div>
          {depth < 2 ? (
            <div className="mt-2">
              <NavItemsEditor items={it.children} onChange={(children) => set(i, { children })} pages={pages} depth={depth + 1} />
              {it.children.length < 20 ? (
                <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline" onClick={() => set(i, { children: [...it.children, newItem()] })}>
                  <ChevronRight className="h-3 w-3" /> Sous-élément
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
      {depth === 0 ? (
        <Button size="sm" variant="secondary" onClick={() => onChange([...items, newItem()])}>
          <Plus className="h-4 w-4" /> Élément
        </Button>
      ) : null}
    </div>
  );
}

function clean(items: NavItem[]): Row[] {
  return items.map((i) => ({ ...i, url: i.link_type === "page" ? null : i.url, page_route_key: i.link_type === "page" ? i.page_route_key : null, children: clean(i.children) }));
}

export function NavigationEditor() {
  const { can } = useAuth();
  const toast = useToast();
  const menus = useApi<{ key: string; title: string; items: NavItem[] }[]>("/cms/navigation");
  const pages = useApi<Row[]>("/cms/pages");
  const [key, setKey] = useState("header");
  const [draft, setDraft] = useState<{ title: string; items: NavItem[] } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!menus.data) return;
    const menu = menus.data.find((x) => x.key === key);
    setDraft({ title: menu?.title ?? MENUS.find((x) => x[0] === key)?.[1] ?? key, items: menu?.items ?? [] });
  }, [menus.data, key]);
  const pageOptions = (pages.data ?? []).map((p) => ({ value: p.route_key, label: `${p.title} (${p.path})` }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {MENUS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setKey(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${key === k ? "bg-brand-500 text-white ring-brand-500" : "bg-white ring-line"}`}>
            {label}
          </button>
        ))}
      </div>
      {!draft ? (
        <Skeleton className="h-64" />
      ) : (
        <Card className="space-y-4 p-5">
          <Field label="Titre du menu">
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <NavItemsEditor items={draft.items} onChange={(items) => setDraft({ ...draft, items })} pages={pageOptions} />
          {can("cms:publish") ? (
            <div className="flex justify-end">
              <Button
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`/cms/navigation/${key}`, { method: "PUT", body: { title: draft.title, items: clean(draft.items) } });
                    toast.success("Menu publié");
                    void menus.reload();
                  } catch (err) {
                    toast.error("Enregistrement impossible", errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Save className="h-4 w-4" /> Publier le menu
              </Button>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------- formulaires */

function Submissions({ formKey }: { formKey: string }) {
  const list = useList<Row>(`/cms/forms/${formKey}/submissions`, { pageSize: 25 });
  return (
    <ul className="divide-y divide-line text-sm">
      {list.items.map((s) => (
        <li key={s.id} className="px-1 py-2">
          <p className="text-xs text-muted">
            {dateTime(s.created_at)} · <StatusBadge status={s.status} /> {s.lead_id ? "· lead créé" : ""}
          </p>
          <p className="mt-0.5">
            {Object.entries((s.data ?? {}) as Row)
              .map(([k, val]) => `${k} : ${String(val)}`)
              .join(" · ")}
          </p>
        </li>
      ))}
      {!list.loading && !list.items.length ? <li className="py-3 text-muted">Aucun envoi.</li> : null}
    </ul>
  );
}

export function FormsAdmin() {
  const { can } = useAuth();
  const [submissions, setSubmissions] = useState<Row | null>(null);
  const [form, setForm] = useState<Row | "new" | null>(null);
  const [reply, setReply] = useState<Row | "new" | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  return (
    <div className="space-y-8">
      <ResourceView
        key={`forms-${version}`}
        embedded
        config={{
          title: "Formulaires",
          subtitle: "Questions posées, consentements, traitement après l'envoi (prospect CRM, newsletter, SAV), accusé de réception et équipes prévenues.",
          path: "/cms/forms",
          columns: [
            { key: "title", label: "Formulaire", render: (r) => <span className="font-medium">{r.title}</span> },
            { key: "key", label: "Emplacement" },
            { key: "destination", label: "Après l'envoi", render: (r) => DESTINATION_LABELS[r.destination] ?? r.destination },
            { key: "fields", label: "Questions", render: (r) => (r.fields ?? []).length },
            { key: "is_active", label: "En ligne", format: "bool" },
          ],
          toolbar: can("cms:publish") ? (
            <Button onClick={() => setForm("new")}>
              <Plus className="h-4 w-4" /> Nouveau formulaire
            </Button>
          ) : undefined,
          actions: [
            { key: "edit", label: "Modifier", perms: ["cms:publish"], run: (r) => setForm(r) },
            { key: "submissions", label: "Envois reçus", run: (r) => setSubmissions(r) },
          ],
        }}
      />
      <ResourceView
        key={`replies-${version}`}
        embedded
        config={{
          title: "Réponses automatiques",
          subtitle: "Accusés de réception e-mail / WhatsApp envoyés au visiteur après un formulaire, personnalisés avec son prénom et le numéro de sa demande.",
          path: "/cms/auto-replies",
          columns: [
            { key: "code", label: "Nom" },
            { key: "channel", label: "Canal", format: "option" },
            { key: "subject", label: "Objet" },
            { key: "version", label: "Version" },
            { key: "is_active", label: "Active", format: "bool" },
          ],
          toolbar: can("cms:publish") ? (
            <Button variant="secondary" onClick={() => setReply("new")}>
              <Plus className="h-4 w-4" /> Nouvelle réponse
            </Button>
          ) : undefined,
          actions: [{ key: "edit", label: "Modifier", perms: ["cms:publish"], run: (r) => setReply(r) }],
          remove: { path: (r) => `/cms/auto-replies/${r.id}`, perms: ["cms:publish"] },
        }}
      />
      {form ? (
        <FormDefinitionEditor
          initial={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            refresh();
          }}
        />
      ) : null}
      {reply ? (
        <AutoReplyEditor
          initial={reply === "new" ? null : reply}
          onClose={() => setReply(null)}
          onSaved={() => {
            setReply(null);
            refresh();
          }}
        />
      ) : null}
      <Modal open={!!submissions} onClose={() => setSubmissions(null)} title={`Envois — ${submissions?.title ?? ""}`} size="lg">
        {submissions ? <Submissions formKey={submissions.key} /> : null}
      </Modal>
    </div>
  );
}

const DESTINATION_LABELS: Record<string, string> = { crm_lead: "Prospect CRM", newsletter: "Newsletter", ticket: "Demande SAV", none: "Archivage" };

/* ----------------------------------------------------------------------------- commentaires */

export function CommentsModeration() {
  const { can, user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const list = useList<Row>("/cms/blog-comments", { pageSize: 30 }, { status: status || undefined });
  const [replyTo, setReplyTo] = useState<Row | null>(null);
  const [reply, setReply] = useState("");
  const moderate = async (c: Row, target: string) => {
    try {
      await api(`/cms/blog-comments/${c.id}/moderate`, { method: "POST", body: { status: target } });
      void list.reload();
    } catch (err) {
      toast.error("Modération impossible", errorMessage(err));
    }
  };
  return (
    <div className="space-y-4">
      <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "pending", label: "En attente" }, { value: "approved", label: "Publiés" }, { value: "rejected", label: "Refusés" }, { value: "spam", label: "Indésirables" }, { value: "", label: "Tous" }]} aria-label="Statut" />
      <Card>
        <CardHeader title="Commentaires du blog" subtitle={`${list.total} commentaire(s)`} />
        <ul className="divide-y divide-line">
          {list.items.map((c) => (
            <li key={c.id} className="space-y-2 px-5 py-3 text-sm">
              <p className="text-xs text-muted">
                {dateTime(c.created_at)} · sur « {c.post_title} » · <strong>{c.author_name}</strong> {c.is_staff ? <Badge tone="info">GLOBUS</Badge> : null} <StatusBadge status={c.status} />
              </p>
              <p className="whitespace-pre-line">{c.content}</p>
              {can("cms:write") ? (
                <div className="flex flex-wrap gap-2">
                  {c.status !== "approved" ? (
                    <Button size="sm" onClick={() => void moderate(c, "approved")}>
                      Publier
                    </Button>
                  ) : null}
                  {c.status !== "rejected" ? (
                    <Button size="sm" variant="secondary" onClick={() => void moderate(c, "rejected")}>
                      Refuser
                    </Button>
                  ) : null}
                  {c.status !== "spam" ? (
                    <Button size="sm" variant="ghost" onClick={() => void moderate(c, "spam")}>
                      Indésirable
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setReplyTo(c)}>
                    <Reply className="h-4 w-4" /> Répondre
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
          {!list.loading && !list.items.length ? <li className="px-5 py-4 text-sm text-muted">Aucun commentaire.</li> : null}
        </ul>
      </Card>
      <Modal
        open={!!replyTo}
        onClose={() => setReplyTo(null)}
        title="Réponse publique de GLOBUS"
        footer={
          <Button
            disabled={reply.trim().length < 3}
            onClick={async () => {
              try {
                await api(`/cms/blog-comments/${replyTo?.id}/reply`, { method: "POST", body: { author_name: user?.full_name ?? "GLOBUS", content: reply.trim() } });
                setReply("");
                setReplyTo(null);
                void list.reload();
                toast.success("Réponse publiée");
              } catch (err) {
                toast.error("Réponse impossible", errorMessage(err));
              }
            }}
          >
            Publier la réponse
          </Button>
        }
      >
        <p className="mb-2 rounded-xl bg-surface p-3 text-sm">{replyTo?.content}</p>
        <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} />
      </Modal>
    </div>
  );
}
