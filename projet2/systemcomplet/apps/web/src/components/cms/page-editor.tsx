"use client";

import { ArrowDown, ArrowUp, ExternalLink, Eye, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BlocksEditor, CmsLookupsProvider, type EditableBlock } from "@/components/cms/blocks-editor";
import { MediaPicker } from "@/components/cms/media-picker";
import { RichTextEditor } from "@/components/cms/rich-text";
import { cleanSeo, EMPTY_SEO, SeoEditor } from "@/components/cms/seo-editor";
import { SectionView } from "@/components/site/blocks";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, EmptyState, PageTitle, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, toInputDateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

type Row = Record<string, any>;

export const CMS_TRANSITIONS: Record<string, { target: string; label: string; perm: string }[]> = {
  draft: [
    { target: "in_review", label: "Soumettre à relecture", perm: "cms:write" },
    { target: "published", label: "Publier directement", perm: "cms:publish" },
  ],
  in_review: [
    { target: "validated", label: "Valider", perm: "cms:review" },
    { target: "published", label: "Publier", perm: "cms:publish" },
    { target: "draft", label: "Renvoyer en brouillon", perm: "cms:review" },
  ],
  validated: [
    { target: "published", label: "Publier", perm: "cms:publish" },
    { target: "draft", label: "Renvoyer en brouillon", perm: "cms:review" },
  ],
  published: [
    { target: "archived", label: "Archiver", perm: "cms:publish" },
    { target: "draft", label: "Dépublier (brouillon)", perm: "cms:publish" },
  ],
  archived: [{ target: "draft", label: "Restaurer en brouillon", perm: "cms:publish" }],
};

interface SectionDraft {
  id?: string | null;
  key: string;
  title: string;
  visible: boolean;
  settings: Row;
  blocks: EditableBlock[];
}

interface PageDraft {
  route_key: string;
  path: string;
  title: string;
  template: string;
  summary: string;
  body: string;
  sort_order: number;
  publish_at: string;
  unpublish_at: string;
  sections: SectionDraft[];
  seo: Row;
}

const emptyPage = (): PageDraft => ({ route_key: "", path: "/", title: "", template: "default", summary: "", body: "", sort_order: 0, publish_at: "", unpublish_at: "", sections: [], seo: { ...EMPTY_SEO } });

function fromApi(p: Row): PageDraft {
  return {
    route_key: p.route_key,
    path: p.path,
    title: p.title,
    template: p.template,
    summary: p.summary ?? "",
    body: p.body ?? "",
    sort_order: p.sort_order ?? 0,
    publish_at: p.publish_at ? toInputDateTime(p.publish_at) : "",
    unpublish_at: p.unpublish_at ? toInputDateTime(p.unpublish_at) : "",
    sections: ((p.sections ?? []) as Row[]).map((s) => ({ id: s.id, key: s.key, title: s.title ?? "", visible: s.visible !== false, settings: s.settings ?? {}, blocks: ((s.blocks ?? []) as Row[]).map((b) => ({ id: b.id, visible: b.visible !== false, data: b.data })) })),
    seo: { ...EMPTY_SEO, ...(p.seo ?? {}) },
  };
}

function toApi(d: PageDraft): Row {
  return {
    route_key: d.route_key.trim(),
    path: d.path.trim(),
    title: d.title.trim(),
    template: d.template,
    summary: d.summary || null,
    body: d.body || null,
    sort_order: Number(d.sort_order) || 0,
    publish_at: d.publish_at ? new Date(d.publish_at).toISOString() : null,
    unpublish_at: d.unpublish_at ? new Date(d.unpublish_at).toISOString() : null,
    sections: d.sections.map((s) => ({
      id: s.id ?? null,
      key: s.key,
      title: s.title || null,
      visible: s.visible,
      settings: Object.fromEntries(Object.entries(s.settings).filter(([, v]) => v !== "" && v !== null && v !== undefined)),
      blocks: s.blocks.map((b) => ({ id: b.id ?? null, visible: b.visible, data: b.data })),
    })),
    seo: cleanSeo(d.seo),
  };
}

function SectionEditor({ section, index, count, onChange, onRemove, onMove }: { section: SectionDraft; index: number; count: number; onChange: (s: SectionDraft) => void; onRemove: () => void; onMove: (d: number) => void }) {
  const set = (patch: Partial<SectionDraft>) => onChange({ ...section, ...patch });
  const setting = (key: string, value: unknown) => set({ settings: { ...section.settings, [key]: value } });
  return (
    <Card className={section.visible ? "" : "opacity-70"}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <span className="rounded-md bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-700">Section {index + 1}</span>
        <Input value={section.key} onChange={(e) => set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-") })} className="h-8 w-40" aria-label="Identifiant de section" />
        <Input value={section.title} onChange={(e) => set({ title: e.target.value })} placeholder="Titre interne / accessibilité" className="h-8 min-w-[12rem] flex-1" />
        <Checkbox label="Visible" checked={section.visible} onChange={(c) => set({ visible: c })} />
        <button type="button" aria-label="Monter la section" disabled={index === 0} className="rounded p-1.5 text-muted hover:bg-slate-100 disabled:opacity-30" onClick={() => onMove(-1)}>
          <ArrowUp className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Descendre la section" disabled={index === count - 1} className="rounded p-1.5 text-muted hover:bg-slate-100 disabled:opacity-30" onClick={() => onMove(1)}>
          <ArrowDown className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Supprimer la section" className="rounded p-1.5 text-muted hover:text-red-600" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-4 p-4">
        <details className="rounded-xl bg-surface p-3 text-sm">
          <summary className="cursor-pointer font-medium">Apparence de la section</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Field label="Fond">
              <Select value={section.settings.background ?? ""} onChange={(e) => setting("background", e.target.value)} options={[{ value: "", label: "Alterné automatique" }, { value: "white", label: "Blanc" }, { value: "surface", label: "Gris clair" }, { value: "light", label: "Bleu très clair" }, { value: "accent", label: "Orange très clair" }, { value: "brand", label: "Bleu GLOBUS" }, { value: "dark", label: "Sombre" }, { value: "night", label: "Nuit futuriste (grille + halos)" }, { value: "gradient", label: "Dégradé GLOBUS" }, { value: "aurora", label: "Aurore claire" }]} />
            </Field>
            <Field label="Largeur">
              <Select value={section.settings.width ?? ""} onChange={(e) => setting("width", e.target.value)} options={[{ value: "", label: "Standard" }, { value: "narrow", label: "Étroite (lecture)" }, { value: "full", label: "Pleine largeur" }]} />
            </Field>
            <Field label="Espacement">
              <Select value={section.settings.padding ?? ""} onChange={(e) => setting("padding", e.target.value)} options={[{ value: "", label: "Moyen" }, { value: "none", label: "Aucun" }, { value: "sm", label: "Petit" }, { value: "lg", label: "Grand" }]} />
            </Field>
            <Field label="Ancre (#)">
              <Input value={section.settings.anchor ?? ""} onChange={(e) => setting("anchor", e.target.value.replace(/[^a-z0-9_-]/gi, ""))} />
            </Field>
            <Field label="Image de fond" className="sm:col-span-4">
              <MediaPicker value={section.settings.media_id ?? null} onChange={(id) => setting("media_id", id)} kind="image" />
            </Field>
          </div>
        </details>
        <BlocksEditor value={section.blocks} onChange={(blocks) => set({ blocks })} />
      </div>
    </Card>
  );
}

export function RevisionsPanel({ entityType, entityId, onRestored }: { entityType: string; entityId: string; onRestored: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const revisions = useApi<Row[]>(`/cms/revisions/${entityType}/${entityId}`);
  const [restoring, setRestoring] = useState<Row | null>(null);
  return (
    <Card>
      <ul className="divide-y divide-line text-sm">
        {(revisions.data ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
            <span>
              Révision {r.number} · {dateTime(r.created_at)} <StatusBadge status={r.status} />
              {r.note ? <span className="block text-xs text-muted">{r.note}</span> : null}
            </span>
            {can("cms:write") ? (
              <Button size="sm" variant="ghost" onClick={() => setRestoring(r)}>
                Restaurer
              </Button>
            ) : null}
          </li>
        ))}
        {!revisions.data?.length ? <li className="px-5 py-4 text-muted">Aucune révision.</li> : null}
      </ul>
      <ConfirmDialog
        open={!!restoring}
        onClose={() => setRestoring(null)}
        title={`Restaurer la révision ${restoring?.number ?? ""}`}
        text="Le contenu actuel est remplacé par cette version (une nouvelle révision est créée, rien n'est perdu)."
        onConfirm={async () => {
          await api(`/cms/revisions/item/${restoring?.id}/restore`, { method: "POST" });
          toast.success("Révision restaurée");
          onRestored();
          void revisions.reload();
        }}
      />
    </Card>
  );
}

export function PageEditor({ pageId }: { pageId: string | null }) {
  const { can } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const page = useApi<Row>(pageId ? `/cms/pages/${pageId}` : null);
  const [draft, setDraft] = useState<PageDraft | null>(pageId ? null : emptyPage());
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState("contenu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transition, setTransition] = useState<{ target: string; label: string } | null>(null);
  const [note, setNote] = useState("");
  const [schedule, setSchedule] = useState({ publish_at: "", unpublish_at: "" });
  const [preview, setPreview] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (page.data && !dirty) setDraft(fromApi(page.data));
  }, [page.data, dirty]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (pageId && page.loading && !draft) return <Skeleton className="h-96 w-full" />;
  if (pageId && page.error && !draft) return <Alert tone="danger">{page.error}</Alert>;
  if (!draft) return null;
  const update = (patch: Partial<PageDraft>) => {
    setDraft({ ...draft, ...patch });
    setDirty(true);
  };
  const status = page.data?.status ?? "draft";
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await api<Row>(pageId ? `/cms/pages/${pageId}` : "/cms/pages", { method: pageId ? "PUT" : "POST", body: toApi(draft) });
      setDirty(false);
      toast.success("Page enregistrée", status === "published" ? "La version en ligne est mise à jour." : undefined);
      if (!pageId) router.replace(`/erp/cms/pages/${saved.id}`);
      else {
        page.setData(saved);
        setDraft(fromApi(saved));
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <CmsLookupsProvider>
      <div className="space-y-5">
        <PageTitle
          eyebrow={<Link href="/erp/cms" className="hover:underline">CMS · Pages</Link>}
          title={draft.title || "Nouvelle page"}
          subtitle={`${draft.path}${page.data?.revision ? ` · révision ${page.data.revision}` : ""}${page.data?.updated_at ? ` · modifiée ${dateTime(page.data.updated_at)}` : ""}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {pageId ? <StatusBadge status={status} /> : null}
              {page.data?.live ? <Badge tone="success">En ligne</Badge> : null}
              {dirty ? <Badge tone="warning">Modifications non enregistrées</Badge> : null}
              {pageId ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      setPreview(await api<Row>(`/cms/pages/${pageId}/preview`));
                    } catch (err) {
                      toast.error("Aperçu impossible", errorMessage(err));
                    }
                  }}
                >
                  <Eye className="h-4 w-4" /> Aperçu
                </Button>
              ) : null}
              {page.data?.live ? (
                <a href={draft.path} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                  <ExternalLink className="h-3.5 w-3.5" /> Voir en ligne
                </a>
              ) : null}
              {pageId
                ? (CMS_TRANSITIONS[status] ?? [])
                    .filter((t) => can(t.perm))
                    .map((t) => (
                      <Button
                        key={t.target}
                        size="sm"
                        variant={t.target === "published" ? "accent" : "secondary"}
                        disabled={dirty}
                        title={dirty ? "Enregistrez d'abord vos modifications" : undefined}
                        onClick={() => {
                          setNote("");
                          setSchedule({ publish_at: draft.publish_at, unpublish_at: draft.unpublish_at });
                          setTransition(t);
                        }}
                      >
                        {t.label}
                      </Button>
                    ))
                : null}
              {can("cms:write") ? (
                <Button size="sm" loading={busy} disabled={!dirty && !!pageId} onClick={save}>
                  <Save className="h-4 w-4" /> Enregistrer
                </Button>
              ) : null}
            </div>
          }
        />
        {page.data?.seo_issues?.length ? (
          <Alert tone="warning" title="Points SEO à corriger">
            {(page.data.seo_issues as string[]).join(" · ")}
          </Alert>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "contenu", label: "Contenu", count: draft.sections.length },
            { key: "proprietes", label: "Propriétés" },
            { key: "seo", label: "SEO" },
            { key: "historique", label: "Historique", hidden: !pageId },
          ]}
        />
        {tab === "contenu" ? (
          <div className="space-y-4">
            {draft.sections.map((s, i) => (
              <SectionEditor
                key={s.id ?? `new-${i}`}
                section={s}
                index={i}
                count={draft.sections.length}
                onChange={(ns) => update({ sections: draft.sections.map((x, j) => (j === i ? ns : x)) })}
                onRemove={() => update({ sections: draft.sections.filter((_, j) => j !== i) })}
                onMove={(d) => {
                  const next = draft.sections.slice();
                  const [item] = next.splice(i, 1);
                  next.splice(i + d, 0, item);
                  update({ sections: next });
                }}
              />
            ))}
            {!draft.sections.length ? <EmptyState title="Page vide" text="Ajoutez une première section, puis des blocs (bandeau, texte, atouts, appel à l'action…)." /> : null}
            <Button variant="secondary" onClick={() => update({ sections: [...draft.sections, { key: `section-${draft.sections.length + 1}`, title: "", visible: true, settings: {}, blocks: [] }] })}>
              <Plus className="h-4 w-4" /> Ajouter une section
            </Button>
          </div>
        ) : null}
        {tab === "proprietes" ? (
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Titre" required>
              <Input value={draft.title} onChange={(e) => update({ title: e.target.value })} />
            </Field>
            <Field label="Modèle">
              <Select value={draft.template} onChange={(e) => update({ template: e.target.value })} options={[{ value: "default", label: "Standard" }, { value: "landing", label: "Page d'atterrissage" }, { value: "legal", label: "Mentions / juridique" }, { value: "listing", label: "Liste" }]} />
            </Field>
            <Field label="Clé de route" required help="Identifiant stable (ex. accueil, a-propos) utilisé par la navigation.">
              <Input value={draft.route_key} onChange={(e) => update({ route_key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} disabled={!!pageId && status === "published"} />
            </Field>
            <Field label="Chemin public" required help="Commence par /, sans espace. Un changement crée une redirection 301.">
              <Input value={draft.path} onChange={(e) => update({ path: e.target.value })} />
            </Field>
            <Field label="Résumé" className="sm:col-span-2">
              <Textarea value={draft.summary} onChange={(e) => update({ summary: e.target.value })} rows={2} />
            </Field>
            <Field label="Publication programmée">
              <Input type="datetime-local" value={draft.publish_at} onChange={(e) => update({ publish_at: e.target.value })} />
            </Field>
            <Field label="Dépublication programmée">
              <Input type="datetime-local" value={draft.unpublish_at} onChange={(e) => update({ unpublish_at: e.target.value })} />
            </Field>
            <Field label="Ordre">
              <Input type="number" value={draft.sort_order} onChange={(e) => update({ sort_order: Number(e.target.value) })} />
            </Field>
            <Field label="Corps libre (modèle « juridique » : mentions légales, confidentialité…)" className="sm:col-span-2">
              <RichTextEditor value={draft.body} onChange={(html) => update({ body: html })} minHeight={220} />
            </Field>
          </Card>
        ) : null}
        {tab === "seo" ? (
          <Card className="p-5">
            <SeoEditor value={draft.seo} onChange={(seo) => update({ seo })} fallbackTitle={draft.title} path={draft.path} />
          </Card>
        ) : null}
        {tab === "historique" && pageId ? (
          <RevisionsPanel
            entityType="page"
            entityId={pageId}
            onRestored={() => {
              setDirty(false);
              void page.reload();
            }}
          />
        ) : null}
        {pageId && can("cms:publish") && status !== "published" ? (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setDeleting(true)}>
              <Trash2 className="h-4 w-4" /> Supprimer la page
            </Button>
          </div>
        ) : null}
      </div>

      <Modal
        open={!!transition}
        onClose={() => setTransition(null)}
        title={transition?.label ?? ""}
        footer={
          <Button
            loading={busy}
            onClick={async () => {
              if (!transition || !pageId) return;
              setBusy(true);
              try {
                const res = await api<Row>(`/cms/pages/${pageId}/transition`, {
                  method: "POST",
                  body: { target: transition.target, note: note || null, publish_at: schedule.publish_at ? new Date(schedule.publish_at).toISOString() : null, unpublish_at: schedule.unpublish_at ? new Date(schedule.unpublish_at).toISOString() : null },
                });
                page.setData(res);
                setDraft(fromApi(res));
                setTransition(null);
                toast.success(transition.label);
              } catch (err) {
                toast.error("Action impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmer
          </Button>
        }
      >
        <div className="space-y-3">
          {transition?.target === "published" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mise en ligne le (facultatif)">
                <Input type="datetime-local" value={schedule.publish_at} onChange={(e) => setSchedule({ ...schedule, publish_at: e.target.value })} />
              </Field>
              <Field label="Retrait le (facultatif)">
                <Input type="datetime-local" value={schedule.unpublish_at} onChange={(e) => setSchedule({ ...schedule, unpublish_at: e.target.value })} />
              </Field>
            </div>
          ) : null}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Note pour l'historique (relecture, motif…)" />
        </div>
      </Modal>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={`Aperçu — ${preview?.title ?? ""}`} size="full">
        {preview ? (
          <div className="overflow-hidden rounded-xl border border-line">
            {((preview.sections ?? []) as Row[]).map((s, i) => (
              <SectionView key={s.key ?? i} section={s as never} index={i} embedded />
            ))}
            {!(preview.sections ?? []).length && preview.body ? <div className="prose max-w-none p-8" dangerouslySetInnerHTML={{ __html: preview.body }} /> : null}
          </div>
        ) : null}
      </Modal>
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Supprimer la page"
        text="Suppression définitive de la page (une révision est conservée dans l'historique)."
        tone="danger"
        onConfirm={async () => {
          await api(`/cms/pages/${pageId}`, { method: "DELETE" });
          router.push("/erp/cms");
        }}
      />
    </CmsLookupsProvider>
  );
}

export function PagesList() {
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const pages = useApi<Row[]>("/cms/pages", { status: status || undefined });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "", label: "Tous les statuts" }, ...["draft", "in_review", "validated", "published", "archived"].map((s) => ({ value: s, label: optionLabel(s) }))]} aria-label="Statut" />
        {can("cms:write") ? (
          <Link href="/erp/cms/pages/nouvelle" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
            <Plus className="h-4 w-4" /> Nouvelle page
          </Link>
        ) : null}
      </div>
      <Card>
        {pages.loading && !pages.data ? (
          <Skeleton className="m-4 h-40" />
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2">Page</th>
                <th className="px-4 py-2">Chemin</th>
                <th className="px-4 py-2">Modèle</th>
                <th className="px-4 py-2">SEO</th>
                <th className="px-4 py-2">Mise à jour</th>
                <th className="px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(pages.data ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/erp/cms/pages/${p.id}`} className="font-medium text-brand-700 hover:underline">
                      {p.title}
                    </Link>
                    <span className="block text-xs text-muted">{p.route_key}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{p.path}</td>
                  <td className="px-4 py-2">{optionLabel(p.template)}</td>
                  <td className="px-4 py-2">{(p.seo_issues ?? []).length ? <Badge tone="warning">{p.seo_issues.length} point(s)</Badge> : <Badge tone="success">OK</Badge>}</td>
                  <td className="px-4 py-2 text-xs text-muted">{dateTime(p.updated_at)}</td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1">
                      <StatusBadge status={p.status} />
                      {p.live ? <Badge tone="success">En ligne</Badge> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!pages.loading && !pages.data?.length ? (
          <div className="p-6">
            <EmptyState title="Aucune page" text="Toutes les pages publiques (accueil, à propos, contact…) sont pilotées ici : aucun contenu éditorial n'est codé en dur." />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
