"use client";

import { Check, LineChart, RefreshCw, TrendingDown, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { LineChartCard } from "@/components/ui/charts";
import { Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, money, number } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Family {
  key: string;
  label: string;
  unit: string;
  series: { week: string; median: number; count: number; index: number | null }[];
  current: number | null;
  trend_4w_pct: number | null;
  forecast_4w: number | null;
  forecast_pct: number | null;
  observations: number;
  best_recent: number | null;
}

interface Recommendation {
  id: string;
  label: string;
  unit: string;
  quantity: string;
  current_price: string;
  forecast_price: string;
  trend_pct: string;
  expected_saving: string;
  reason: string;
  status: string;
  projects: { id: string; code: string; name: string }[];
  requests: { id: string; number: string }[];
  stock_items: number;
}

function Trend({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${up ? "text-red-600" : "text-emerald-600"}`}>
      {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      {up ? "+" : ""}
      {number(value, 1)} %
    </span>
  );
}

/** Indice local des prix des matériaux et recommandations d'achat anticipé (A3). */
export function MarketPage() {
  const { can } = useAuth();
  const toast = useToast();
  const index = useApi<Family[]>("/market/index");
  const recs = useApi<Recommendation[]>("/market/recommendations");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissing, setDismissing] = useState<Recommendation | null>(null);
  const [note, setNote] = useState("");
  const families = (index.data ?? []).filter((f) => f.observations > 0);
  const current = families.find((f) => f.key === selected) ?? families[0];
  const refresh = async () => {
    setBusy(true);
    try {
      const r = await api<{ items: number; recommendations: number }>("/market/refresh", { method: "POST" });
      toast.success(`${r.items} nouveau(x) prix collecté(s)`, r.recommendations ? `${r.recommendations} recommandation(s)` : undefined);
      void index.reload();
      void recs.reload();
    } catch (err) {
      toast.error("Actualisation impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const decide = async (rec: Recommendation, action: "accept" | "dismiss", text?: string) => {
    try {
      await api(`/market/recommendations/${rec.id}/${action}`, { body: { note: text ?? null } });
      toast.success(action === "accept" ? "Achat anticipé validé" : "Recommandation écartée");
      void recs.reload();
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    }
  };
  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <LineChart className="h-7 w-7 text-brand-600" /> Indice des prix et achats prédictifs
          </span>
        }
        subtitle="Prix réels des matériaux (catalogues fournisseurs de l'extranet, bons de commande, factures) — tendance, prévision à 4 semaines et achats à anticiper."
        actions={
          can("procurement:approve") ? (
            <Button variant="secondary" loading={busy} onClick={() => void refresh()}>
              <RefreshCw className="h-4 w-4" /> Actualiser
            </Button>
          ) : null
        }
      />
      {recs.data?.length ? (
        <div className="space-y-3">
          {recs.data.map((r) => (
            <Card key={r.id} className="border-l-4 border-l-accent-500 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    Acheter maintenant : {r.label} <Badge tone="accent">+{number(r.trend_pct, 1)} % prévu</Badge>
                  </p>
                  <p className="mt-1 text-sm text-muted">{r.reason}</p>
                  <p className="mt-2 text-xs text-muted">
                    {number(r.quantity)} {r.unit} · prix actuel {money(r.current_price)} → {money(r.forecast_price)} dans 4 semaines
                    {r.projects.length ? ` · chantiers : ${r.projects.map((p) => p.code).join(", ")}` : ""}
                    {r.stock_items ? ` · ${r.stock_items} article(s) sous le seuil de stock` : ""}
                  </p>
                  {r.requests.length ? (
                    <p className="mt-1 text-xs">
                      Demandes à commander :{" "}
                      {r.requests.map((q, i) => (
                        <span key={q.id}>
                          {i ? ", " : ""}
                          <Link href={`/erp/achats/demandes/${q.id}`} className="font-semibold text-brand-600 hover:underline">
                            {q.number}
                          </Link>
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Économie attendue</p>
                  <p className="font-title text-2xl font-bold text-emerald-700">{money(r.expected_saving)}</p>
                  {can("procurement:order") ? (
                    <div className="mt-2 flex justify-end gap-2">
                      <Button size="sm" onClick={() => void decide(r, "accept", "Commande anticipée")}>
                        <Check className="h-4 w-4" /> Anticiper
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDismissing(r)}>
                        <X className="h-4 w-4" /> Écarter
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {index.loading && !index.data ? (
        <Skeleton className="h-96 w-full" />
      ) : families.length ? (
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <Card>
            <ul className="divide-y divide-line">
              {families.map((f) => (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(f.key)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${current?.key === f.key ? "bg-brand-50" : ""}`}
                  >
                    <span>
                      <span className="font-medium text-ink">{f.label}</span>
                      <span className="block text-xs text-muted">
                        {f.current !== null ? `${money(f.current)} / ${f.unit}` : "—"} · {f.observations} prix
                      </span>
                    </span>
                    <Trend value={f.trend_4w_pct} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {current ? (
            <Card>
              <CardHeader
                title={current.label}
                subtitle={`Indice base 100 au ${date(current.series[0]?.week)} · médiane hebdomadaire par ${current.unit}`}
                actions={
                  <div className="text-right text-sm">
                    <p>
                      Prévision 4 sem. : <strong>{current.forecast_4w !== null ? money(current.forecast_4w) : "—"}</strong>
                    </p>
                    <Trend value={current.forecast_pct} />
                  </div>
                }
              />
              <div className="p-4">
                <LineChartCard
                  data={current.series.map((p) => ({ week: date(p.week), prix: p.median, indice: p.index }))}
                  x="week"
                  series={[{ key: "prix", label: `Prix médian (FCFA / ${current.unit})` }]}
                  area
                />
                {current.best_recent !== null ? (
                  <p className="mt-2 text-xs text-muted">Meilleur prix observé sur 60 jours : {money(current.best_recent)} / {current.unit}</p>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={<LineChart className="h-8 w-8" />}
          title="Pas encore de prix observés"
          text="L'indice se construit automatiquement à partir des catalogues fournisseurs, bons de commande et factures (ciment, fer, sable, gravier, parpaings, tôles…)."
        />
      )}
      <Modal
        open={dismissing !== null}
        onClose={() => setDismissing(null)}
        title="Écarter la recommandation"
        footer={
          <Button
            disabled={!note.trim()}
            onClick={async () => {
              if (dismissing) await decide(dismissing, "dismiss", note);
              setDismissing(null);
              setNote("");
            }}
          >
            Écarter
          </Button>
        }
      >
        <Field label="Motif" required>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. stock suffisant, prix négocié sur contrat-cadre…" />
        </Field>
      </Modal>
    </div>
  );
}
