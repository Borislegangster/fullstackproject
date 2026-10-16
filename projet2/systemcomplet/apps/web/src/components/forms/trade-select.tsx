"use client";

import clsx from "clsx";

import { controlClass } from "@/components/ui/form";
import { optionLabel, PERSON_TRADES } from "@/lib/labels";

import type { FieldConfig } from "./schema-form";

const PERSON_TRADE_CODES = new Set(PERSON_TRADES.flatMap((g) => g.codes));

/** Métier d'une personne (salarié, utilisateur, équipe) : liste fermée groupée par famille. Un code déjà enregistré hors
 * référentiel reste affiché et conservé tant qu'il n'est pas remplacé. */
export function PersonTradeSelect({ value, onChange, invalid, placeholder = "Non précisé" }: { value: unknown; onChange: (code: string) => void; invalid?: boolean; placeholder?: string }) {
  const selected = typeof value === "string" ? value : "";
  return (
    <select aria-label="Métier" className={clsx(controlClass, "pr-8")} aria-invalid={invalid || undefined} value={selected} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {PERSON_TRADES.map((g) => (
        <optgroup key={g.family} label={g.family}>
          {g.codes.map((code) => (
            <option key={code} value={code}>
              {optionLabel(code)}
            </option>
          ))}
        </optgroup>
      ))}
      {selected && !PERSON_TRADE_CODES.has(selected) ? (
        <optgroup label="Métier déjà enregistré">
          <option value={selected}>{optionLabel(selected)}</option>
        </optgroup>
      ) : null}
    </select>
  );
}

/** Champ « Métier » des formulaires (salariés, utilisateurs, équipes). */
export const personTradeField: FieldConfig = {
  label: "Métier",
  render: ({ value, onChange, invalid }) => <PersonTradeSelect value={value} onChange={onChange} invalid={invalid} />,
};
