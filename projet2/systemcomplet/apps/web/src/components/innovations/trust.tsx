"use client";

import { Gauge, Info, TrendingDown, TrendingUp } from "lucide-react";

import { Alert, Card, CardHeader, Progress, Skeleton } from "@/components/ui/primitives";
import { date, number } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export interface TrustComponent {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  facts: string[];
  details?: Record<string, unknown>;
}

export interface TrustPayload {
  project_id: string;
  score: number | null;
  level: "excellent" | "bon" | "vigilance" | "critique" | "indisponible";
  as_of: string;
  trend_7d: number | null;
  components: TrustComponent[];
  history: { as_of: string; score: string | number | null }[];
  method: string[];
}

const LEVELS: Record<TrustPayload["level"], { label: string; color: string; tone: "success" | "brand" | "accent" | "danger" }> = {
  excellent: { label: "Excellent", color: "#16a34a", tone: "success" },
  bon: { label: "Bon", color: "#385AA6", tone: "brand" },
  vigilance: { label: "Vigilance", color: "#FB8C43", tone: "accent" },
  critique: { label: "Critique", color: "#dc2626", tone: "danger" },
  indisponible: { label: "En cours de calcul", color: "#94a3b8", tone: "brand" },
};

function levelOf(score: number | null): TrustPayload["level"] {
  if (score === null) return "indisponible";
  if (score >= 85) return "excellent";
  if (score >= 70) return "bon";
  if (score >= 50) return "vigilance";
  return "critique";
}

/** Jauge semi-circulaire (0 → 100) : arc coloré selon le niveau, aiguille, score au centre. */
export function TrustGauge({ score, level, size = 220 }: { score: number | null; level: TrustPayload["level"]; size?: number }) {
  const value = Math.max(0, Math.min(100, score ?? 0));
  const r = 80;
  const cx = 100;
  const cy = 100;
  const angle = Math.PI * (1 - value / 100);
  const x = cx + r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  const color = LEVELS[level].color;
  return (
    <svg viewBox="0 0 200 120" width={size} height={(size * 120) / 200} role="img" aria-label={`Indice de confiance ${score ?? "indisponible"} sur 100`}>
      <defs>
        <linearGradient id="trust-track" x1="0" x2="1">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.18" />
          <stop offset="50%" stopColor="#FB8C43" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#16a34a" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="url(#trust-track)" strokeWidth="16" strokeLinecap="round" />
      {score !== null ? <path d={arc} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" className="transition-all duration-700" /> : null}
      <circle cx={x} cy={y} r="7" fill="white" stroke={color} strokeWidth="4" />
      <text x={cx} y={cy - 12} textAnchor="middle" className="fill-ink font-title" fontSize="38" fontWeight="800">
        {score === null ? "—" : Math.round(value)}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill={color} fontSize="13" fontWeight="700">
        {LEVELS[level].label}
      </text>
    </svg>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 220;
  const h = 44;
  const step = w / (points.length - 1);
  const path = points.map((p, i) => `${i ? "L" : "M"} ${(i * step).toFixed(1)} ${(h - (p / 100) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="#385AA6" opacity="0.08" />
      <path d={path} fill="none" stroke="#385AA6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Indice de confiance d'un chantier : `/client/projects/{id}/trust` (client) ou `/projects/{id}/trust` (équipe). */
export function TrustCard({ path, internal = false }: { path: string; internal?: boolean }) {
  const { data, loading, error } = useApi<TrustPayload>(path);
  if (loading && !data) return <Skeleton className="h-72 w-full" />;
  if (error || !data) return <Alert tone="danger">{error ?? "Indice indisponible"}</Alert>;
  const score = data.score === null ? null : Number(data.score);
  const level = data.level ?? levelOf(score);
  const history = data.history.map((h) => Number(h.score ?? 0)).filter((v) => Number.isFinite(v));
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-brand-600" /> Indice de confiance
          </span>
        }
        subtitle={`Calculé le ${date(data.as_of)} à partir des données réelles du chantier`}
      />
      <div className="grid gap-6 p-5 md:grid-cols-[260px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-slate-50 to-white p-3">
          <TrustGauge score={score} level={level} />
          {data.trend_7d !== null ? (
            <p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.trend_7d >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {data.trend_7d >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {data.trend_7d >= 0 ? "+" : ""}
              {number(data.trend_7d, 1)} pt sur 7 jours
            </p>
          ) : null}
          {history.length > 1 ? (
            <div className="mt-3 w-full">
              <Sparkline points={history} />
              <p className="text-center text-[11px] text-muted">Évolution sur {history.length} relevés</p>
            </div>
          ) : null}
        </div>
        <ul className="space-y-4">
          {data.components.map((c) => (
            <li key={c.key}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-ink">
                  {c.label} <span className="text-xs font-normal text-muted">({c.weight} %)</span>
                </span>
                <span className="tabular-nums font-semibold text-ink">{c.score === null ? "—" : `${Math.round(c.score)}/100`}</span>
              </div>
              <Progress value={c.score ?? 0} tone={c.score === null ? "brand" : LEVELS[levelOf(c.score)].tone} className="mt-1.5" />
              {c.facts.length ? (
                <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                  {c.facts.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-xs text-muted">Pas encore assez de données pour ce critère.</p>
              )}
              {internal && c.details && Object.keys(c.details).length ? (
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  {Object.entries(c.details)
                    .map(([k, v]) => `${k}=${typeof v === "number" ? number(v, 2) : String(v)}`)
                    .join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <p className="flex items-start gap-1.5 border-t border-line bg-slate-50/60 px-5 py-3 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Méthode publique : {data.method.join(" · ")}. Un critère sans donnée n'est pas compté.
      </p>
    </Card>
  );
}
