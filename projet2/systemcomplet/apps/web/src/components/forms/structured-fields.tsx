"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Checkbox, Field, Input, Select, Switch, Textarea, type Option } from "@/components/ui/form";
import { Button } from "@/components/ui/primitives";
import { date } from "@/lib/format";
import { fieldLabel, optionLabel } from "@/lib/labels";

/*
 * Éditeurs visuels des champs structurés (listes de lignes, jours, dates, barèmes, valeurs libres) :
 * l'administrateur ne saisit jamais de JSON, la valeur produite garde exactement le format attendu par l'API.
 */

type Row = Record<string, any>;

/** Champ d'une ligne d'un éditeur de liste. */
export interface RowField {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select";
  options?: Option[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
  /** Occupe toute la largeur de la ligne. */
  wide?: boolean;
  /** Contrôle personnalisé (sélecteur de rôles, de modèle…). */
  render?: (row: Row, set: (patch: Row) => void) => ReactNode;
}

function RowControl({ field, row, set, id, "aria-describedby": describedBy, "aria-label": ariaLabel }: { field: RowField; row: Row; set: (patch: Row) => void; id?: string; "aria-describedby"?: string; "aria-label"?: string }) {
  if (field.render) return <>{field.render(row, set)}</>;
  const value = row[field.key];
  const common = { id, "aria-describedby": describedBy, "aria-label": ariaLabel, placeholder: field.placeholder };
  switch (field.type) {
    case "number":
      return <Input {...common} type="number" inputMode="decimal" value={value ?? ""} min={field.min} max={field.max} step={field.step ?? "any"} onChange={(e) => set({ [field.key]: e.target.value === "" ? null : Number(e.target.value) })} />;
    case "select":
      return <Select {...common} value={value ?? ""} onChange={(e) => set({ [field.key]: e.target.value })} options={field.options ?? []} placeholder="Choisir…" />;
    case "textarea":
      return <Textarea {...common} value={value ?? ""} rows={2} onChange={(e) => set({ [field.key]: e.target.value })} />;
    default:
      return <Input {...common} value={value ?? ""} onChange={(e) => set({ [field.key]: e.target.value })} />;
  }
}

function move<T>(list: T[], i: number, delta: number): T[] {
  const next = list.slice();
  const [item] = next.splice(i, 1);
  next.splice(i + delta, 0, item);
  return next;
}

function RowTools({ index, count, sortable, onMove, onRemove }: { index: number; count: number; sortable: boolean; onMove: (delta: number) => void; onRemove: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {sortable ? (
        <>
          <button type="button" aria-label="Monter" disabled={index === 0} onClick={() => onMove(-1)} className="rounded p-1.5 text-muted hover:bg-white disabled:opacity-30">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Descendre" disabled={index === count - 1} onClick={() => onMove(1)} className="rounded p-1.5 text-muted hover:bg-white disabled:opacity-30">
            <ArrowDown className="h-4 w-4" />
          </button>
        </>
      ) : null}
      <button type="button" aria-label="Retirer" onClick={onRemove} className="rounded p-1.5 text-muted hover:text-red-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </span>
  );
}

/** Liste de lignes structurées (remplace la saisie d'un tableau JSON) : ajout, ordre, suppression. */
export function RowsEditor({
  value,
  onChange,
  fields,
  newRow,
  addLabel,
  itemLabel = "Ligne",
  title,
  max,
  empty = "Aucun élément pour l'instant.",
  sortable = true,
  footer,
}: {
  value: Row[] | null | undefined;
  onChange: (rows: Row[]) => void;
  fields: RowField[];
  newRow: (rows: Row[]) => Row;
  addLabel: string;
  itemLabel?: string;
  /** Titre de la ligne (par défaut « {itemLabel} {n} »). */
  title?: (row: Row, index: number) => ReactNode;
  max?: number;
  empty?: string;
  sortable?: boolean;
  footer?: ReactNode;
}) {
  const rows = Array.isArray(value) ? value : [];
  const set = (i: number, patch: Row) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const tools = (i: number) => <RowTools index={i} count={rows.length} sortable={sortable} onMove={(d) => onChange(move(rows, i, d))} onRemove={() => onChange(rows.filter((_, j) => j !== i))} />;
  // Une seule information par ligne (ex. point de contrôle) : présentation compacte, une ligne par élément.
  const inline = fields.length === 1 && !fields[0].wide;
  const narrow = fields.filter((f) => !f.wide).length;
  const grid = narrow >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : narrow === 3 ? "sm:grid-cols-3" : narrow === 2 ? "sm:grid-cols-2" : "";
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      {!rows.length ? <p className="py-1 text-center text-sm text-muted">{empty}</p> : null}
      <ol className="space-y-2">
        {rows.map((row, i) =>
          inline ? (
            <li key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <RowControl field={fields[0]} row={row} set={(p) => set(i, p)} aria-label={`${fields[0].label} ${i + 1}`} />
              </div>
              {tools(i)}
            </li>
          ) : (
            <li key={i} className="rounded-xl bg-surface p-3 ring-1 ring-line">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-brand-700 ring-1 ring-line">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{title ? title(row, i) : `${itemLabel} ${i + 1}`}</span>
                {tools(i)}
              </div>
              <div className={clsx("grid gap-x-3 gap-y-2", grid)}>
                {fields.map((f) => (
                  <Field key={f.key} label={f.label} help={f.help} className={f.wide ? "col-span-full" : undefined}>
                    <RowControl field={f} row={row} set={(p) => set(i, p)} />
                  </Field>
                ))}
              </div>
            </li>
          ),
        )}
      </ol>
      {footer}
      {max === undefined || rows.length < max ? (
        <Button size="sm" variant="ghost" onClick={() => onChange([...rows, newRow(rows)])}>
          <Plus className="h-4 w-4" /> {addLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** Choix multiples à cocher, avec légende accessible ; une valeur déjà enregistrée hors liste reste affichée. */
export function CheckGroup({ legend, help, options, value, onChange, className }: { legend: ReactNode; help?: ReactNode; options: Option[]; value: unknown; onChange: (v: string[]) => void; className?: string }) {
  const current = Array.isArray(value) ? value.map(String) : [];
  const all = [...options, ...current.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, label: optionLabel(v) }))];
  return (
    <fieldset className={clsx("min-w-0", className)}>
      <legend className="mb-1 block text-sm font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-line bg-white px-3 py-2">
        {all.map((o) => (
          <Checkbox key={o.value} label={o.label} checked={current.includes(o.value)} onChange={(on) => onChange(on ? [...current, o.value] : current.filter((x) => x !== o.value))} />
        ))}
      </div>
      {help ? <p className="mt-1 text-xs text-muted">{help}</p> : null}
    </fieldset>
  );
}

/** Liste de points `[{ label, … }]` (contrôles, vérifications) ; les autres propriétés d'un point sont conservées. */
export function LabelListEditor({ value, onChange, label, placeholder, addLabel, extra = {} }: { value: unknown; onChange: (v: Row[]) => void; label: string; placeholder?: string; addLabel: string; extra?: Row }) {
  // Valeurs héritées saisies en simple texte (["…"]) : converties en points `{ label }`.
  const rows = Array.isArray(value) ? value.map((v) => (v && typeof v === "object" ? (v as Row) : { label: String(v ?? "") })) : [];
  return <RowsEditor value={rows} onChange={onChange} fields={[{ key: "label", label, placeholder }]} newRow={() => ({ label: "", ...extra })} addLabel={addLabel} empty="Aucun point pour l'instant." />;
}

/* ----------------------------------------------------------------------------- jours et dates */

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Jours travaillés, stockés en indices (0 = lundi … 6 = dimanche). */
export function WeekdaysPicker({ value, onChange }: { value: unknown; onChange: (days: number[]) => void }) {
  const days = Array.isArray(value) ? value.map(Number) : [];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Jours travaillés">
      {WEEKDAYS.map((label, d) => {
        const on = days.includes(d);
        return (
          <button
            key={label}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b))}
            className={clsx("rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition", on ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-line hover:bg-brand-50 hover:ring-brand-300")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Liste de dates (jours fériés…), stockées au format AAAA-MM-JJ et triées. */
export function DateListInput({ value, onChange }: { value: unknown; onChange: (dates: string[]) => void }) {
  const dates = Array.isArray(value) ? value.map(String) : [];
  const [next, setNext] = useState("");
  const add = () => {
    if (next && !dates.includes(next)) onChange([...dates, next].sort());
    setNext("");
  };
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <div className="flex flex-wrap gap-1.5">
        {dates.map((d) => (
          <span key={d} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
            {date(d)}
            <button type="button" aria-label={`Retirer le ${date(d)}`} onClick={() => onChange(dates.filter((x) => x !== d))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!dates.length ? <span className="text-sm text-muted">Aucune date.</span> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input type="date" value={next} onChange={(e) => setNext(e.target.value)} aria-label="Date à ajouter" className="max-w-[12rem]" />
        <Button size="sm" variant="secondary" disabled={!next} onClick={add}>
          <Plus className="h-4 w-4" /> Ajouter la date
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------- barèmes et notes */

/** Barème par tranches `[[plafond | null, valeur], …]` : une tranche sans plafond s'applique au-delà. */
export function BracketsEditor({ value, onChange, ceilingLabel = "Jusqu'à (FCFA)", valueLabel }: { value: unknown; onChange: (v: (number | null)[][]) => void; ceilingLabel?: string; valueLabel: string }) {
  const rows: (number | null)[][] = Array.isArray(value) ? value.map((r) => (Array.isArray(r) ? [r[0] ?? null, r[1] ?? 0] : [null, 0])) : [];
  const set = (i: number, col: 0 | 1, text: string) => onChange(rows.map((r, j) => (j === i ? (col === 0 ? [text === "" ? null : Number(text), r[1]] : [r[0], text === "" ? 0 : Number(text)]) : r)));
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <div className="grid grid-cols-[1fr_1fr_2rem] gap-2 text-xs font-semibold text-muted">
        <span>{ceilingLabel}</span>
        <span>{valueLabel}</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_2rem] items-center gap-2">
          <Input type="number" inputMode="decimal" min={0} step="any" value={r[0] ?? ""} placeholder="Au-delà (sans plafond)" aria-label={`${ceilingLabel}, tranche ${i + 1}`} onChange={(e) => set(i, 0, e.target.value)} />
          <Input type="number" inputMode="decimal" min={0} step="any" value={r[1] ?? ""} aria-label={`${valueLabel}, tranche ${i + 1}`} onChange={(e) => set(i, 1, e.target.value)} />
          <button type="button" aria-label="Retirer la tranche" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="rounded p-1.5 text-muted hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <p className="text-xs text-muted">Tranches dans l'ordre croissant ; laissez le plafond vide pour la dernière (au-delà).</p>
      <Button size="sm" variant="ghost" onClick={() => onChange([...rows, [null, 0]])}>
        <Plus className="h-4 w-4" /> Tranche
      </Button>
    </div>
  );
}

/** Notes libres par critère `{ "critère": note }`, saisies ligne par ligne. */
export function ScoresEditor({ value, onChange, max = 100, placeholder = "Ex. Méthodologie" }: { value: unknown; onChange: (v: Record<string, number>) => void; max?: number; placeholder?: string }) {
  // Lignes locales : un critère en cours de saisie (nom vide) ne doit pas disparaître de l'écran.
  const [rows, setRows] = useState<Row[]>(() => Object.entries(value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {}).map(([name, score]) => ({ name, score })));
  const emit = (next: Row[]) => {
    setRows(next);
    onChange(Object.fromEntries(next.filter((r) => String(r.name ?? "").trim()).map((r) => [String(r.name).trim(), r.score ?? 0])));
  };
  return (
    <RowsEditor
      value={rows}
      onChange={emit}
      sortable={false}
      itemLabel="Critère"
      title={(r, i) => r.name || `Critère ${i + 1}`}
      fields={[
        { key: "name", label: "Critère", placeholder },
        { key: "score", label: `Note (0 à ${max})`, type: "number", min: 0, max },
      ]}
      newRow={() => ({ name: "", score: null })}
      addLabel="Critère"
      empty="Aucun critère détaillé."
    />
  );
}

/* ----------------------------------------------------------------------------- valeur libre (paramètres) */

type ValueKind = "text" | "number" | "bool" | "list" | "group" | "empty";

const VALUE_KINDS: Option[] = [
  { value: "text", label: "Texte" },
  { value: "number", label: "Nombre" },
  { value: "bool", label: "Oui / non" },
  { value: "list", label: "Liste" },
  { value: "group", label: "Groupe de réglages" },
  { value: "empty", label: "Vide" },
];

function kindOf(v: unknown): ValueKind {
  if (v === null || v === undefined) return "empty";
  if (Array.isArray(v)) return "list";
  if (typeof v === "object") return "group";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return "number";
  return "text";
}

function convert(v: unknown, kind: ValueKind): unknown {
  switch (kind) {
    case "text":
      return v === null || v === undefined || typeof v === "object" ? "" : String(v);
    case "number": {
      const n = Number(v);
      return typeof v !== "object" && Number.isFinite(n) ? n : 0;
    }
    case "bool":
      return v === true || v === "true" || v === 1;
    case "list":
      return v === null || v === undefined || v === "" ? [] : [v];
    case "group":
      return {};
    default:
      return null;
  }
}

/** Éditeur d'une valeur libre (texte, nombre, oui/non, liste, groupe de réglages imbriqués), sans saisie JSON. */
export function ValueEditor({ value, onChange, depth = 0 }: { value: unknown; onChange: (v: unknown) => void; depth?: number }) {
  const kind = kindOf(value);
  const [newKey, setNewKey] = useState("");
  const group = kind === "group" ? (value as Row) : {};
  const list = kind === "list" ? (value as unknown[]) : [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-48 shrink-0">
          <Select value={kind} onChange={(e) => onChange(convert(value, e.target.value as ValueKind))} options={VALUE_KINDS} aria-label="Type de valeur" />
        </div>
        {kind === "text" ? <Input value={String(value)} onChange={(e) => onChange(e.target.value)} aria-label="Valeur" className="min-w-[12rem] flex-1" /> : null}
        {kind === "number" ? <Input type="number" step="any" value={String(value)} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} aria-label="Valeur" className="max-w-[12rem]" /> : null}
        {kind === "bool" ? <Switch checked={value === true} onChange={onChange} label={value === true ? "Oui" : "Non"} /> : null}
      </div>
      {kind === "list" ? (
        <div className={clsx("space-y-2", depth < 4 && "border-l-2 border-brand-100 pl-3")}>
          {list.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 w-6 shrink-0 text-center text-xs font-semibold text-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <ValueEditor value={item} onChange={(v) => onChange(list.map((x, j) => (j === i ? v : x)))} depth={depth + 1} />
              </div>
              <button type="button" aria-label="Retirer l'élément" onClick={() => onChange(list.filter((_, j) => j !== i))} className="mt-1.5 rounded p-1.5 text-muted hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!list.length ? <p className="text-sm text-muted">Liste vide.</p> : null}
          <Button size="sm" variant="ghost" onClick={() => onChange([...list, list.length ? convert(null, kindOf(list[list.length - 1])) : ""])}>
            <Plus className="h-4 w-4" /> Élément
          </Button>
        </div>
      ) : null}
      {kind === "group" ? (
        <div className={clsx("space-y-3", depth < 4 && "border-l-2 border-brand-100 pl-3")}>
          {Object.entries(group).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface p-3 ring-1 ring-line">
              <div className="mb-2 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {fieldLabel(k)} <code className="ml-1 rounded bg-white px-1 text-[11px] font-normal text-muted">{k}</code>
                </span>
                <button
                  type="button"
                  aria-label={`Retirer le réglage ${k}`}
                  onClick={() => onChange(Object.fromEntries(Object.entries(group).filter(([x]) => x !== k)))}
                  className="rounded p-1.5 text-muted hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <ValueEditor value={v} onChange={(nv) => onChange({ ...group, [k]: nv })} depth={depth + 1} />
            </div>
          ))}
          {!Object.keys(group).length ? <p className="text-sm text-muted">Aucun réglage.</p> : null}
          <div className="flex flex-wrap gap-2">
            <Input value={newKey} onChange={(e) => setNewKey(e.target.value.replace(/[^A-Za-z0-9_.-]/g, "_"))} placeholder="Nom du réglage (ex. delai_jours)" aria-label="Nom du nouveau réglage" className="max-w-[16rem]" />
            <Button
              size="sm"
              variant="secondary"
              disabled={!newKey || newKey in group}
              onClick={() => {
                onChange({ ...group, [newKey]: "" });
                setNewKey("");
              }}
            >
              <Plus className="h-4 w-4" /> Ajouter le réglage
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
