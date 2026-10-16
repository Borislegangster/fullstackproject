"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Bell, Bot, CheckCircle2, Eye, Inbox, ListPlus, Mail, MessageCircle, Newspaper, Plus, ShieldCheck, Trash2, Wrench } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";

import { CmsForm } from "@/components/site/cms-form";
import { Field, Input, Select, Switch, TagInput, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import type { FormDefinitionPayload } from "@/lib/cms-types";
import { useApi } from "@/lib/hooks";

type Row = Record<string, any>;

interface FormFieldDef {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

interface ConsentDef {
  key: string;
  label: string;
  required?: boolean;
}

/* ----------------------------------------------------------------------------- briques communes */

function Section({ step, title, text, children }: { step: number; title: string; text?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white">{step}</span>
        <div>
          <h3 className="font-semibold text-ink">{title}</h3>
          {text ? <p className="text-sm text-muted">{text}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Rôles internes à cocher (annuaire public des rôles, sans permission particulière). */
export function RolePicker({ value, onChange }: { value: string[]; onChange: (codes: string[]) => void }) {
  const roles = useApi<{ code: string; name: string; description?: string | null }[]>("/directory/roles");
  if (roles.loading && !roles.data) return <Skeleton className="h-20 w-full" />;
  if (!roles.data?.length) return <Alert tone="warning">Annuaire des rôles indisponible.</Alert>;
  return (
    <div className="flex flex-wrap gap-2">
      {roles.data.map((r) => {
        const on = value.includes(r.code);
        return (
          <button
            key={r.code}
            type="button"
            title={r.description ?? undefined}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((c) => c !== r.code) : [...value, r.code])}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition",
              on ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-line hover:bg-brand-50 hover:ring-brand-300",
            )}
          >
            {on ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4 text-muted" />} {r.name}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------- formulaires */

const FORM_KEYS = [
  { value: "contact", label: "Contact (page Contact)" },
  { value: "callback", label: "Être rappelé" },
  { value: "describe_project", label: "Décrire mon projet (assistant guidé)" },
  { value: "estimator", label: "Estimateur" },
  { value: "newsletter", label: "Newsletter" },
];

const FIELD_TYPES = [
  { value: "text", label: "Texte court" },
  { value: "textarea", label: "Texte long (message)" },
  { value: "email", label: "Adresse e-mail" },
  { value: "tel", label: "Téléphone" },
  { value: "number", label: "Nombre" },
  { value: "date", label: "Date" },
  { value: "select", label: "Liste de choix" },
];

/** Champs prêts à l'emploi : leur identifiant alimente automatiquement la fiche du lead CRM. */
const FIELD_PRESETS: { label: string; field: FormFieldDef }[] = [
  { label: "Prénom", field: { name: "first_name", label: "Prénom", type: "text", required: true } },
  { label: "Nom", field: { name: "last_name", label: "Nom", type: "text", required: true } },
  { label: "E-mail", field: { name: "email", label: "E-mail", type: "email", required: true } },
  { label: "Téléphone", field: { name: "phone", label: "Téléphone", type: "tel" } },
  { label: "WhatsApp", field: { name: "whatsapp", label: "Numéro WhatsApp", type: "tel" } },
  { label: "Entreprise", field: { name: "company", label: "Entreprise", type: "text" } },
  { label: "Ville", field: { name: "city", label: "Ville", type: "text" } },
  { label: "Pays", field: { name: "country", label: "Pays de résidence", type: "text" } },
  { label: "Lieu du projet", field: { name: "project_location", label: "Lieu du projet", type: "text" } },
  { label: "Budget", field: { name: "budget_max", label: "Budget estimé (FCFA)", type: "number" } },
  { label: "Délai", field: { name: "timeline", label: "Délai souhaité", type: "select", options: ["Moins de 3 mois", "3 à 6 mois", "6 à 12 mois", "Plus d'un an"] } },
  { label: "Message", field: { name: "message", label: "Votre message", type: "textarea", required: true } },
];

const CONSENT_PRESETS: ConsentDef[] = [
  { key: "contact", label: "J'accepte d'être recontacté(e) par GLOBUS ENGINEERING au sujet de ma demande.", required: true },
  { key: "whatsapp", label: "J'accepte d'être contacté(e) sur WhatsApp.", required: false },
  { key: "marketing", label: "Je souhaite recevoir la newsletter (conseils et actualités, désinscription en un clic).", required: false },
];
const CONSENT_NAMES: Record<string, string> = { contact: "Être recontacté", whatsapp: "Contact WhatsApp", marketing: "Newsletter" };

const DESTINATIONS = [
  { value: "crm_lead", label: "Créer un prospect dans le CRM", text: "Recommandé pour les demandes de contact et de projet : un commercial est affecté et relancé.", icon: Inbox },
  { value: "newsletter", label: "Inscrire à la newsletter", text: "L'adresse e-mail rejoint la liste de diffusion (double confirmation).", icon: Newspaper },
  { value: "ticket", label: "Ouvrir une demande SAV", text: "Pour les formulaires de réclamation ou d'assistance.", icon: Wrench },
  { value: "none", label: "Simple archivage", text: "L'envoi est conservé dans « Envois reçus », sans autre traitement.", icon: Mail },
];

function slugify(label: string): string {
  return (
    label
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "champ"
  );
}

function uniqueName(name: string, fields: FormFieldDef[], index = -1): string {
  let candidate = name;
  let n = 2;
  while (fields.some((f, i) => i !== index && f.name === candidate)) candidate = `${name}_${n++}`;
  return candidate;
}

function FieldsBuilder({ value, onChange }: { value: FormFieldDef[]; onChange: (v: FormFieldDef[]) => void }) {
  const add = (field: FormFieldDef) => {
    const name = uniqueName(field.name || slugify(field.label), value);
    onChange([...value, { ...field, name }]);
  };
  const update = (i: number, patch: Partial<FormFieldDef>) => {
    const next = value.map((f, j) => (j === i ? { ...f, ...patch } : f));
    onChange(next);
  };
  const move = (i: number, d: number) => {
    const next = [...value];
    const [item] = next.splice(i, 1);
    next.splice(i + d, 0, item);
    onChange(next);
  };
  const used = new Set(value.map((f) => f.name));
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Ajouter un champ en un clic</p>
        <div className="flex flex-wrap gap-1.5">
          {FIELD_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={!!p.field.name && used.has(p.field.name)}
              onClick={() => add(p.field)}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> {p.label}
            </button>
          ))}
          <button type="button" onClick={() => add({ name: "", label: "Nouveau champ", type: "text" })} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-medium text-ink ring-1 ring-line hover:bg-slate-50">
            <ListPlus className="h-3.5 w-3.5" /> Champ personnalisé
          </button>
        </div>
      </div>
      {!value.length ? <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">Aucun champ : ajoutez-en avec les boutons ci-dessus.</p> : null}
      <ol className="space-y-3">
        {value.map((f, i) => (
          <li key={i} className="rounded-xl bg-surface p-4 ring-1 ring-line">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-xs font-bold text-brand-700 ring-1 ring-line">{i + 1}</span>
              <span className="flex-1 truncate font-medium text-ink">{f.label || "Sans libellé"}</span>
              <Switch checked={!!f.required} onChange={(on) => update(i, { required: on })} label="Obligatoire" />
              <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1.5 text-muted hover:bg-white disabled:opacity-30">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Descendre" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="rounded p-1.5 text-muted hover:bg-white disabled:opacity-30">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Retirer le champ" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded p-1.5 text-muted hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Question affichée">
                <Input value={f.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Ex. Votre ville" />
              </Field>
              <Field label="Type de réponse">
                <Select value={f.type} onChange={(e) => update(i, { type: e.target.value })} options={FIELD_TYPES} />
              </Field>
              <Field label="Exemple affiché dans le champ (facultatif)" className={f.type === "select" ? undefined : "sm:col-span-2"}>
                <Input value={f.placeholder ?? ""} onChange={(e) => update(i, { placeholder: e.target.value })} placeholder="Ex. Douala" />
              </Field>
              {f.type === "select" ? (
                <Field label="Choix proposés" help="Tapez un choix puis Entrée.">
                  <TagInput value={f.options ?? []} onChange={(options) => update(i, { options })} />
                </Field>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Identifiant : <code className="rounded bg-white px-1">{f.name || "automatique"}</code>
              {FIELD_PRESETS.some((p) => p.field.name === f.name) ? " · enregistré automatiquement dans la fiche du prospect" : " · conservé dans le détail de l'envoi"}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ConsentsBuilder({ value, onChange }: { value: ConsentDef[]; onChange: (v: ConsentDef[]) => void }) {
  return (
    <div className="space-y-3">
      {CONSENT_PRESETS.map((preset) => {
        const current = value.find((c) => c.key === preset.key);
        const set = (patch: Partial<ConsentDef>) => onChange(value.map((c) => (c.key === preset.key ? { ...c, ...patch } : c)));
        return (
          <div key={preset.key} className={clsx("rounded-xl p-4 ring-1 transition", current ? "bg-emerald-50/60 ring-emerald-200" : "bg-white ring-line")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Switch
                checked={!!current}
                onChange={(on) => onChange(on ? [...value, { ...preset }] : value.filter((c) => c.key !== preset.key))}
                label={CONSENT_NAMES[preset.key]}
              />
              {current ? <Switch checked={!!current.required} onChange={(on) => set({ required: on })} label="Case obligatoire pour envoyer" /> : null}
            </div>
            {current ? (
              <Field label="Texte de la case à cocher" className="mt-3">
                <Input value={current.label} onChange={(e) => set({ label: e.target.value })} />
              </Field>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function FormDefinitionEditor({ initial, onClose, onSaved }: { initial: Row | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const editing = !!initial?.id;
  const replies = useApi<{ items: Row[] }>("/cms/auto-replies", { page_size: 100 });
  const [draft, setDraft] = useState<Row>(() => ({
    key: initial?.key ?? "contact",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    fields: (initial?.fields as FormFieldDef[]) ?? FIELD_PRESETS.filter((p) => ["first_name", "email", "phone", "message"].includes(p.field.name)).map((p) => p.field),
    consents: (initial?.consents as ConsentDef[]) ?? [CONSENT_PRESETS[0]],
    destination: initial?.destination ?? "crm_lead",
    auto_reply_code: initial?.auto_reply_code ?? "",
    success_message: initial?.success_message ?? "",
    notify_roles: (initial?.notify_roles as string[]) ?? ["COMMERCIAL"],
    min_fill_seconds: initial?.min_fill_seconds ?? 3,
    is_active: initial?.is_active ?? true,
  }));
  const [customKey, setCustomKey] = useState(() => !!initial?.key && !FORM_KEYS.some((k) => k.value === initial.key));
  const [busy, setBusy] = useState(false);
  const set = (patch: Row) => setDraft((d) => ({ ...d, ...patch }));
  const codes = useMemo(() => Array.from(new Set((replies.data?.items ?? []).map((r) => String(r.code)))), [replies.data]);
  const preview: FormDefinitionPayload = {
    key: `apercu-${draft.key}`,
    title: draft.title || "Titre du formulaire",
    description: draft.description,
    fields: draft.fields,
    consents: draft.consents,
    success_message: draft.success_message,
    min_fill_seconds: draft.min_fill_seconds,
  } as FormDefinitionPayload;
  const problems = [
    !draft.title.trim() ? "Donnez un titre au formulaire." : null,
    !draft.fields.length ? "Ajoutez au moins un champ." : null,
    draft.fields.some((f: FormFieldDef) => !f.label.trim()) ? "Chaque champ doit avoir une question affichée." : null,
    draft.destination === "crm_lead" && !draft.fields.some((f: FormFieldDef) => ["email", "phone", "whatsapp"].includes(f.name))
      ? "Pour créer un prospect, prévoyez au moins un champ E-mail, Téléphone ou WhatsApp."
      : null,
    draft.destination === "newsletter" && !draft.fields.some((f: FormFieldDef) => f.name === "email") ? "L'inscription à la newsletter nécessite le champ E-mail." : null,
  ].filter(Boolean) as string[];

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...draft, fields: draft.fields.map((f: FormFieldDef, i: number) => ({ ...f, name: f.name || uniqueName(slugify(f.label), draft.fields, i) })), auto_reply_code: draft.auto_reply_code || null, success_message: draft.success_message || null, description: draft.description || null };
      if (editing) await api(`/cms/forms/${initial!.id}`, { method: "PATCH", body });
      else await api("/cms/forms", { body });
      toast.success(editing ? "Formulaire enregistré" : "Formulaire créé");
      onSaved();
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Modifier le formulaire « ${initial?.title ?? ""} »` : "Nouveau formulaire"}
      size="full"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Switch checked={!!draft.is_active} onChange={(on) => set({ is_active: on })} label={draft.is_active ? "Formulaire en ligne" : "Formulaire désactivé"} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={() => void save()} loading={busy} disabled={problems.length > 0}>
              {editing ? "Enregistrer" : "Créer le formulaire"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-5">
          <Section step={1} title="Identité" text="Où le formulaire est utilisé et ce que le visiteur lit en premier.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Emplacement sur le site" help="Les blocs « Formulaire » des pages appellent ce formulaire par son emplacement.">
                {customKey ? (
                  <Input value={draft.key} onChange={(e) => set({ key: slugify(e.target.value).replace(/_/g, "-") })} placeholder="ex. devis-toiture" disabled={editing} />
                ) : (
                  <Select value={draft.key} disabled={editing} onChange={(e) => (e.target.value === "__custom" ? (setCustomKey(true), set({ key: "" })) : set({ key: e.target.value }))} options={[...FORM_KEYS, { value: "__custom", label: "Autre emplacement…" }]} />
                )}
              </Field>
              <Field label="Titre affiché" required>
                <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex. Parlons de votre projet" />
              </Field>
              <Field label="Phrase d'introduction (facultatif)" className="sm:col-span-2">
                <Textarea rows={2} value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="Ex. Réponse sous 24 h ouvrées, sans engagement." />
              </Field>
            </div>
          </Section>

          <Section step={2} title="Questions posées" text="Ajoutez les champs, réglez leur ordre et indiquez ceux qui sont obligatoires.">
            <FieldsBuilder value={draft.fields} onChange={(fields) => set({ fields })} />
          </Section>

          <Section step={3} title="Consentements (RGPD)" text="Cases à cocher affichées sous le formulaire ; chaque accord est horodaté et conservé.">
            <ConsentsBuilder value={draft.consents} onChange={(consents) => set({ consents })} />
          </Section>

          <Section step={4} title="Après l'envoi" text="Ce qui se passe quand le visiteur valide le formulaire.">
            <div className="space-y-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {DESTINATIONS.map((d) => {
                  const Icon = d.icon;
                  const on = draft.destination === d.value;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => set({ destination: d.value })}
                      aria-pressed={on}
                      className={clsx("flex gap-3 rounded-xl p-3 text-left ring-1 transition", on ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white ring-line hover:bg-slate-50")}
                    >
                      <Icon className={clsx("mt-0.5 h-5 w-5 shrink-0", on ? "text-brand-600" : "text-muted")} />
                      <span>
                        <span className="block text-sm font-semibold text-ink">{d.label}</span>
                        <span className="block text-xs text-muted">{d.text}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <Field label="Message affiché après l'envoi" help="Laissez vide pour le message standard « Merci, votre demande est bien reçue ».">
                <Input value={draft.success_message ?? ""} onChange={(e) => set({ success_message: e.target.value })} placeholder="Merci ! Un conseiller vous recontacte sous 24 h ouvrées." />
              </Field>
              <Field label="Accusé de réception envoyé au visiteur" help="Modèles gérés plus bas dans « Réponses automatiques ».">
                <Select
                  value={draft.auto_reply_code ?? ""}
                  onChange={(e) => set({ auto_reply_code: e.target.value })}
                  options={[{ value: "", label: "Message standard GLOBUS" }, ...codes.map((c) => ({ value: c, label: c }))]}
                />
              </Field>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink">
                  <Bell className="h-4 w-4 text-accent-500" /> Qui est prévenu à chaque envoi ?
                </p>
                <p className="mb-2 text-xs text-muted">Cliquez les équipes à notifier (dans l'application et selon leurs préférences e-mail / WhatsApp).</p>
                <RolePicker value={draft.notify_roles ?? []} onChange={(notify_roles) => set({ notify_roles })} />
              </div>
            </div>
          </Section>

          <Section step={5} title="Protection anti-robot" text="Un envoi plus rapide que ce délai est considéré comme automatique et ignoré.">
            <div className="flex items-center gap-4">
              <input type="range" min={0} max={15} value={draft.min_fill_seconds} onChange={(e) => set({ min_fill_seconds: Number(e.target.value) })} className="w-64 accent-brand-500" aria-label="Délai minimum" />
              <Badge tone="info">
                <ShieldCheck className="h-3.5 w-3.5" /> {draft.min_fill_seconds} s minimum
              </Badge>
            </div>
          </Section>
        </div>

        <aside className="space-y-3 xl:sticky xl:top-0 xl:self-start">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Eye className="h-4 w-4 text-brand-500" /> Aperçu en direct
          </p>
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <CmsForm formKey={preview.key} initial={preview} preview />
          </div>
          {problems.length ? (
            <Alert tone="warning" title="À compléter avant d'enregistrer">
              <ul className="list-disc pl-4">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert tone="success">Formulaire prêt à être enregistré.</Alert>
          )}
        </aside>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------------------- réponses automatiques */

/** Variables réellement fournies par le moteur d'accusés de réception (prospect créé depuis un formulaire). */
const VARIABLES = [
  { key: "first_name", label: "Prénom du visiteur", sample: "Arnaud" },
  { key: "number", label: "Numéro de la demande", sample: "LEAD-2026-00042" },
  { key: "sla_text", label: "Délai de réponse", sample: "sous 1 heure ouvrée" },
  { key: "universe", label: "Univers choisi", sample: "HOME" },
];

/** Texte stocké ({{first_name}}) ⇄ texte lisible ([Prénom du visiteur]) dans l'éditeur. */
function toReadable(text: string): string {
  return VARIABLES.reduce((acc, v) => acc.replaceAll(`{{${v.key}}}`, `[${v.label}]`).replaceAll(`{{ ${v.key} }}`, `[${v.label}]`), text);
}
function toStored(text: string): string {
  return VARIABLES.reduce((acc, v) => acc.replaceAll(`[${v.label}]`, `{{${v.key}}}`), text);
}
function fill(text: string): string {
  return VARIABLES.reduce((acc, v) => acc.replaceAll(`[${v.label}]`, v.sample), toReadable(text));
}

function VariableTextarea({ value, onChange, rows = 7, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (key: string) => {
    const el = ref.current;
    const token = `[${VARIABLES.find((v) => v.key === key)?.label ?? key}]`;
    if (!el) return onChange(`${value}${token}`);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Insérer :</span>
        {VARIABLES.map((v) => (
          <button key={v.key} type="button" onClick={() => insert(v.key)} className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 ring-1 ring-accent-200 hover:bg-accent-100">
            <Plus className="h-3 w-3" /> {v.label}
          </button>
        ))}
      </div>
      <Textarea ref={ref} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function AutoReplyEditor({ initial, onClose, onSaved }: { initial: Row | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const editing = !!initial?.id;
  const [draft, setDraft] = useState<Row>(() => ({
    code: initial?.code ?? "",
    channel: initial?.channel ?? "email",
    subject: toReadable(initial?.subject ?? "Nous avons bien reçu votre demande"),
    body: toReadable(initial?.body ?? "Bonjour {{first_name}},\n\nMerci pour votre demande n° {{number}}. Un conseiller GLOBUS ENGINEERING vous répond {{sla_text}}.\n\nÀ très bientôt,\nL'équipe GLOBUS ENGINEERING"),
    whatsapp_template: initial?.whatsapp_template ?? "",
    is_active: initial?.is_active ?? true,
  }));
  const [busy, setBusy] = useState(false);
  const set = (patch: Row) => setDraft((d) => ({ ...d, ...patch }));
  const email = draft.channel === "email";
  const valid = draft.code.trim().length >= 2 && draft.body.trim().length >= 5 && (email || draft.whatsapp_template.trim());
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...draft, body: toStored(draft.body), subject: email ? toStored(draft.subject ?? "") || null : null, whatsapp_template: email ? null : draft.whatsapp_template || null };
      if (editing) await api(`/cms/auto-replies/${initial!.id}`, { method: "PATCH", body });
      else await api("/cms/auto-replies", { body });
      toast.success("Réponse automatique enregistrée");
      onSaved();
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Modifier la réponse « ${initial?.code ?? ""} »` : "Nouvelle réponse automatique"}
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Switch checked={!!draft.is_active} onChange={(on) => set({ is_active: on })} label={draft.is_active ? "Active" : "Désactivée"} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={() => void save()} loading={busy} disabled={!valid}>
              Enregistrer
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Section step={1} title="Identification" text="Le nom permet de la choisir dans un formulaire (« Accusé de réception envoyé au visiteur »).">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de la réponse" required help="Ex. contact-standard, devis-diaspora">
                <Input value={draft.code} onChange={(e) => set({ code: slugify(e.target.value).replace(/_/g, "-") })} disabled={editing} placeholder="contact-standard" />
              </Field>
              <Field label="Envoyée par">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "email", label: "E-mail", icon: Mail },
                    { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
                  ].map((c) => {
                    const Icon = c.icon;
                    const on = draft.channel === c.value;
                    return (
                      <button key={c.value} type="button" aria-pressed={on} onClick={() => set({ channel: c.value })} className={clsx("flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold ring-1", on ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-line hover:bg-slate-50")}>
                        <Icon className="h-4 w-4" /> {c.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </Section>
          <Section step={2} title="Message" text="Cliquez un élément « Insérer » pour l'ajouter à l'endroit du curseur : les mentions entre crochets, comme [Prénom du visiteur], sont remplacées par la vraie valeur pour chaque visiteur.">
            <div className="space-y-4">
              {email ? (
                <Field label="Objet de l'e-mail">
                  <Input value={draft.subject ?? ""} onChange={(e) => set({ subject: e.target.value })} />
                </Field>
              ) : (
                <Field label="Modèle WhatsApp approuvé par Meta" required help="Nom exact du modèle validé dans votre compte WhatsApp Business (WhatsApp impose des modèles pré-approuvés pour écrire en premier).">
                  <Input value={draft.whatsapp_template ?? ""} onChange={(e) => set({ whatsapp_template: e.target.value })} placeholder="accuse_reception_v1" />
                </Field>
              )}
              <Field label={email ? "Texte de l'e-mail" : "Texte de référence (aperçu interne)"} required>
                <VariableTextarea value={draft.body} onChange={(body) => set({ body })} />
              </Field>
            </div>
          </Section>
        </div>
        <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Eye className="h-4 w-4 text-brand-500" /> Ce que reçoit le visiteur
          </p>
          {email ? (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
              <div className="border-b border-line bg-surface px-4 py-2.5 text-xs text-muted">
                <p>
                  <span className="font-semibold text-ink">De :</span> GLOBUS ENGINEERING
                </p>
                <p>
                  <span className="font-semibold text-ink">Objet :</span> {fill(draft.subject ?? "") || "—"}
                </p>
              </div>
              <p className="whitespace-pre-line px-4 py-4 text-sm leading-relaxed text-ink">{fill(draft.body) || "…"}</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#e5ddd5] p-4">
              <p className="ml-auto max-w-[90%] whitespace-pre-line rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3 py-2 text-sm text-ink shadow-sm">{fill(draft.body) || "…"}</p>
            </div>
          )}
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <Bot className="h-3.5 w-3.5 shrink-0" /> Aperçu avec des valeurs d'exemple ({VARIABLES.map((v) => v.sample).join(", ")}).
          </p>
        </aside>
      </div>
    </Modal>
  );
}
