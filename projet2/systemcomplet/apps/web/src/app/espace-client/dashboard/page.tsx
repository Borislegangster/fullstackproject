"use client";

import { AlertTriangle, ArrowRight, CalendarCheck, Camera, ClipboardCheck, Wallet } from "lucide-react";
import Link from "next/link";

import { WithProject } from "@/components/client/client-project";
import { MilestoneTimeline, type MilestoneRow } from "@/components/client/milestones";
import { TrustCard } from "@/components/innovations/trust";
import { Alert, Badge, Card, CardHeader, PageTitle, Progress, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { date, money, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface Dashboard {
  project: { id: string; code: string; name: string; status: string; health?: string | null; progress_pct?: string | null; start_planned?: string | null; end_planned?: string | null; city?: string | null };
  milestones: MilestoneRow[];
  finance: { contract_amount?: string | null; approved_changes: string; called: string; paid: string; due: string; overdue_count: number; remaining_to_call: string; currency: string };
  alerts: { kind: string; message: string }[];
  pending_decisions: { id: string; title: string; due_date?: string | null; price_impact?: string | null; delay_impact_days?: number | null }[];
  digest?: { summary?: string | null; period_start: string; period_end: string } | null;
  recent_media: { id: string; type: string; caption?: string | null; stage?: string | null; taken_at?: string | null; url: string }[];
}

function DashboardContent({ projectId }: { projectId: string }) {
  const { data, error, loading } = useApi<Dashboard>(`/client/projects/${projectId}/dashboard`);
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <Alert tone="danger">{error}</Alert>;
  const p = data.project;
  const cur = data.finance.currency === "XAF" ? "FCFA" : data.finance.currency;
  const contractTotal = toNumber(data.finance.contract_amount) + toNumber(data.finance.approved_changes);
  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow={p.code}
        title={p.name}
        subtitle={[p.city, p.start_planned ? `du ${date(p.start_planned)} au ${date(p.end_planned)}` : null].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={p.status} label={optionLabel(p.status)} />
            {p.health ? <StatusBadge status={p.health} /> : null}
          </div>
        }
      />
      {data.alerts.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {data.alerts.map((a) => (
            <Alert key={a.kind} tone={a.kind === "payment_overdue" || a.kind === "milestone_late" ? "warning" : "info"}>
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {a.message}
              </span>
            </Alert>
          ))}
        </div>
      ) : null}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Avancement global</p>
            <p className="font-title text-4xl font-extrabold text-brand-700">{number(p.progress_pct ?? 0)} %</p>
          </div>
          <p className="text-sm text-muted">Livraison prévue : {date(p.end_planned)}</p>
        </div>
        <Progress value={toNumber(p.progress_pct)} className="mt-4" tone="accent" />
      </Card>
      <TrustCard path={`/client/projects/${projectId}/trust`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Montant du contrat (avenants inclus)" value={money(contractTotal, cur)} icon={<Wallet className="h-5 w-5" />} tone="info" />
        <Stat label="Appelé" value={money(data.finance.called, cur)} hint={`Reste à appeler : ${money(data.finance.remaining_to_call, cur)}`} />
        <Stat label="Payé" value={money(data.finance.paid, cur)} tone="success" />
        <Stat label="À régler" value={money(data.finance.due, cur)} tone={data.finance.overdue_count ? "danger" : "warning"} hint={data.finance.overdue_count ? `${data.finance.overdue_count} en retard` : undefined} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Jalons" actions={<Link href="/espace-client/planning" className="text-sm text-brand-600 hover:underline">Planning complet</Link>} />
          <div className="p-5">
            <MilestoneTimeline items={data.milestones} />
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Décisions à valider" actions={data.pending_decisions.length ? <Badge tone="warning">{data.pending_decisions.length}</Badge> : null} />
            <ul className="divide-y divide-line">
              {data.pending_decisions.map((d) => (
                <li key={d.id} className="px-5 py-3 text-sm">
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted">
                    {d.due_date ? `Avant le ${date(d.due_date)}` : "Sans échéance"}
                    {toNumber(d.price_impact) ? ` · impact ${money(d.price_impact, cur)}` : ""}
                    {d.delay_impact_days ? ` · ${d.delay_impact_days} j` : ""}
                  </p>
                </li>
              ))}
              {!data.pending_decisions.length ? <li className="px-5 py-4 text-sm text-muted">Aucune décision en attente.</li> : null}
            </ul>
            {data.pending_decisions.length ? (
              <div className="border-t border-line px-5 py-3">
                <Link href="/espace-client/validations" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                  <ClipboardCheck className="h-4 w-4" /> Valider <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </Card>
          {data.digest ? (
            <Card>
              <CardHeader title="Résumé de la semaine" subtitle={`Du ${date(data.digest.period_start)} au ${date(data.digest.period_end)}`} />
              <p className="whitespace-pre-line px-5 py-4 text-sm text-ink">{data.digest.summary}</p>
            </Card>
          ) : null}
        </div>
      </div>
      <Card>
        <CardHeader title="Dernières images du chantier" actions={<Link href="/espace-client/chantier" className="text-sm text-brand-600 hover:underline">Tout voir</Link>} />
        {data.recent_media.length ? (
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
            {data.recent_media.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                {m.type === "video" ? (
                  <video src={m.url} className="h-full w-full object-cover" muted preload="metadata" />
                ) : (
                  <img src={m.url} alt={m.caption ?? "Photo de chantier"} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                )}
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 px-2 py-1 text-[11px] text-white">{m.caption ?? date(m.taken_at)}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted">
            <Camera className="h-4 w-4" /> Les photos publiées par votre chef de projet apparaîtront ici.
          </p>
        )}
      </Card>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <CalendarCheck className="h-3.5 w-3.5" /> Données publiées par GLOBUS ENGINEERING pour votre projet.
      </p>
    </div>
  );
}

export default function ClientDashboardPage() {
  return <WithProject>{(project) => <DashboardContent projectId={project.id} />}</WithProject>;
}
