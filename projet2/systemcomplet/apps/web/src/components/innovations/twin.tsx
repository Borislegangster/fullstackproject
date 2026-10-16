"use client";

import { ScanEye, ShieldCheck } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/primitives";
import { dateLong, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export interface TwinResult {
  task_id?: string;
  title: string;
  planned_pct: number;
  declared_pct?: number;
  observed_pct: number | null;
  validated_pct?: number | null;
  confidence?: string;
  evidence?: string;
  gap?: number | null;
  flag?: boolean;
}

export interface TwinObservation {
  id: string;
  zone_id?: string | null;
  observed_on: string;
  overall_observed_pct?: string | null;
  status: string;
  proof_code?: string | null;
  results: TwinResult[];
  summary?: string | null;
  anomalies?: string[];
  decision_note?: string | null;
  decided_at?: string | null;
  created_at?: string;
}

/** Barre double : prévu (repère) et mesuré par l'image. */
export function PlannedVsObserved({ planned, observed }: { planned: number; observed: number | null }) {
  const late = observed !== null && observed + 10 < planned;
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      {observed !== null ? <div className={`h-full rounded-full ${late ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, observed)}%` }} /> : null}
      <span className="absolute top-0 h-full w-0.5 bg-brand-800" style={{ left: `${Math.min(99.5, planned)}%` }} title={`Prévu ${planned} %`} />
    </div>
  );
}

/** Jumeau numérique (I1) côté client : dernières mesures d'avancement validées et certifiées. */
export function ClientTwinCard({ projectId }: { projectId: string }) {
  const { data } = useApi<TwinObservation[]>(`/client/projects/${projectId}/twin`);
  const latest = data?.[0];
  if (!latest) return null;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <ScanEye className="h-5 w-5 text-brand-600" /> Avancement mesuré par l&apos;image
          </span>
        }
        subtitle={`Mesure du ${dateLong(latest.observed_on)} : photos du chantier confrontées au planning, puis validées par votre chef de projet.`}
        actions={
          latest.proof_code ? (
            <a href={`/verification/${latest.proof_code}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
              <ShieldCheck className="h-4 w-4" /> Mesure certifiée
            </a>
          ) : null
        }
      />
      <div className="space-y-3 p-5">
        {latest.overall_observed_pct ? (
          <p className="text-sm">
            Avancement observé global : <strong className="text-lg text-brand-700">{number(toNumber(latest.overall_observed_pct), 0)} %</strong>
          </p>
        ) : null}
        <ul className="space-y-3">
          {latest.results.map((r, i) => (
            <li key={`${r.title}-${i}`} className="text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate">{r.title}</span>
                <span className="shrink-0 text-xs text-muted">
                  {r.observed_pct === null ? "non visible" : `${r.observed_pct} %`} · prévu {number(r.planned_pct, 0)} %
                </span>
              </div>
              <PlannedVsObserved planned={r.planned_pct} observed={r.observed_pct} />
            </li>
          ))}
        </ul>
        {data && data.length > 1 ? <p className="text-xs text-muted">{data.length - 1} mesure(s) précédente(s) conservée(s) et certifiée(s).</p> : null}
      </div>
    </Card>
  );
}
