"use client";

import Link from "next/link";
import { useState } from "react";

import { CellLink, ResourceView } from "@/components/erp/resource";
import { TicketDetail } from "@/components/support/ticket-detail";
import { BarChartCard, DonutChart } from "@/components/ui/charts";
import { Checkbox, Select } from "@/components/ui/form";
import { Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Card, CardHeader, PageTitle, Skeleton, Stat } from "@/components/ui/primitives";
import { money, number, relative, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

const TICKET_STATUSES = ["new", "assigned", "diagnosis", "scheduled", "in_progress", "resolved", "closed", "reopened", "cancelled"];
const CATEGORIES = ["etancheite", "plomberie", "electricite", "fissure", "menuiserie", "peinture", "equipement", "autre"];
const opts = (values: string[]) => values.map((v) => ({ value: v, label: optionLabel(v) }));

export function TicketsList() {
  const [mine, setMine] = useState(false);
  const [breached, setBreached] = useState(false);
  return (
    <ResourceView
      embedded
      config={{
        title: "Tickets SAV",
        subtitle: "Réception → affectation → diagnostic (garantie) → intervention planifiée → résolution → validation client.",
        path: "/support/tickets",
        query: { mine: mine || undefined, breached: breached || undefined },
        href: (r) => `/erp/sav/${r.id}`,
        exportDataset: "tickets",
        columns: [
          { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/sav/${r.id}`}>{r.number}</CellLink> },
          { key: "subject", label: "Objet", render: (r) => (
            <span>
              {r.subject}
              <span className="block text-xs text-muted">{[optionLabel(r.category), r.project?.code ?? r.project_code].filter(Boolean).join(" · ")}</span>
            </span>
          ) },
          { key: "priority", label: "Priorité", render: (r) => <Badge tone={r.priority === "urgent" ? "danger" : r.priority === "high" ? "accent" : "neutral"}>{optionLabel(r.priority)}</Badge> },
          {
            key: "resolution_due_at",
            label: "SLA",
            render: (r) =>
              r.response_breached || r.resolution_breached ? (
                <Badge tone="danger">Dépassé</Badge>
              ) : r.resolution_due_at && !["resolved", "closed", "cancelled"].includes(r.status) ? (
                <span className="text-xs text-amber-700">Résoudre {relative(r.resolution_due_at)}</span>
              ) : (
                "—"
              ),
          },
          { key: "within_warranty", label: "Garantie", render: (r) => (r.within_warranty ? <Badge tone="success">Sous garantie</Badge> : r.within_warranty === false ? <Badge>Hors garantie</Badge> : "—"), hideOnMobile: true },
          { key: "created_at", label: "Ouvert", format: "datetime", hideOnMobile: true },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [
          { key: "status", label: "Statut", options: opts(TICKET_STATUSES) },
          { key: "category", label: "Catégorie", options: opts(CATEGORIES) },
          { key: "priority", label: "Priorité", options: opts(["low", "normal", "high", "urgent"]) },
        ],
        toolbar: (
          <div className="flex flex-wrap items-center gap-3">
            <Checkbox label="Mes tickets" checked={mine} onChange={setMine} />
            <Checkbox label="SLA dépassé" checked={breached} onChange={setBreached} />
          </div>
        ),
        create: {
          endpoint: "POST /support/tickets",
          label: "Ticket (appel client)",
          perms: ["support:write"],
          initial: { priority: "normal", category: "autre" },
          fields: { category: { options: opts(CATEGORIES) }, priority: { options: opts(["low", "normal", "high", "urgent"]) }, description: { widget: "textarea" } },
        },
      }}
    />
  );
}

export function SupportStatistics() {
  const [days, setDays] = useState(90);
  const stats = useApi<Record<string, any>>("/support/statistics", { days });
  const s = stats.data;
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} options={[30, 90, 180, 365].map((d) => ({ value: String(d), label: `${d} derniers jours` }))} aria-label="Période" />
      </div>
      {stats.loading && !s ? (
        <Skeleton className="h-64" />
      ) : stats.error ? (
        <Alert tone="danger">{stats.error}</Alert>
      ) : s ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Tickets" value={number(s.total)} tone="info" />
            <Stat label="Respect SLA réponse" value={s.sla_response_compliance !== null && s.sla_response_compliance !== undefined ? `${number(s.sla_response_compliance, 1)} %` : "—"} />
            <Stat label="Résolution moyenne" value={s.avg_resolution_hours !== null && s.avg_resolution_hours !== undefined ? `${number(s.avg_resolution_hours, 1)} h` : "—"} />
            <Stat label="Satisfaction" value={s.satisfaction_avg ? `${number(s.satisfaction_avg, 2)} / 5` : "—"} tone="success" />
            <Stat label="Coût SAV" value={money(s.total_cost)} hint={`${number(s.within_warranty)} sous garantie`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Par statut" />
              <div className="p-4">
                <DonutChart data={Object.entries((s.by_status ?? {}) as Record<string, number>).map(([k, v]) => ({ name: optionLabel(k), value: toNumber(v) }))} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Par catégorie" />
              <div className="p-4">
                <BarChartCard data={Object.entries((s.by_category ?? {}) as Record<string, number>).map(([k, v]) => ({ category: optionLabel(k), count: toNumber(v) }))} x="category" series={[{ key: "count", label: "Tickets" }]} />
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function SupportHub({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  return (
    <div className="space-y-5">
      <PageTitle title="SAV et garanties" subtitle="Demandes clients, diagnostic sous garantie, interventions, coûts, satisfaction." />
      <Tabs
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "tickets", label: "Tickets" },
          { key: "statistiques", label: "Statistiques" },
        ]}
      />
      {tab === "statistiques" ? <SupportStatistics /> : <TicketsList />}
    </div>
  );
}

export function StaffTicketPage({ id }: { id: string }) {
  return (
    <div className="space-y-4">
      <Link href="/erp/sav" className="text-sm text-brand-600 hover:underline">
        ← Tickets SAV
      </Link>
      <TicketDetail ticketId={id} staff />
    </div>
  );
}
