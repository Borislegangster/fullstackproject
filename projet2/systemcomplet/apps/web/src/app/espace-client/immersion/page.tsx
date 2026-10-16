"use client";

import { ArrowRight, Box, Palette } from "lucide-react";
import Link from "next/link";

import { WithProject } from "@/components/client/client-project";
import { MyVisitShares, ShareVisitButton } from "@/components/client/visit-share";
import { FederatedViewer, type Federation } from "@/components/three/federated-viewer";
import { Alert, Card, CardHeader, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { date } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Immersion {
  bim: Federation;
  contents: { id: string; kind: string; title: string }[];
  configurators: { id: string; name: string; lock_date?: string | null; has_model?: boolean }[];
}

function ImmersionContent({ projectId }: { projectId: string }) {
  const { data, error, loading } = useApi<Immersion>(`/client/projects/${projectId}/immersion`);
  if (loading) return <Skeleton className="h-[32rem] w-full" />;
  if (error || !data) return <Alert tone="danger">{error}</Alert>;
  return (
    <div className="space-y-6">
      <PageTitle title="Maquette 3D" subtitle="Explorez votre projet : faites pivoter, zoomez, masquez des disciplines, coupez la maquette." />
      {data.bim.models.length ? (
        <Card className="p-3">
          <FederatedViewer federation={data.bim} className="h-[65vh] min-h-[420px]" />
        </Card>
      ) : (
        <EmptyState icon={<Box className="h-8 w-8" />} title="Maquette en préparation" text="La maquette 3D sera publiée par votre équipe de conception." />
      )}
      {data.configurators.length ? (
        <Card>
          <CardHeader title="Configurer mes finitions" subtitle="Choisissez vos matériaux et visualisez l'impact sur le prix et le délai." />
          <ul className="divide-y divide-line">
            {data.configurators.map((c) => (
              <li key={c.id} className="flex items-center gap-2 pr-4 hover:bg-slate-50">
                <Link href={`/espace-client/configurateur/${c.id}`} className="flex flex-1 items-center justify-between gap-3 px-5 py-3">
                  <span className="flex items-center gap-3">
                    <Palette className="h-5 w-5 text-accent-500" />
                    <span>
                      <span className="font-medium">{c.name}</span>
                      {c.lock_date ? <span className="block text-xs text-muted">Choix ouverts jusqu'au {date(c.lock_date)}</span> : null}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted" />
                </Link>
                {c.has_model ? <ShareVisitButton projectId={projectId} modelId={c.id} title={c.name} /> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {data.contents.length ? (
        <Link href="/espace-client/live" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
          Voir les visites 360°, vidéos et vues drone ({data.contents.length}) <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
      <MyVisitShares projectId={projectId} />
    </div>
  );
}

export default function ImmersionPage() {
  return <WithProject>{(p) => <ImmersionContent projectId={p.id} />}</WithProject>;
}
