"use client";

import { CalendarDays, MapPin } from "lucide-react";

import { WithProject } from "@/components/client/client-project";
import { MilestoneTimeline, type MilestoneRow } from "@/components/client/milestones";
import { Gantt } from "@/components/planning/gantt";
import { Alert, Card, CardHeader, PageTitle, Skeleton } from "@/components/ui/primitives";
import { dateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface Planning {
  tasks: { id: string; name: string; start?: string | null; end?: string | null; progress_pct?: string | null; status: string }[];
  milestones: MilestoneRow[];
  meetings: { id: string; title: string; starts_at: string; ends_at?: string | null; location?: string | null; kind: string }[];
}

function PlanningContent({ projectId }: { projectId: string }) {
  const { data, error, loading } = useApi<Planning>(`/client/projects/${projectId}/planning`);
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <Alert tone="danger">{error}</Alert>;
  const now = new Date().toISOString();
  const upcoming = data.meetings.filter((m) => m.starts_at >= now);
  const past = data.meetings.filter((m) => m.starts_at < now).reverse();
  return (
    <div className="space-y-6">
      <PageTitle title="Planning" subtitle="Calendrier des travaux, jalons et rendez-vous de votre projet." />
      <Gantt
        tasks={[
          ...data.tasks.map((t) => ({ id: t.id, name: t.name, start: t.start, end: t.end, progress_pct: t.progress_pct, status: t.status })),
          ...data.milestones.map((m) => ({ id: `m-${m.id}`, name: `◆ ${m.name}`, start: m.due_date, end: m.due_date, is_milestone: true, status: m.status, progress_pct: m.achieved_at ? 100 : 0 })),
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Jalons" />
          <div className="p-5">
            <MilestoneTimeline items={data.milestones} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Réunions et rendez-vous" />
          <ul className="divide-y divide-line">
            {[...upcoming, ...past].map((m) => (
              <li key={m.id} className={`px-5 py-3 text-sm ${m.starts_at < now ? "opacity-60" : ""}`}>
                <p className="flex items-center gap-2 font-medium">
                  <CalendarDays className="h-4 w-4 text-brand-500" /> {m.title}
                </p>
                <p className="text-xs text-muted">
                  {dateTime(m.starts_at)} · {optionLabel(m.kind)}
                  {m.location ? (
                    <span className="ml-1 inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {m.location}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
            {!data.meetings.length ? <li className="px-5 py-4 text-sm text-muted">Aucun rendez-vous planifié.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default function ClientPlanningPage() {
  return <WithProject>{(p) => <PlanningContent projectId={p.id} />}</WithProject>;
}
