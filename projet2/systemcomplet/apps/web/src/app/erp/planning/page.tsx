"use client";

import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { ResourceView } from "@/components/erp/resource";
import { ProjectPlanning } from "@/components/erp/project-workspace";
import { RefSelect } from "@/components/forms/ref-select";
import type { FieldConfig } from "@/components/forms/schema-form";
import { DateListInput, WeekdaysPicker } from "@/components/forms/structured-fields";
import { Tabs } from "@/components/ui/overlay";
import { Card, CardHeader, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { date } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { REFS } from "@/lib/refs";

const CALENDAR_FIELDS: Record<string, FieldConfig> = {
  working_days: { span: 2, label: "Jours travaillés", render: ({ value, onChange }) => <WeekdaysPicker value={value} onChange={onChange} /> },
  holidays: { span: 2, label: "Jours fériés et fermetures", render: ({ value, onChange }) => <DateListInput value={value} onChange={onChange} /> },
};

function Capacity() {
  const [weeks] = useState(8);
  const start = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }, []);
  const capacity = useApi<{ user_id: string; weeks: { week_start: string; days: number; overload: boolean }[] }[]>("/planning/capacity", { start, weeks });
  const people = useApi<{ id: string; full_name: string; job_title?: string | null }[]>("/users/directory");
  const names = new Map((people.data ?? []).map((u) => [u.id, u]));
  if (capacity.loading) return <Skeleton className="h-64 w-full" />;
  const rows = capacity.data ?? [];
  if (!rows.length) return <EmptyState title="Aucune affectation planifiée" text="Affectez des personnes aux tâches pour visualiser la charge." />;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Charge des équipes (jours par semaine)" subtitle="Au-delà de 6 jours ouvrés la semaine est en surcharge." />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left">Personne</th>
              {rows[0].weeks.map((w) => (
                <th key={w.week_start} className="px-2 py-2 text-center">
                  {date(w.week_start).slice(0, 5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.user_id}>
                <td className="px-4 py-2">
                  <span className="font-medium">{names.get(r.user_id)?.full_name ?? r.user_id.slice(0, 8)}</span>
                  <span className="block text-xs text-muted">{names.get(r.user_id)?.job_title ?? ""}</span>
                </td>
                {r.weeks.map((w) => (
                  <td key={w.week_start} className="px-1 py-1 text-center">
                    <span className={clsx("inline-block w-12 rounded-md py-1 text-xs font-semibold", w.overload ? "bg-red-100 text-red-700" : w.days > 4 ? "bg-amber-100 text-amber-800" : w.days > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-50 text-muted")}>
                      {w.days ? w.days.toFixed(1) : "—"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PlanningInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(params.get("projet"));
  const [tab, setTab] = useState(params.get("onglet") ?? "gantt");
  return (
    <div className="space-y-5">
      <PageTitle title="Planification" subtitle="Gantt, dépendances, chemin critique, références, capacité des équipes et calendriers." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "gantt", label: "Gantt projet" },
          { key: "capacite", label: "Capacité" },
          { key: "calendriers", label: "Calendriers de travail" },
        ]}
      />
      {tab === "gantt" ? (
        <>
          <div className="max-w-md">
            <RefSelect
              source={REFS.projects}
              value={projectId}
              onChange={(id) => {
                setProjectId(id);
                router.replace(id ? `/erp/planning?projet=${id}` : "/erp/planning", { scroll: false });
              }}
              placeholder="Choisir un projet…"
            />
          </div>
          {projectId ? <ProjectPlanning key={projectId} projectId={projectId} /> : <EmptyState title="Sélectionnez un projet" text="Le diagramme de Gantt, le chemin critique et les tâches du projet s'affichent ici." />}
        </>
      ) : null}
      {tab === "capacite" ? <Capacity /> : null}
      {tab === "calendriers" ? (
        <ResourceView
          embedded
          config={{
            title: "Calendriers de travail",
            subtitle: "Jours travaillés, jours fériés et heures par jour utilisés par l'ordonnancement.",
            path: "/work-calendars",
            columns: [
              { key: "name", label: "Calendrier" },
              { key: "hours_per_day", label: "Heures / jour", format: "number" },
              { key: "working_days", label: "Jours travaillés", render: (r) => (r.working_days ?? []).map((d: number) => ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][d]).join(", ") },
            ],
            create: { endpoint: "POST /work-calendars", label: "Nouveau calendrier", perms: ["planning:write"], initial: { working_days: [0, 1, 2, 3, 4, 5], holidays: [] }, fields: CALENDAR_FIELDS },
            update: { endpoint: "PATCH /work-calendars/{item_id}", perms: ["planning:write"], fields: CALENDAR_FIELDS },
            remove: { path: (r) => `/work-calendars/${r.id}`, perms: ["planning:write"] },
          }}
        />
      ) : null}
    </div>
  );
}

export default function PlanningPage() {
  return (
    <Suspense>
      <PlanningInner />
    </Suspense>
  );
}
