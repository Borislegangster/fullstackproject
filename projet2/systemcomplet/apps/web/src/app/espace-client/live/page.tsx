"use client";

import { Plane, Radio, Rotate3D, Video } from "lucide-react";
import { useMemo, useState } from "react";

import { WithProject } from "@/components/client/client-project";
import { MyVisitShares, ShareVisitButton } from "@/components/client/visit-share";
import { PanoramaViewer } from "@/components/three/panorama-viewer";
import { Tabs } from "@/components/ui/overlay";
import { Alert, Card, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { dateLong } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Content {
  id: string;
  kind: string;
  title: string;
  description?: string | null;
  captured_at?: string | null;
  comparison_group?: string | null;
  url?: string | null;
}

const KINDS: Record<string, { label: string; icon: React.ReactNode }> = {
  live: { label: "Direct", icon: <Radio className="h-4 w-4" /> },
  photo_360: { label: "Photos 360°", icon: <Rotate3D className="h-4 w-4" /> },
  video_360: { label: "Vidéos 360°", icon: <Rotate3D className="h-4 w-4" /> },
  virtual_tour: { label: "Visites virtuelles", icon: <Rotate3D className="h-4 w-4" /> },
  drone: { label: "Drone", icon: <Plane className="h-4 w-4" /> },
  timelapse: { label: "Time-lapse", icon: <Video className="h-4 w-4" /> },
};

function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function ContentPlayer({ c }: { c: Content }) {
  if (!c.url) return <p className="p-4 text-sm text-muted">Contenu indisponible.</p>;
  const embed = embedUrl(c.url);
  if (embed) return <iframe src={embed} title={c.title} className="aspect-video w-full rounded-xl" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />;
  if (c.kind === "photo_360") return <PanoramaViewer url={c.url} />;
  if (c.kind === "video_360") return <PanoramaViewer url={c.url} video />;
  if (c.kind === "virtual_tour" && /^https:\/\//.test(c.url)) return <iframe src={c.url} title={c.title} className="h-[480px] w-full rounded-xl" allowFullScreen loading="lazy" />;
  return <video src={c.url} controls playsInline className="w-full rounded-xl bg-black" preload="metadata" />;
}

function LiveContent({ projectId }: { projectId: string }) {
  const { data, error, loading } = useApi<{ contents: Content[] }>(`/client/projects/${projectId}/immersion`);
  const [tab, setTab] = useState("");
  const [shared, setShared] = useState(0);
  const kinds = useMemo(() => [...new Set((data?.contents ?? []).map((c) => c.kind))], [data]);
  const active = tab || kinds[0] || "";
  const list = (data?.contents ?? []).filter((c) => c.kind === active);
  const groups = useMemo(() => {
    const map = new Map<string, Content[]>();
    list.forEach((c) => map.set(c.comparison_group || c.id, [...(map.get(c.comparison_group || c.id) ?? []), c]));
    return [...map.values()];
  }, [list]);
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <Alert tone="danger">{error}</Alert>;
  if (!data.contents.length) return <EmptyState icon={<Rotate3D className="h-8 w-8" />} title="Aucun contenu immersif publié" text="Directs, visites 360° et survols de drone apparaîtront ici au fil du chantier." />;
  return (
    <div className="space-y-6">
      <Tabs value={active} onChange={setTab} tabs={kinds.map((k) => ({ key: k, label: <span className="inline-flex items-center gap-1.5">{KINDS[k]?.icon} {KINDS[k]?.label ?? k}</span> }))} />
      {groups.map((group) => (
        <Card key={group[0].id} className="space-y-3 p-4">
          {group.length > 1 ? <p className="text-sm font-semibold text-brand-800">Comparaison dans le temps</p> : null}
          <div className={group.length > 1 ? "grid gap-4 lg:grid-cols-2" : ""}>
            {group.map((c) => (
              <figure key={c.id}>
                <ContentPlayer c={c} />
                <figcaption className="mt-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-ink">{c.title}</p>
                    {c.kind !== "live" ? <ShareVisitButton projectId={projectId} contentId={c.id} title={c.title} onCreated={() => setShared((n) => n + 1)} /> : null}
                  </div>
                  <p className="text-xs text-muted">{c.captured_at ? dateLong(c.captured_at) : ""}</p>
                  {c.description ? <p className="text-sm text-muted">{c.description}</p> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </Card>
      ))}
      <MyVisitShares projectId={projectId} refreshKey={shared} />
    </div>
  );
}

export default function LivePage() {
  return (
    <div>
      <PageTitle title="Live, 360° et drone" subtitle="Suivez votre chantier à distance, comme si vous y étiez." />
      <WithProject>{(p) => <LiveContent projectId={p.id} />}</WithProject>
    </div>
  );
}
