"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { BarChartCard, DonutChart, LineChartCard } from "@/components/ui/charts";
import { Input, Select } from "@/components/ui/form";
import { Tabs } from "@/components/ui/overlay";
import { Alert, Button, Card, CardHeader, EmptyState, PageTitle, Skeleton, Stat } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

type Row = Record<string, any>;
const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Année en cours" },
  { value: "12m", label: "12 mois" },
  { value: "custom", label: "Personnalisée" },
];

function delta(current?: number, previous?: number): string | undefined {
  if (previous === undefined || previous === null) return undefined;
  if (!previous) return current ? "nouveau" : undefined;
  const pct = ((toNumber(current) - previous) * 100) / previous;
  return `${pct >= 0 ? "+" : ""}${number(pct, 1)} % vs période précédente`;
}

function Breakdown({ title, rows, limit = 10 }: { title: string; rows?: Row[]; limit?: number }) {
  const total = (rows ?? []).reduce((s, r) => s + toNumber(r.sessions), 0);
  return (
    <Card>
      <CardHeader title={title} />
      <ul className="divide-y divide-line text-sm">
        {(rows ?? []).slice(0, limit).map((r) => (
          <li key={String(r.value)} className="px-4 py-2">
            <div className="flex justify-between gap-2">
              <span className="truncate">{r.value ? optionLabel(r.value) : "(direct / inconnu)"}</span>
              <span className="tabular-nums">
                {number(r.sessions)} <span className="text-xs text-muted">· {number(r.conversions)} conv.</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${total ? (toNumber(r.sessions) * 100) / total : 0}%` }} />
            </div>
          </li>
        ))}
        {!(rows ?? []).length ? <li className="px-4 py-3 text-muted">Pas de données.</li> : null}
      </ul>
    </Card>
  );
}

export function TrafficOverview() {
  const toast = useToast();
  const [period, setPeriod] = useState("30d");
  const [range, setRange] = useState({ start: "", end: "" });
  const [granularity, setGranularity] = useState("day");
  const overview = useApi<Row>("/analytics/overview", { period, granularity, start: period === "custom" ? range.start || undefined : undefined, end: period === "custom" ? range.end || undefined : undefined });
  const o = overview.data;
  const t = (o?.totals ?? {}) as Row;
  const p = (o?.previous ?? {}) as Row;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} options={PERIODS} aria-label="Période" />
        {period === "custom" ? (
          <>
            <Input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} aria-label="Début" />
            <Input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} aria-label="Fin" />
          </>
        ) : null}
        <Select value={granularity} onChange={(e) => setGranularity(e.target.value)} options={[{ value: "day", label: "Par jour" }, { value: "week", label: "Par semaine" }, { value: "month", label: "Par mois" }]} aria-label="Granularité" />
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await api("/analytics/aggregate", { method: "POST" });
              void overview.reload();
            } catch (err) {
              toast.error("Actualisation impossible", errorMessage(err));
            }
          }}
        >
          <RefreshCw className="h-4 w-4" /> Actualiser
        </Button>
      </div>
      {overview.loading && !o ? (
        <Skeleton className="h-72" />
      ) : overview.error ? (
        <Alert tone="danger">{overview.error}</Alert>
      ) : o ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Sessions" value={number(t.sessions)} hint={delta(t.sessions, p.sessions)} tone="info" />
            <Stat label="Visiteurs" value={number(t.visitors)} hint={`${number(t.new_visitors)} nouveaux · ${number(t.returning_visitors)} récurrents`} />
            <Stat label="Pages vues" value={number(t.page_views)} hint={`${number(t.pages_per_session, 2)} / session · rebond ${number(t.bounce_rate, 1)} %`} />
            <Stat label="Durée moyenne" value={`${Math.floor(toNumber(t.avg_duration_s) / 60)} min ${Math.round(toNumber(t.avg_duration_s) % 60)} s`} />
            <Stat label="Conversions" value={number(t.conversions)} hint={`Taux ${number(t.conversion_rate, 2)} % · ${delta(t.conversions, p.conversions) ?? ""}`} tone="success" />
          </div>
          <Card>
            <CardHeader title="Audience et conversions" subtitle="Mesure propriétaire respectueuse du consentement (sans cookie tiers)." />
            <div className="p-4">
              <LineChartCard
                data={((o.series ?? []) as Row[]).map((s) => ({ bucket: String(s.bucket).slice(0, 10), sessions: s.sessions, conversions: s.conversions }))}
                x="bucket"
                series={[
                  { key: "sessions", label: "Sessions" },
                  { key: "conversions", label: "Conversions", color: "#FB8C43" },
                ]}
                area
              />
            </div>
          </Card>
          <div className="grid gap-6 lg:grid-cols-3">
            <Breakdown title="Canaux" rows={o.channels} />
            <Breakdown title="Sources (UTM)" rows={o.sources} />
            <Breakdown title="Campagnes" rows={o.campaigns} />
            <Breakdown title="Pages d'entrée" rows={o.landing_pages} />
            <Breakdown title="Pays" rows={o.countries} />
            <Breakdown title="Villes" rows={o.cities} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Appareils" />
              <div className="p-4">
                <DonutChart data={((o.devices ?? []) as Row[]).map((d) => ({ name: optionLabel(d.value), value: toNumber(d.sessions) }))} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Navigateurs" />
              <div className="p-4">
                <DonutChart data={((o.browsers ?? []) as Row[]).map((d) => ({ name: String(d.value ?? "?"), value: toNumber(d.sessions) }))} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Conversions par objectif" />
              <ul className="divide-y divide-line text-sm">
                {((o.conversions ?? []) as Row[]).map((c, i) => (
                  <li key={i} className="flex justify-between gap-2 px-4 py-2">
                    <span>
                      {optionLabel(c.target)} <span className="text-xs text-muted">{optionLabel(c.type)}</span>
                    </span>
                    <span className="tabular-nums">{number(c.count)}</span>
                  </li>
                ))}
                {!(o.conversions ?? []).length ? <li className="px-4 py-3 text-muted">Aucune conversion.</li> : null}
              </ul>
            </Card>
          </div>
          <Card>
            <CardHeader title="Pages" />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Page</th>
                    <th className="px-3 py-2 text-right">Vues</th>
                    <th className="px-3 py-2 text-right">Entrées</th>
                    <th className="px-3 py-2 text-right">Sorties</th>
                    <th className="px-3 py-2 text-right">Temps total</th>
                    <th className="px-3 py-2 text-right">Clics CTA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {((o.pages ?? []) as Row[]).slice(0, 30).map((pg) => (
                    <tr key={pg.path}>
                      <td className="px-3 py-1.5 font-mono text-xs">{pg.path}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{number(pg.views)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{number(pg.entries)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{number(pg.exits)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{Math.round(toNumber(pg.time_s) / 60)} min</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{number(pg.cta_clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Réseaux sociaux (clics sortants)" />
              <div className="p-4">
                <BarChartCard data={((o.social_clicks ?? []) as Row[]).map((s) => ({ network: s.network, clicks: s.clicks }))} x="network" series={[{ key: "clicks", label: "Clics" }]} height={200} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Recherches internes" />
              <ul className="divide-y divide-line text-sm">
                {((o.searches ?? []) as Row[]).slice(0, 15).map((s) => (
                  <li key={s.query} className="flex justify-between gap-2 px-4 py-2">
                    <span className="truncate">« {s.query} »</span>
                    <span className="tabular-nums">{number(s.count)}</span>
                  </li>
                ))}
                {!(o.searches ?? []).length ? <li className="px-4 py-3 text-muted">Aucune recherche.</li> : null}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Qualité technique (p75)" subtitle="Core Web Vitals et erreurs remontées par les navigateurs." />
              <ul className="divide-y divide-line text-sm">
                {((o.technical ?? []) as Row[]).slice(0, 15).map((tch, i) => (
                  <li key={i} className="flex justify-between gap-2 px-4 py-2">
                    <span className="truncate">
                      {optionLabel(tch.kind)} · {tch.key}
                    </span>
                    <span className="tabular-nums">
                      {tch.p75 !== null && tch.p75 !== undefined ? number(tch.p75, 2) : "—"} <span className="text-xs text-muted">({number(tch.count)})</span>
                    </span>
                  </li>
                ))}
                {!(o.technical ?? []).length ? <li className="px-4 py-3 text-muted">Aucune mesure.</li> : null}
              </ul>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function BlogAnalytics() {
  const [period, setPeriod] = useState("30d");
  const rows = useApi<Row[]>("/analytics/blog", { period });
  return (
    <div className="space-y-4">
      <Select value={period} onChange={(e) => setPeriod(e.target.value)} options={PERIODS.filter((p) => p.value !== "custom")} aria-label="Période" />
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Article</th>
                <th className="px-3 py-2 text-right">Vues</th>
                <th className="px-3 py-2 text-right">Lecture moyenne</th>
                <th className="px-3 py-2 text-right">J'aime</th>
                <th className="px-3 py-2 text-right">Commentaires</th>
                <th className="px-3 py-2 text-right">Partages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(rows.data ?? [])
                .slice()
                .sort((a, b) => toNumber(b.views) - toNumber(a.views))
                .map((r) => (
                  <tr key={r.post_id}>
                    <td className="px-3 py-2">{r.title}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(r.views)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(r.avg_read_s)} s</td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(r.likes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(toNumber(r.comments) + toNumber(r.replies))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(r.shares)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!rows.loading && !rows.data?.length ? <div className="p-5"><EmptyState title="Aucun article publié" /></div> : null}
        </div>
      </Card>
    </div>
  );
}

export function Ga4Report() {
  const [dimension, setDimension] = useState("sessionSourceMedium");
  const report = useApi<Row>("/analytics/ga4", { dimensions: dimension, metrics: "sessions,conversions,totalUsers" });
  const rows = ((report.data?.rows ?? []) as Row[]).map((r) => ({
    label: (r.dimensionValues ?? []).map((d: Row) => d.value).join(" / "),
    values: (r.metricValues ?? []).map((m: Row) => toNumber(m.value)),
  }));
  return (
    <div className="space-y-4">
      <Select
        value={dimension}
        onChange={(e) => setDimension(e.target.value)}
        options={[
          { value: "sessionSourceMedium", label: "Source / support" },
          { value: "sessionCampaignName", label: "Campagne" },
          { value: "country", label: "Pays" },
          { value: "deviceCategory", label: "Appareil" },
          { value: "landingPage", label: "Page d'entrée" },
        ]}
        aria-label="Dimension"
      />
      {report.loading && !report.data ? (
        <Skeleton className="h-40" />
      ) : report.error ? (
        <Alert tone="info">Google Analytics 4 non configuré ou indisponible : {report.error}</Alert>
      ) : report.data?.configured === false ? (
        <Alert tone="info">Google Analytics 4 n'est pas configuré : la mesure propriétaire reste la référence.</Alert>
      ) : (
        <Card>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Valeur</th>
                <th className="px-3 py-2 text-right">Sessions</th>
                <th className="px-3 py-2 text-right">Conversions</th>
                <th className="px-3 py-2 text-right">Utilisateurs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5">{r.label}</td>
                  {r.values.map((v: number, k: number) => (
                    <td key={k} className="px-3 py-1.5 text-right tabular-nums">
                      {number(v)}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-muted">
                    Aucune donnée GA4.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export function AnalyticsHub() {
  const [tab, setTab] = useState("trafic");
  return (
    <div className="space-y-5">
      <PageTitle title="Analytics" subtitle="Audience de la vitrine, canaux d'acquisition, conversions (« Décrire mon projet », devis, newsletter), contenus." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "trafic", label: "Trafic et conversions" },
          { key: "blog", label: "Blog" },
          { key: "ga4", label: "Google Analytics 4" },
        ]}
      />
      {tab === "trafic" ? <TrafficOverview /> : null}
      {tab === "blog" ? <BlogAnalytics /> : null}
      {tab === "ga4" ? <Ga4Report /> : null}
    </div>
  );
}
