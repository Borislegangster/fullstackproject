"use client";

import { Camera, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { WithProject } from "@/components/client/client-project";
import { MilestoneTimeline, type MilestoneRow } from "@/components/client/milestones";
import { TimelapseGallery } from "@/components/innovations/timelapse";
import { ClientTwinCard } from "@/components/innovations/twin";
import { Select } from "@/components/ui/form";
import { Lightbox } from "@/components/ui/lightbox";
import { Alert, Card, CardHeader, EmptyState, PageTitle, Progress, Skeleton } from "@/components/ui/primitives";
import { dateLong, dateTime, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface Timeline {
  progress_pct?: string | null;
  media: { id: string; type: string; caption?: string | null; stage?: string | null; taken_at?: string | null; url: string }[];
  incidents: { date: string; summary?: string | null }[];
  milestones: MilestoneRow[];
}

function ChantierContent({ projectId }: { projectId: string }) {
  const { data, error, loading } = useApi<Timeline>(`/client/projects/${projectId}/timeline`);
  const [stage, setStage] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const media = useMemo(() => (data?.media ?? []).filter((m) => !stage || m.stage === stage), [data, stage]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof media>();
    media.forEach((m) => {
      const key = (m.taken_at ?? "").slice(0, 10) || "sans-date";
      map.set(key, [...(map.get(key) ?? []), m]);
    });
    return [...map.entries()];
  }, [media]);
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <Alert tone="danger">{error}</Alert>;
  const stages = [...new Set(data.media.map((m) => m.stage).filter(Boolean))] as string[];
  return (
    <div className="space-y-6">
      <PageTitle title="Suivi du chantier" subtitle="Photos et vidéos datées publiées par votre équipe projet." />
      <Card className="p-5">
        <Progress value={toNumber(data.progress_pct)} label="Avancement des travaux" tone="accent" />
      </Card>
      <ClientTwinCard projectId={projectId} />
      <TimelapseGallery path={`/client/projects/${projectId}/timelapses`} emptyText="Chaque lundi, la semaine écoulée de votre chantier en une courte vidéo." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-brand-800">Journal visuel</h2>
            {stages.length ? <Select className="w-auto" value={stage} onChange={(e) => setStage(e.target.value)} options={stages.map((s) => ({ value: s, label: optionLabel(s) }))} placeholder="Toutes les étapes" aria-label="Étape" /> : null}
          </div>
          {groups.length ? (
            groups.map(([day, items]) => (
              <section key={day}>
                <p className="mb-2 text-sm font-semibold text-muted">{day === "sans-date" ? "Date non renseignée" : dateLong(day)}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {items.map((m) => (
                    <button key={m.id} type="button" onClick={() => setOpen(media.indexOf(m))} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                      {m.type === "video" ? (
                        <video src={m.url} className="h-full w-full object-cover" muted preload="metadata" />
                      ) : (
                        <img src={m.url} alt={m.caption ?? "Photo de chantier"} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 px-2 py-1 text-left text-[11px] text-white">
                        {m.caption ?? optionLabel(m.stage)} {m.taken_at ? `· ${dateTime(m.taken_at)}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <EmptyState icon={<Camera className="h-8 w-8" />} title="Aucune image publiée" text="Les photos et vidéos validées par votre chef de projet apparaîtront ici." />
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Jalons" />
            <div className="p-5">
              <MilestoneTimeline items={data.milestones} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Incidents communiqués" />
            <ul className="divide-y divide-line">
              {data.incidents.map((i, idx) => (
                <li key={idx} className="flex gap-3 px-5 py-3 text-sm">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    <span className="block text-xs text-muted">{dateTime(i.date)}</span>
                    {i.summary}
                  </span>
                </li>
              ))}
              {!data.incidents.length ? <li className="px-5 py-4 text-sm text-muted">Aucun incident communiqué.</li> : null}
            </ul>
          </Card>
        </div>
      </div>
      <Lightbox items={media.map((m) => ({ url: m.url, type: m.type, caption: m.caption ?? optionLabel(m.stage) }))} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
    </div>
  );
}

export default function ChantierPage() {
  return <WithProject>{(p) => <ChantierContent projectId={p.id} />}</WithProject>;
}
