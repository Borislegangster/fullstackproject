"use client";

import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, Download, FileBarChart2, Gavel, RefreshCw, Sparkles, Telescope } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageTitle, Skeleton, Stat } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, download, errorMessage } from "@/lib/api";
import { date, dateTime, money, number } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface ReportRow {
  id: string;
  number: string;
  period_start: string;
  period_end: string;
  headline?: string | null;
  ai_generated: boolean;
  generated_by: string;
  sent_at?: string | null;
  created_at: string;
  has_pdf: boolean;
}

interface ReportDetail extends ReportRow {
  narrative: { headline: string; highlights: string[]; risks: string[]; decisions: string[]; outlook: string };
  data: {
    commercial: { leads: number; leads_by_source: Record<string, number>; quotes_sent: number; quotes_accepted: number; contracts_signed: number; contracts_amount: string };
    finance: { invoiced: string; collected: string; paid_out: string; receivable: string; overdue: string; payable: string; cash_next_months: { month: string; net: string }[]; payment_plans_defaulted: number };
    projects: {
      active: number;
      avg_progress: number | null;
      health: Record<string, number>;
      late_milestones: number;
      trust_average: number | null;
      trust_lowest: { code: string; name: string; score: number }[];
      upcoming_milestones: { project: string; name: string; due_date: string }[];
    };
    controls: { new_anomalies: Record<string, number>; open_serious: { kind: string; description: string; amount: string }[]; serious_incidents_open: number };
    support: { opened: number; open: number; sla_breached: number };
  };
}

/** Rapports de direction hebdomadaires (A7) : générés chaque lundi, consultables et régénérables à la demande. */
export function ExecutiveReports() {
  const toast = useToast();
  const reports = useApi<ReportRow[]>("/reports/executive");
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    try {
      const r = await api<ReportRow>("/reports/executive/generate", { method: "POST" });
      toast.success(`Rapport ${r.number} généré`);
      void reports.reload();
    } catch (err) {
      toast.error("Génération impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <FileBarChart2 className="h-7 w-7 text-brand-600" /> Rapports de direction
          </span>
        }
        subtitle="Chaque lundi à 6 h 30 : commercial, trésorerie, chantiers, indice de confiance, contrôle interne et SAV de la semaine écoulée, en une page."
        actions={
          <Button loading={busy} onClick={() => void generate()}>
            <RefreshCw className="h-4 w-4" /> Générer la semaine écoulée
          </Button>
        }
      />
      {reports.loading && !reports.data ? (
        <Skeleton className="h-64 w-full" />
      ) : reports.data?.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {reports.data.map((r) => (
              <li key={r.id}>
                <Link href={`/erp/direction/rapports/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50">
                  <div>
                    <p className="font-semibold text-ink">
                      Semaine du {date(r.period_start)} au {date(r.period_end)}{" "}
                      {r.ai_generated ? (
                        <Badge tone="accent">
                          <Bot className="mr-1 inline h-3 w-3" />
                          Synthèse IA
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted">{r.headline}</p>
                  </div>
                  <span className="text-xs text-muted">
                    {r.number} · {r.sent_at ? `diffusé le ${dateTime(r.sent_at)}` : r.generated_by === "user" ? "généré à la demande" : "généré"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Aucun rapport pour l'instant" text="Le premier rapport est produit lundi prochain, ou maintenant avec le bouton ci-dessus." />
      )}
    </div>
  );
}

function Bullets({ items, icon, tone }: { items: string[]; icon: React.ReactNode; tone: string }) {
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className={`flex items-start gap-2 rounded-xl p-3 text-sm ${tone}`}>
          <span className="mt-0.5 shrink-0">{icon}</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function ExecutiveReportDetail({ id }: { id: string }) {
  const toast = useToast();
  const report = useApi<ReportDetail>(`/reports/executive/${id}`);
  if (report.loading && !report.data) return <Skeleton className="h-96 w-full" />;
  if (!report.data) return <Alert tone="danger">{report.error}</Alert>;
  const r = report.data;
  const { commercial: c, finance: f, projects: p, controls: k, support: s } = r.data;
  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow={
          <Link href="/erp/direction/rapports" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Rapports de direction
          </Link>
        }
        title={r.narrative.headline}
        subtitle={`Semaine du ${date(r.period_start)} au ${date(r.period_end)} · ${r.number}${r.ai_generated ? " · synthèse rédigée par l'IA à partir des seuls chiffres ci-dessous" : ""}`}
        actions={
          r.has_pdf ? (
            <Button
              variant="secondary"
              onClick={() =>
                void download(`/reports/executive/${r.id}/pdf`, `${r.number}.pdf`).catch((err) => toast.error("Téléchargement impossible", errorMessage(err)))
              }
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
          ) : null
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Encaissé sur la semaine" value={money(f.collected)} tone="success" hint={`Facturé : ${money(f.invoiced)}`} />
        <Stat label="Créances (dont retard)" value={money(f.receivable)} tone={Number(f.overdue) > 0 ? "danger" : "neutral"} hint={`En retard : ${money(f.overdue)}`} />
        <Stat label="Contrats signés" value={`${c.contracts_signed}`} hint={money(c.contracts_amount)} tone="info" />
        <Stat
          label="Indice de confiance moyen"
          value={p.trust_average !== null ? `${number(p.trust_average, 1)}/100` : "—"}
          hint={`${p.active} chantier(s) actif(s) · ${p.late_milestones} jalon(s) en retard`}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent-500" /> Faits marquants
              </span>
            }
          />
          <div className="p-5">
            <Bullets items={r.narrative.highlights} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} tone="bg-emerald-50/60" />
          </div>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" /> Risques
              </span>
            }
          />
          <div className="p-5">
            <Bullets items={r.narrative.risks} icon={<AlertTriangle className="h-4 w-4 text-red-600" />} tone="bg-red-50/60" />
          </div>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Gavel className="h-5 w-5 text-brand-600" /> Décisions attendues
              </span>
            }
          />
          <div className="p-5">
            <Bullets items={r.narrative.decisions} icon={<Gavel className="h-4 w-4 text-brand-600" />} tone="bg-brand-50/60" />
          </div>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Telescope className="h-5 w-5 text-brand-600" /> Perspective
              </span>
            }
          />
          <p className="p-5 text-sm leading-relaxed text-ink">{r.narrative.outlook}</p>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Commercial" />
          <dl className="space-y-2 p-5 text-sm">
            <Line label="Leads reçus" value={c.leads} />
            {Object.entries(c.leads_by_source).map(([k, v]) => (
              <Line key={k} label={`· ${k}`} value={v} muted />
            ))}
            <Line label="Devis envoyés" value={c.quotes_sent} />
            <Line label="Devis acceptés" value={c.quotes_accepted} />
          </dl>
        </Card>
        <Card>
          <CardHeader title="Trésorerie" />
          <dl className="space-y-2 p-5 text-sm">
            <Line label="Décaissé" value={money(f.paid_out)} />
            <Line label="Dettes fournisseurs à payer" value={money(f.payable)} />
            <Line label="Échéanciers en défaut" value={f.payment_plans_defaulted} />
            {f.cash_next_months.map((m) => (
              <Line key={m.month} label={`Solde prévisionnel ${m.month}`} value={money(m.net)} muted />
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Chantiers, contrôle, SAV" />
          <dl className="space-y-2 p-5 text-sm">
            {p.trust_lowest.map((t) => (
              <Line key={t.code} label={`Confiance ${t.code}`} value={`${number(t.score, 0)}/100`} muted />
            ))}
            <Line label="Anomalies graves ouvertes" value={k.open_serious.length} />
            <Line label="Incidents QHSE graves ouverts" value={k.serious_incidents_open} />
            <Line label="Tickets SAV ouverts (hors délai)" value={`${s.open} (${s.sla_breached})`} />
            {p.upcoming_milestones.map((m) => (
              <Line key={`${m.project}-${m.name}`} label={`${m.project} — ${m.name}`} value={date(m.due_date)} muted />
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Line({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={muted ? "text-muted" : "text-ink"}>{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
