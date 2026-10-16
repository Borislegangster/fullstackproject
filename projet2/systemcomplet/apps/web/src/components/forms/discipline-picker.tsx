"use client";

import { Checkbox } from "@/components/ui/form";
import { Alert, Skeleton } from "@/components/ui/primitives";
import { useApi } from "@/lib/hooks";

export interface Discipline {
  key: string;
  name: string;
}

/** Noms des disciplines à partir de leurs clés (une clé inconnue de la liste reste affichée telle quelle). */
export function disciplineNames(keys: unknown, list: Discipline[] | undefined): string {
  const values: string[] = Array.isArray(keys) ? keys.map(String) : [];
  return values.map((k) => list?.find((d) => d.key === k)?.name ?? k).join(", ");
}

/** Disciplines BIM cochées dans une liste fermée : référentiel global (`/bim/disciplines`) ou calques d'un projet
 * (`/projects/{id}/bim/disciplines`). Une valeur déjà enregistrée hors liste reste affichée et conservée tant qu'elle
 * n'est pas décochée. */
export function DisciplinesPicker({ path, value, onChange }: { path: string; value: unknown; onChange: (keys: string[]) => void }) {
  const list = useApi<Discipline[]>(path);
  const current: string[] = Array.isArray(value) ? value.map(String) : [];
  if (list.loading && !list.data) return <Skeleton className="h-10" />;
  if (!list.data) return <Alert tone="warning">Liste des disciplines indisponible{list.error ? ` : ${list.error}` : ""}.</Alert>;
  const known = new Set(list.data.map((d) => d.key));
  const options = [...list.data, ...current.filter((k) => !known.has(k)).map((k) => ({ key: k, name: k }))];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-line bg-white px-3 py-2">
      {options.map((d) => (
        <Checkbox key={d.key} label={d.name} checked={current.includes(d.key)} onChange={(on) => onChange(on ? [...current, d.key] : current.filter((x) => x !== d.key))} />
      ))}
    </div>
  );
}
