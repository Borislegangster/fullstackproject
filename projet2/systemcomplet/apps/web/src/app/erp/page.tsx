"use client";

import { AlertTriangle, ArrowRight, Banknote, ClipboardCheck, Construction, Gavel, HardHat, LifeBuoy, ShieldAlert, ShoppingCart, Truck } from "lucide-react";
import Link from "next/link";

import { BarChartCard, DonutChart, LineChartCard } from "@/components/ui/charts";
import { Alert, Card, CardHeader, PageTitle, Progress, Skeleton, Stat } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { dateTime, money, number, percent, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface Dashboard {
  generated_at: string;
  projects: { total: number; active: number; health: Record<string, number>; avg_progress?: number | null };
  planning: { late_milestones: number };
  qhse: { open_serious_incidents: number };
  approvals: { purchase_requests: number; payments: number; situations: number; client_decisions_pending: number; draft_requests: number };
  support: { open_tickets: number; sla_breached: number };
  finance?: {
    portfolio_value: string;
    invoiced: string;
    receivable: string;
    overdue: string;
    payable: string;
    collected_this_month: string;
    cashflow: { series: { month: string; inflow: string; outflow: string; net: string; cumulative: string }[] };
    margins: { project_id: string; code: string; name: string; revenue: string; budget?: string | null; committed: string; spent: string; forecast_cost: string; gross_margin: string; gross_margin_pct?: number | null }[];
  };
}

interface Funnel {
  leads: number;
  quotes_sent: number;
  quotes_accepted: number;
  contracts_signed: number;
  lead_to_contract_rate: number;
  quote_acceptance_rate: number;
  sla_respect_rate?: number | null;
  by_source: { source: string; count: number }[];
  pipeline: { stage: string; count: number; amount: string }[];
}

function ApprovalLink({ href, icon, label, count }: { href: string; icon: React.ReactNode; label: string; count: number }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
      <span className="flex items-center gap-2 text-sm text-ink">
        {icon} {label}
      </span>
      <span className={count ? "rounded-full bg-accent-500 px-2 text-xs font-bold text-white" : "text-xs text-muted"}>{count}</span>
    </Link>
  );
}

/** Tableau de bord Direction (§7.1) : portefeuille, cash, marges, retards, QHSE, approbations, CRM, vitrine. */
export default function ErpDashboardPage() {
  const { can, user } = useAuth();
  const dash = useApi<Dashboard>("/reports/dashboard");
  const funnel = useApi<Funnel>(can("crm:read") ? "/crm/funnel" : null);
  const traffic = useApi<{ totals: { sessions: number; visitors: number; conversions: number; conversion_rate: number }; series: { bucket: string; sessions: number; conversions: number }[]; campaigns: { value: string; sessions: number; conversions: number }[] }>(
    can("analytics:read") ? "/analytics/overview" : null,
    { period: "30d", granularity: "day" },
  );
  const support = useApi<{ satisfaction_avg?: number | null; sla_response_compliance?: number | null }>(can("support:read") ? "/support/statistics" : null, { days: 90 });
  const expected = useApi<{ number: string; purchase_order_id: string; supplier: string; site?: string | null; expected_date?: string | null; eta?: string | null; late: boolean }[]>(can("deliveries:read") ? "/deliveries/expected" : null, { days: 7 });
  const anomalies = useApi<{ total: number }>(can("billing:read") ? "/supplier-invoices" : null, { status: "exception", page_size: 1 });
  const disputes = useApi<{ items: { status: string }[]; total: number }>(can("disputes:read") ? "/disputes" : null, { page_size: 200 });
  const suppliers = useApi<{ items: { id: string; legal_name: string; trade_name?: string | null; quality_score?: string | null; on_time_rate?: string | null }[] }>(can("suppliers:read") ? "/suppliers" : null, { sort: "-quality_score", page_size: 5, status: "active" });
  const subs = useApi<{ items: { id: string; legal_name: string; trade_name?: string | null; score?: string | null; on_time_rate?: string | null }[] }>(can("subcontracting:read") ? "/subcontractors" : null, { sort: "-score", page_size: 5 });

  if (dash.loading) return <Skeleton className="h-[40rem] w-full" />;
  if (!dash.data) return <Alert tone="danger">{dash.error}</Alert>;
  const d = dash.data;
  const f = d.finance;
  const healthData = Object.entries(d.projects.health).map(([k, v]) => ({ name: optionLabel(k), value: v }));
  const totalRevenue = f ? f.margins.reduce((s, m) => s + toNumber(m.revenue), 0) : 0;
  const totalCost = f ? f.margins.reduce((s, m) => s + toNumber(m.forecast_cost), 0) : 0;
  const totalSpent = f ? f.margins.reduce((s, m) => s + toNumber(m.spent), 0) : 0;
  const totalBudget = f ? f.margins.reduce((s, m) => s + toNumber(m.budget), 0) : 0;

  return (
    <div className="space-y-6">
      <PageTitle title={`Bonjour ${user?.first_name ?? ""}`} subtitle={`Synthèse mise à jour le ${dateTime(d.generated_at)}`} eyebrow="Tableau de bord" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Chantiers actifs" value={`${d.projects.active} / ${d.projects.total}`} hint={d.projects.avg_progress !== null && d.projects.avg_progress !== undefined ? `Avancement moyen ${number(d.projects.avg_progress, 1)} %` : undefined} icon={<HardHat className="h-5 w-5" />} tone="info" />
        <Stat label="Jalons en retard" value={d.planning.late_milestones} tone={d.planning.late_milestones ? "danger" : "success"} icon={<AlertTriangle className="h-5 w-5" />} />
        <Stat label="Incidents QHSE graves ouverts" value={d.qhse.open_serious_incidents} tone={d.qhse.open_serious_incidents ? "danger" : "success"} icon={<ShieldAlert className="h-5 w-5" />} />
        <Stat label="Tickets SAV ouverts" value={d.support.open_tickets} hint={d.support.sla_breached ? `${d.support.sla_breached} hors délai` : "Tous dans les délais"} tone={d.support.sla_breached ? "warning" : "neutral"} icon={<LifeBuoy className="h-5 w-5" />} />
      </div>

      {f ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="CA signé (chantiers actifs)" value={money(f.portfolio_value)} icon={<Banknote className="h-5 w-5" />} tone="info" />
            <Stat label="Facturé" value={money(f.invoiced)} hint={`Encaissé ce mois : ${money(f.collected_this_month)}`} />
            <Stat label="Créances à encaisser" value={money(f.receivable)} hint={`dont en retard ${money(f.overdue)}`} tone={toNumber(f.overdue) ? "warning" : "neutral"} />
            <Stat label="Dettes fournisseurs à payer" value={money(f.payable)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Trésorerie prévisionnelle (6 mois)" subtitle="Encaissements attendus, décaissements et solde cumulé" />
              <div className="p-4">
                <LineChartCard
                  data={f.cashflow.series.map((s) => ({ ...s, inflow: toNumber(s.inflow), outflow: toNumber(s.outflow), cumulative: toNumber(s.cumulative) }))}
                  x="month"
                  series={[
                    { key: "inflow", label: "Encaissements", color: "#16a34a" },
                    { key: "outflow", label: "Décaissements", color: "#dc2626" },
                    { key: "cumulative", label: "Solde cumulé", color: "#385AA6" },
                  ]}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Marge et coûts" />
              <div className="space-y-4 p-5 text-sm">
                <div>
                  <p className="text-muted">Marge brute prévisionnelle</p>
                  <p className="font-title text-2xl font-bold text-brand-700">{money(totalRevenue - totalCost)}</p>
                  <p className="text-xs text-muted">{totalRevenue ? percent(((totalRevenue - totalCost) / totalRevenue) * 100, 1) : "—"} du CA</p>
                </div>
                <Progress value={totalBudget ? (totalSpent / totalBudget) * 100 : 0} label="Coût réel / budget" tone={totalSpent > totalBudget && totalBudget ? "danger" : "brand"} />
                <p className="text-xs text-muted">
                  Dépensé {money(totalSpent)} sur un budget de {money(totalBudget)}
                </p>
              </div>
            </Card>
          </div>
          <Card>
            <CardHeader title="Marges par chantier" subtitle="Classées de la plus faible à la plus forte" actions={<Link href="/erp/finances" className="text-sm text-brand-600 hover:underline">Finances</Link>} />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-2">Chantier</th>
                    <th className="px-4 py-2 text-right">CA</th>
                    <th className="px-4 py-2 text-right">Budget</th>
                    <th className="px-4 py-2 text-right">Engagé</th>
                    <th className="px-4 py-2 text-right">Dépensé</th>
                    <th className="px-4 py-2 text-right">Marge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {f.margins.map((m) => (
                    <tr key={m.project_id}>
                      <td className="px-4 py-2">
                        <Link href={`/erp/chantiers/${m.project_id}`} className="font-medium text-brand-600 hover:underline">
                          {m.code}
                        </Link>{" "}
                        {m.name}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(m.revenue)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(m.budget)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(m.committed)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(m.spent)}</td>
                      <td className={`px-4 py-2 text-right font-semibold tabular-nums ${toNumber(m.gross_margin) < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {money(m.gross_margin)} {m.gross_margin_pct !== null && m.gross_margin_pct !== undefined ? `(${number(m.gross_margin_pct, 1)} %)` : ""}
                      </td>
                    </tr>
                  ))}
                  {!f.margins.length ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted">
                        Aucun chantier.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Approbations en attente" />
          <div className="p-2">
            <ApprovalLink href="/erp/achats?onglet=approbations" icon={<ShoppingCart className="h-4 w-4 text-brand-500" />} label="Demandes d'achat à approuver" count={d.approvals.purchase_requests} />
            <ApprovalLink href="/erp/finances?onglet=paiements" icon={<Banknote className="h-4 w-4 text-brand-500" />} label="Paiements à approuver" count={d.approvals.payments} />
            <ApprovalLink href="/erp/situations?statut=field_checked" icon={<ClipboardCheck className="h-4 w-4 text-brand-500" />} label="Situations à valider" count={d.approvals.situations} />
            <ApprovalLink href="/erp/chantiers?onglet=decisions" icon={<Construction className="h-4 w-4 text-brand-500" />} label="Décisions client en attente" count={d.approvals.client_decisions_pending} />
            <ApprovalLink href="/erp/achats?onglet=demandes" icon={<Truck className="h-4 w-4 text-brand-500" />} label="Demandes d'achat soumises" count={d.approvals.draft_requests} />
            <ApprovalLink href="/erp/litiges" icon={<Gavel className="h-4 w-4 text-brand-500" />} label="Litiges" count={0} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Santé des chantiers actifs" />
          <div className="p-4">
            <DonutChart data={healthData} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Satisfaction client" />
          <div className="space-y-4 p-5">
            <div>
              <p className="text-sm text-muted">Note SAV moyenne (90 j)</p>
              <p className="font-title text-3xl font-bold text-brand-700">{support.data?.satisfaction_avg ? `${number(support.data.satisfaction_avg, 2)} / 5` : "—"}</p>
            </div>
            <Progress value={toNumber(support.data?.sla_response_compliance)} label="Respect du délai de réponse SAV" tone="success" />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Livraisons attendues (7 jours)" actions={<Link href="/erp/livraisons" className="text-sm text-brand-600 hover:underline">Livraisons</Link>} />
          <ul className="max-h-72 divide-y divide-line overflow-y-auto text-sm">
            {(expected.data ?? []).map((e) => (
              <li key={e.purchase_order_id} className="flex justify-between gap-2 px-5 py-2.5">
                <span>
                  <Link href={`/erp/achats/commandes/${e.purchase_order_id}`} className="font-medium text-brand-600 hover:underline">
                    {e.number}
                  </Link>
                  <span className="block text-xs text-muted">
                    {e.supplier} {e.site ? `· ${e.site}` : ""}
                  </span>
                </span>
                <span className={e.late ? "text-xs font-semibold text-red-600" : "text-xs text-muted"}>{e.late ? "En retard" : dateTime(e.eta ?? e.expected_date)}</span>
              </li>
            ))}
            {!expected.data?.length ? <li className="px-5 py-4 text-muted">Aucune livraison attendue.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Contrôles" />
          <div className="grid grid-cols-2 gap-3 p-5">
            <Link href="/erp/facturation?onglet=fournisseurs&statut=exception" className="rounded-xl bg-surface p-4 hover:bg-brand-50">
              <p className="text-xs uppercase text-muted">Factures en anomalie</p>
              <p className={`font-title text-2xl font-bold ${anomalies.data?.total ? "text-red-600" : "text-ink"}`}>{anomalies.data?.total ?? "—"}</p>
            </Link>
            <Link href="/erp/litiges" className="rounded-xl bg-surface p-4 hover:bg-brand-50">
              <p className="text-xs uppercase text-muted">Litiges ouverts</p>
              <p className="font-title text-2xl font-bold text-ink">{disputes.data ? disputes.data.items.filter((x) => x.status !== "RESOLU").length : "—"}</p>
            </Link>
          </div>
        </Card>
        <Card>
          <CardHeader title="Performance partenaires" />
          <div className="space-y-3 p-5 text-sm">
            <p className="text-xs font-semibold uppercase text-muted">Fournisseurs (qualité)</p>
            {(suppliers.data?.items ?? []).map((s) => (
              <Progress key={s.id} value={toNumber(s.quality_score)} label={s.trade_name || s.legal_name} tone="success" />
            ))}
            <p className="pt-2 text-xs font-semibold uppercase text-muted">Sous-traitants (score)</p>
            {(subs.data?.items ?? []).map((s) => (
              <Progress key={s.id} value={toNumber(s.score)} label={s.trade_name || s.legal_name} tone="brand" />
            ))}
          </div>
        </Card>
      </div>

      {funnel.data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Entonnoir commercial" actions={<Link href="/erp/crm" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">CRM <ArrowRight className="h-4 w-4" /></Link>} />
            <div className="p-4">
              <BarChartCard
                data={[
                  { step: "Leads", value: funnel.data.leads },
                  { step: "Devis envoyés", value: funnel.data.quotes_sent },
                  { step: "Devis acceptés", value: funnel.data.quotes_accepted },
                  { step: "Contrats signés", value: funnel.data.contracts_signed },
                ]}
                x="step"
                series={[{ key: "value", label: "Nombre" }]}
              />
              <p className="mt-2 text-sm text-muted">
                Conversion lead → contrat : {percent(funnel.data.lead_to_contract_rate, 1)} · acceptation des devis : {percent(funnel.data.quote_acceptance_rate, 1)}
                {funnel.data.sla_respect_rate !== null && funnel.data.sla_respect_rate !== undefined ? ` · SLA de réponse : ${percent(funnel.data.sla_respect_rate, 1)}` : ""}
              </p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Leads par source" />
            <div className="p-4">
              <DonutChart data={funnel.data.by_source.map((s) => ({ name: optionLabel(s.source), value: s.count }))} />
            </div>
          </Card>
        </div>
      ) : null}

      {traffic.data ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Trafic de la vitrine (30 jours)" subtitle={`${traffic.data.totals.sessions} sessions · ${traffic.data.totals.conversions} conversions (${percent(traffic.data.totals.conversion_rate, 2)})`} actions={<Link href="/erp/analytics" className="text-sm text-brand-600 hover:underline">Analytics</Link>} />
            <div className="p-4">
              <LineChartCard data={traffic.data.series} x="bucket" series={[{ key: "sessions", label: "Sessions" }, { key: "conversions", label: "Conversions", color: "#FB8C43" }]} area />
            </div>
          </Card>
          <Card>
            <CardHeader title="Campagnes (ROI)" subtitle="Sessions et conversions par campagne UTM" />
            <ul className="divide-y divide-line text-sm">
              {traffic.data.campaigns.map((c) => (
                <li key={c.value} className="flex justify-between gap-2 px-5 py-2">
                  <span className="truncate">{c.value}</span>
                  <span className="text-muted">
                    {c.sessions} / {c.conversions}
                  </span>
                </li>
              ))}
              {!traffic.data.campaigns.length ? <li className="px-5 py-4 text-muted">Aucune campagne tracée.</li> : null}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
