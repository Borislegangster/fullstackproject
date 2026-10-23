"use client";

import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { api, errorMessage, fieldErrors } from "@/lib/api";
import { toInputDate, toInputDateTime } from "@/lib/format";
import { fieldLabel, optionLabel } from "@/lib/labels";
import { FIELD_REFS, LIST_REFS, REFS, type RefSource } from "@/lib/refs";
import { BODIES, SCHEMAS, type FieldDef } from "@/generated/schemas";
import { Checkbox, Field, FileDrop, Input, Select, TagInput, Textarea, type Option } from "@/components/ui/form";
import { Alert, Button } from "@/components/ui/primitives";

import { DisciplineSelect } from "./discipline-picker";
import { MultiRefSelect, RefSelect } from "./ref-select";

export interface FieldConfig {
  label?: string;
  help?: ReactNode;
  hidden?: boolean;
  readOnly?: boolean;
  widget?: "textarea" | "password" | "color" | "json" | "tags" | "checkboxes" | "select";
  ref?: RefSource | keyof typeof REFS | null;
  options?: Option[];
  span?: 1 | 2;
  placeholder?: string;
  /** Sous-champs visibles d'une liste d'objets (éditeur de lignes). */
  columns?: string[];
  fields?: Record<string, FieldConfig>;
  /** Rendu personnalisé du contrôle. */
  render?: (props: { value: any; onChange: (v: any) => void; values: Record<string, any>; invalid: boolean }) => ReactNode;
  /** Champ conditionnel (ex. motif de perte seulement pour le statut « Perdu ») : masqué, non validé et non envoyé tant
   * que la condition est fausse. */
  visibleIf?: (values: Record<string, any>) => boolean;
  /** Obligatoire selon les autres valeurs (en plus des champs obligatoires du schéma). */
  requiredIf?: (values: Record<string, any>) => boolean;
}

/** Champ masqué par sa condition d'affichage. */
function conditionallyHidden(cfg: FieldConfig | undefined, values: Record<string, any>): boolean {
  return !!cfg?.visibleIf && !cfg.visibleIf(values);
}

type Values = Record<string, any>;

/** Devises proposées pour tout champ « currency » des formulaires générés. */
const CURRENCIES: Option[] = [
  { value: "XAF", label: "FCFA (XAF)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "USD", label: "Dollar US (USD)" },
];

function refFor(name: string, cfg?: FieldConfig): RefSource | null {
  if (cfg?.ref === null) return null;
  if (cfg?.ref) return typeof cfg.ref === "string" ? REFS[cfg.ref] : cfg.ref;
  const key = FIELD_REFS[name];
  return key ? REFS[key] : null;
}

function listRefFor(name: string, cfg?: FieldConfig): RefSource | null {
  if (cfg?.ref === null) return null;
  if (cfg?.ref) return typeof cfg.ref === "string" ? REFS[cfg.ref] : cfg.ref;
  const key = LIST_REFS[name];
  return key ? REFS[key] : null;
}

function initialValue(def: FieldDef, raw: any): any {
  const value = raw !== undefined ? raw : def.default;
  switch (def.kind) {
    case "boolean":
      return value === undefined || value === null ? false : Boolean(value);
    case "list":
      if (def.itemKind === "json" || def.itemKind === "object") return Array.isArray(value) && value.length ? JSON.stringify(value, null, 2) : "";
      return Array.isArray(value) ? value : [];
    case "files":
      return [];
    case "file":
      return null;
    case "objects": {
      const rows = Array.isArray(value) ? value : [];
      if (!rows.length && (def.minItems ?? 0) > 0 && def.ref) return [emptyRow(def.ref)];
      return rows.map((r: any) => ({ ...r }));
    }
    case "object":
      return value && typeof value === "object" ? { ...value } : null;
    case "json":
      return value === undefined || value === null ? "" : typeof value === "string" ? value : JSON.stringify(value, null, 2);
    case "date":
      return value ? toInputDate(value) : "";
    case "datetime":
      return value ? toInputDateTime(value) : "";
    case "time":
      return value ? String(value).slice(0, 5) : "";
    default:
      return value === undefined || value === null ? "" : String(value);
  }
}

export function emptyRow(schema: string, init: Values = {}): Values {
  const out: Values = {};
  (SCHEMAS[schema] ?? []).forEach((f) => {
    out[f.name] = initialValue(f, init[f.name]);
  });
  return out;
}

export function initialValues(schema: string, initial: Values = {}): Values {
  return emptyRow(schema, initial);
}

function isEmpty(v: any): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Conversion des valeurs de formulaire vers le contrat JSON de l'API. */
export function toPayload(schema: string, values: Values, opts: { partial?: boolean; initial?: Values; keep?: string[] } = {}): Values {
  const out: Values = {};
  for (const def of SCHEMAS[schema] ?? []) {
    if (!(def.name in values)) continue;
    const v = values[def.name];
    let converted: any;
    switch (def.kind) {
      case "boolean":
        converted = Boolean(v);
        break;
      case "integer":
        converted = v === "" || v === null || v === undefined ? null : parseInt(String(v), 10);
        break;
      case "number":
        converted = v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", "."));
        break;
      case "datetime":
        converted = v ? new Date(v).toISOString() : null;
        break;
      case "objects":
        converted = (Array.isArray(v) ? v : []).map((row: Values) => (def.ref ? toPayload(def.ref, row) : row));
        break;
      case "object":
        converted = v && def.ref ? toPayload(def.ref, v) : v || null;
        break;
      case "json":
        if (typeof v === "string") {
          converted = v.trim() ? JSON.parse(v) : null;
        } else converted = v ?? null;
        break;
      case "list":
        if (typeof v === "string") converted = v.trim() ? JSON.parse(v) : [];
        else converted = Array.isArray(v) ? v : [];
        break;
      case "file":
      case "files":
        continue;
      default:
        converted = v === "" ? null : v;
    }
    if (converted === null || converted === undefined) {
      if (def.required) converted = def.kind === "string" || def.kind === "text" ? "" : null;
      else if (!def.nullable && !opts.partial) continue;
    }
    if (opts.partial && opts.initial) {
      const before = initialValue(def, opts.initial[def.name]);
      if (JSON.stringify(before) === JSON.stringify(v) && !opts.keep?.includes(def.name)) continue;
    }
    if (converted === null && !def.nullable && !def.required) continue;
    out[def.name] = converted;
  }
  return out;
}

export function toFormData(schema: string, values: Values): FormData {
  const form = new FormData();
  for (const def of SCHEMAS[schema] ?? []) {
    const v = values[def.name];
    if (def.kind === "file") {
      if (v instanceof File) form.append(def.name, v);
      continue;
    }
    if (def.kind === "files") {
      (Array.isArray(v) ? v : []).forEach((f: File) => form.append(def.name, f));
      continue;
    }
    if (isEmpty(v)) continue;
    if (Array.isArray(v)) v.forEach((x) => form.append(def.name, typeof x === "object" ? JSON.stringify(x) : String(x)));
    else if (def.kind === "datetime") form.append(def.name, new Date(v).toISOString());
    else if (typeof v === "boolean") form.append(def.name, v ? "true" : "false");
    else if (typeof v === "object") form.append(def.name, JSON.stringify(v));
    else form.append(def.name, String(v));
  }
  return form;
}

function validate(schema: string, values: Values, configs: Record<string, FieldConfig>, prefix = ""): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const def of SCHEMAS[schema] ?? []) {
    const cfg = configs[def.name];
    if (cfg?.hidden || !(def.name in values) || conditionallyHidden(cfg, values)) continue;
    const v = values[def.name];
    const key = prefix + def.name;
    if (def.kind === "boolean") continue;
    if ((def.required || cfg?.requiredIf?.(values)) && isEmpty(v) && def.kind !== "objects") {
      errors[key] = "Champ obligatoire";
      continue;
    }
    if (typeof v === "string" && v) {
      if (def.maxLength && v.length > def.maxLength) errors[key] = `${def.maxLength} caractères maximum`;
      if (def.minLength && v.trim().length < def.minLength) errors[key] = `${def.minLength} caractères minimum`;
      if ((def.kind === "number" || def.kind === "integer") && Number.isNaN(Number(v.replace(",", ".")))) errors[key] = "Nombre attendu";
      if ((def.kind === "number" || def.kind === "integer") && def.min !== undefined && Number(v) < def.min) errors[key] = `Minimum : ${def.min}`;
      if ((def.kind === "number" || def.kind === "integer") && def.max !== undefined && Number(v) > def.max) errors[key] = `Maximum : ${def.max}`;
      if (def.kind === "json" || (def.kind === "list" && typeof v === "string")) {
        try {
          const parsed = JSON.parse(v);
          if (def.kind === "list" && !Array.isArray(parsed)) errors[key] = "Liste JSON attendue ([ … ])";
        } catch {
          errors[key] = "JSON invalide";
        }
      }
    }
    if (def.kind === "objects") {
      const rows = Array.isArray(v) ? v : [];
      if ((def.minItems ?? 0) > rows.length) errors[key] = `Au moins ${def.minItems} ligne(s) requise(s)`;
      if (def.ref)
        rows.forEach((row: Values, i: number) => Object.assign(errors, validate(def.ref!, row, cfg?.fields ?? {}, `${key}.${i}.`)));
    }
    if (def.kind === "list" && (def.minItems ?? 0) > (Array.isArray(v) ? v.length : 0)) errors[key] = `Au moins ${def.minItems} élément(s)`;
  }
  return errors;
}

/** Étiquettes d'un champ JSON « liste de libellés » : tableau, ou texte JSON hérité de l'initialisation. */
function jsonTags(value: any): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function Control({
  def,
  cfg,
  value,
  onChange,
  values,
  invalid,
  id,
  compact,
}: {
  def: FieldDef;
  cfg?: FieldConfig;
  value: any;
  onChange: (v: any) => void;
  values: Values;
  invalid: boolean;
  id: string;
  compact?: boolean;
}) {
  if (cfg?.render) return <>{cfg.render({ value, onChange, values, invalid })}</>;
  const disabled = cfg?.readOnly;
  // Champs « code » reconnus à leur nom : jamais de saisie libre (devise, couleur, discipline).
  if (def.kind === "string" && !cfg?.options && !cfg?.widget) {
    if (def.name === "currency") cfg = { ...cfg, options: CURRENCIES };
    else if (/(^|_)color(_hex)?$/.test(def.name)) cfg = { ...cfg, widget: "color" };
    else if (/^discipline(_a|_b)?$/.test(def.name)) return <DisciplineSelect id={id} value={value} onChange={onChange} invalid={invalid} />;
  }
  if (cfg?.options || def.kind === "enum") {
    const options = cfg?.options ?? (def.options ?? []).map((o) => ({ value: o, label: optionLabel(o) }));
    return (
      <Select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        options={options}
        placeholder={def.required && value ? undefined : compact ? "—" : "Choisir…"}
      />
    );
  }
  switch (def.kind) {
    case "uuid": {
      const source = refFor(def.name, cfg);
      if (source)
        return <RefSelect id={id} source={source} value={value || null} onChange={(v) => onChange(v ?? "")} context={values} disabled={disabled} invalid={invalid} />;
      return <Input id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} invalid={invalid} placeholder="Identifiant" />;
    }
    case "boolean":
      return <Checkbox id={id} label={compact ? "" : cfg?.label ?? fieldLabel(def.name)} checked={!!value} onChange={onChange} disabled={disabled} />;
    case "integer":
    case "number":
      return (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={def.kind === "integer" ? 1 : "any"}
          min={def.min}
          max={def.max}
          value={value ?? ""}
          disabled={disabled}
          invalid={invalid}
          placeholder={cfg?.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return <Input id={id} type="date" value={value ?? ""} disabled={disabled} invalid={invalid} onChange={(e) => onChange(e.target.value)} />;
    case "datetime":
      return <Input id={id} type="datetime-local" value={value ?? ""} disabled={disabled} invalid={invalid} onChange={(e) => onChange(e.target.value)} />;
    case "time":
      return <Input id={id} type="time" value={value ?? ""} disabled={disabled} invalid={invalid} onChange={(e) => onChange(e.target.value)} />;
    case "text":
      return <Textarea id={id} value={value ?? ""} disabled={disabled} invalid={invalid} rows={compact ? 2 : 4} maxLength={def.maxLength} placeholder={cfg?.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "json":
      if (cfg?.widget === "tags") return <TagInput id={id} value={jsonTags(value)} onChange={onChange} />;
      return (
        <Textarea
          id={id}
          value={value ?? ""}
          disabled={disabled}
          invalid={invalid}
          rows={6}
          className="font-mono text-xs"
          placeholder={cfg?.placeholder ?? "{ }"}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "list": {
      if (def.itemKind === "json" || def.itemKind === "object")
        return (
          <Textarea
            id={id}
            value={typeof value === "string" ? value : JSON.stringify(value ?? [], null, 2)}
            disabled={disabled}
            invalid={invalid}
            rows={5}
            className="font-mono text-xs"
            placeholder={cfg?.placeholder ?? '[{ "label": "…", "amount": 0 }]'}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      const source = def.itemKind === "uuid" ? listRefFor(def.name, cfg) : null;
      if (source) return <MultiRefSelect source={source} value={Array.isArray(value) ? value : []} onChange={onChange} context={values} disabled={disabled} />;
      if (def.itemOptions?.length || cfg?.widget === "checkboxes") {
        const opts = cfg?.options ?? (def.itemOptions ?? []).map((o) => ({ value: o, label: optionLabel(o) }));
        const current: string[] = Array.isArray(value) ? value : [];
        return (
          <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-line bg-white px-3 py-2">
            {opts.map((o) => (
              <Checkbox
                key={o.value}
                label={o.label}
                checked={current.includes(o.value)}
                onChange={(on) => onChange(on ? [...current, o.value] : current.filter((x) => x !== o.value))}
              />
            ))}
          </div>
        );
      }
      return <TagInput value={Array.isArray(value) ? value.map(String) : []} onChange={onChange} />;
    }
    case "objects":
      return def.ref ? <LinesEditor schema={def.ref} rows={Array.isArray(value) ? value : []} onChange={onChange} cfg={cfg} parent={values} /> : null;
    case "object":
      return def.ref ? (
        <div className="rounded-xl border border-line bg-slate-50/60 p-3">
          <FieldsGrid schema={def.ref} values={value ?? emptyRow(def.ref)} onChange={(v) => onChange(v)} configs={cfg?.fields ?? {}} errors={{}} prefix={`${def.name}.`} />
        </div>
      ) : null;
    case "file":
      return <FileDrop files={value ? [value] : []} onChange={(files) => onChange(files[0] ?? null)} />;
    case "files":
      return <FileDrop files={Array.isArray(value) ? value : []} onChange={onChange} multiple />;
    default:
      return (
        <Input
          id={id}
          type={def.kind === "email" ? "email" : cfg?.widget === "password" ? "password" : cfg?.widget === "color" ? "color" : "text"}
          value={value ?? ""}
          disabled={disabled}
          invalid={invalid}
          maxLength={def.maxLength}
          placeholder={cfg?.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function LinesEditor({ schema, rows, onChange, cfg, parent }: { schema: string; rows: Values[]; onChange: (rows: Values[]) => void; cfg?: FieldConfig; parent: Values }) {
  const defs = (SCHEMAS[schema] ?? []).filter((d) => (cfg?.columns ? cfg.columns.includes(d.name) : !cfg?.fields?.[d.name]?.hidden));
  const ordered = cfg?.columns ? cfg.columns.map((c) => defs.find((d) => d.name === c)).filter(Boolean) as FieldDef[] : defs;
  const update = (i: number, name: string, v: any) => onChange(rows.map((r, j) => (j === i ? { ...r, [name]: v } : r)));
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {ordered.map((d) => (
                <th key={d.name} className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-muted">
                  {cfg?.fields?.[d.name]?.label ?? fieldLabel(d.name)}
                  {d.required ? <span className="text-red-600">*</span> : null}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {rows.map((row, i) => (
              <tr key={i}>
                {ordered.map((d) => (
                  <td key={d.name} className={clsx("px-2 py-1.5 align-top", d.kind === "text" || d.kind === "string" ? "min-w-[12rem]" : "min-w-[8rem]")}>
                    <Control
                      def={d}
                      cfg={cfg?.fields?.[d.name]}
                      value={row[d.name]}
                      onChange={(v) => update(i, d.name, v)}
                      values={{ ...parent, ...row }}
                      invalid={false}
                      id={`${schema}-${i}-${d.name}`}
                      compact
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 align-top">
                  <button type="button" className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Supprimer la ligne">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...rows, emptyRow(schema)])}>
        <Plus className="h-4 w-4" /> Ajouter une ligne
      </Button>
    </div>
  );
}

const WIDE = new Set(["text", "objects", "object", "json", "files", "file", "list"]);

export function FieldsGrid({
  schema,
  values,
  onChange,
  configs,
  errors,
  prefix = "",
  order,
  only,
  exclude,
  columns = 2,
}: {
  schema: string;
  values: Values;
  onChange: (values: Values) => void;
  configs: Record<string, FieldConfig>;
  errors: Record<string, string>;
  prefix?: string;
  order?: string[];
  only?: string[];
  exclude?: string[];
  columns?: 1 | 2;
}) {
  const defs = useMemo(() => {
    let list = SCHEMAS[schema] ?? [];
    if (only) list = only.map((n) => list.find((d) => d.name === n)).filter(Boolean) as FieldDef[];
    if (exclude) list = list.filter((d) => !exclude.includes(d.name));
    list = list.filter((d) => !configs[d.name]?.hidden);
    if (order) {
      const rank = (n: string) => {
        const i = order.indexOf(n);
        return i === -1 ? order.length : i;
      };
      list = [...list].sort((a, b) => rank(a.name) - rank(b.name));
    }
    return list;
  }, [schema, only, exclude, order, configs]);
  return (
    <div className={clsx("grid gap-4", columns === 2 && "sm:grid-cols-2")}>
      {defs.map((def) => {
        const cfg = configs[def.name];
        if (conditionallyHidden(cfg, values)) return null;
        const key = prefix + def.name;
        const span = cfg?.span ?? (WIDE.has(def.kind) ? 2 : 1);
        const error = errors[key];
        return (
          <Field
            key={def.name}
            label={def.kind === "boolean" ? undefined : cfg?.label ?? fieldLabel(def.name)}
            required={(def.required || !!cfg?.requiredIf?.(values)) && def.kind !== "boolean"}
            help={cfg?.help ?? def.help}
            error={error}
            htmlFor={`f-${key}`}
            className={clsx(span === 2 && columns === 2 && "sm:col-span-2")}
          >
            <Control
              def={def}
              cfg={cfg}
              value={values[def.name]}
              onChange={(v) => onChange({ ...values, [def.name]: v })}
              values={values}
              invalid={!!error}
              id={`f-${key}`}
            />
          </Field>
        );
      })}
    </div>
  );
}

export interface SchemaFormProps {
  /** Nom du schéma généré (ex. "PRIn"). Déduit de `endpoint` si absent. */
  schema?: string;
  /** Clé d'endpoint telle que dans BODIES, ex. "POST /procurement/requests/{request_id}/decision". */
  endpoint?: string;
  /** Valeurs des paramètres de chemin de l'endpoint. */
  params?: Record<string, string>;
  initial?: Values;
  fields?: Record<string, FieldConfig>;
  order?: string[];
  only?: string[];
  exclude?: string[];
  /** Valeurs imposées (non affichées) ajoutées à la charge utile. */
  fixed?: Values;
  partial?: boolean;
  idempotent?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  onSubmit?: (payload: Values | FormData) => Promise<unknown>;
  onSuccess?: (result: any) => void;
  columns?: 1 | 2;
  footer?: ReactNode;
  transform?: (payload: Values) => Values;
}

/** Formulaire généré depuis le schéma OpenAPI : validation, références, lignes, fichiers, erreurs serveur. */
export function SchemaForm({
  schema: schemaProp,
  endpoint,
  params = {},
  initial,
  fields = {},
  order,
  only,
  exclude,
  fixed,
  partial,
  idempotent,
  submitLabel = "Enregistrer",
  cancelLabel = "Annuler",
  onCancel,
  onSubmit,
  onSuccess,
  columns = 2,
  footer,
  transform,
}: SchemaFormProps) {
  const body = endpoint ? BODIES[endpoint] : undefined;
  const schema = schemaProp ?? body?.schema ?? "";
  const multipart = body?.type === "multipart";
  const configs = useMemo(() => {
    const out: Record<string, FieldConfig> = { ...fields };
    Object.keys(fixed ?? {}).forEach((k) => {
      out[k] = { ...(out[k] ?? {}), hidden: true };
    });
    return out;
  }, [fields, fixed]);
  const [values, setValues] = useState<Values>(() => {
    const seed = { ...(initial ?? {}), ...(fixed ?? {}) };
    const out = initialValues(schema, seed);
    // Champ JSON doté d'un éditeur dédié (grille, blocs, règles…) : l'éditeur reçoit la valeur structurée
    // (tableau / objet), jamais sa sérialisation texte destinée au champ JSON brut.
    for (const def of SCHEMAS[schema] ?? []) {
      const structured = def.kind === "json" || (def.kind === "list" && (def.itemKind === "json" || def.itemKind === "object"));
      if (structured && (configs[def.name]?.render || configs[def.name]?.widget === "tags")) out[def.name] = seed[def.name] ?? null;
    }
    return out;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!SCHEMAS[schema]) {
    return <Alert tone="danger">Formulaire indisponible (schéma « {schema || endpoint} » inconnu).</Alert>;
  }

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    const v = { ...values, ...(fixed ?? {}) };
    // Champs masqués par leur condition : ni validés ni envoyés.
    Object.entries(configs).forEach(([name, cfg]) => {
      if (conditionallyHidden(cfg, v)) delete v[name];
    });
    const errs = validate(schema, v, configs);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("Vérifiez les champs signalés.");
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      let payload: Values | FormData;
      if (multipart) payload = toFormData(schema, v);
      else {
        const json = toPayload(schema, v, { partial, initial, keep: Object.keys(fixed ?? {}) });
        payload = transform ? transform(json) : json;
      }
      let result: unknown;
      if (onSubmit) result = await onSubmit(payload);
      else if (endpoint) {
        const [method, template] = endpoint.split(" ");
        // Paramètres de chemin : valeurs explicites, sinon valeurs imposées (ex. project_id fixé par l'écran parent).
        const path = template.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(String(params[k] ?? fixed?.[k] ?? "")));
        result = await api(path, {
          method: method as "POST" | "PUT" | "PATCH",
          ...(multipart ? { form: payload as FormData } : { body: payload }),
          idempotent,
        });
      }
      onSuccess?.(result);
    } catch (err) {
      const fe = fieldErrors(err);
      if (fe.length) {
        const mapped: Record<string, string> = {};
        fe.forEach((f) => {
          mapped[f.field] = f.message;
        });
        setErrors(mapped);
      }
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handle} noValidate className="space-y-5">
      <FieldsGrid schema={schema} values={values} onChange={setValues} configs={configs} errors={errors} order={order} only={only} exclude={exclude} columns={columns} />
      {formError ? (
        <Alert tone="danger" title="Enregistrement impossible">
          {formError}
        </Alert>
      ) : null}
      {footer}
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
