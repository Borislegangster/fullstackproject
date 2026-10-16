"use client";

import { ArrowRight, Palette } from "lucide-react";
import Link from "next/link";

import { WithProject } from "@/components/client/client-project";
import { Alert, Card, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { date } from "@/lib/format";
import { useApi } from "@/lib/hooks";

function ModelsList({ projectId }: { projectId: string }) {
  const { data, error, loading } = useApi<{ configurators: { id: string; name: string; lock_date?: string | null }[] }>(`/client/projects/${projectId}/immersion`);
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error || !data) return <Alert tone="danger">{error}</Alert>;
  if (!data.configurators.length)
    return <EmptyState icon={<Palette className="h-8 w-8" />} title="Aucune configuration ouverte" text="Votre chef de projet ouvrira le configurateur au moment du choix de vos finitions." />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.configurators.map((c) => (
        <Link key={c.id} href={`/espace-client/configurateur/${c.id}`}>
          <Card className="flex items-center justify-between gap-3 p-5 transition hover:ring-brand-300">
            <span className="flex items-center gap-3">
              <span className="rounded-xl bg-accent-50 p-3 text-accent-600">
                <Palette className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-semibold text-brand-800">{c.name}</span>
                <span className="text-xs text-muted">{c.lock_date ? `Choix jusqu'au ${date(c.lock_date)}` : "Choix ouverts"}</span>
              </span>
            </span>
            <ArrowRight className="h-5 w-5 text-muted" />
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function ConfiguratorListPage() {
  return (
    <div>
      <PageTitle title="Configurateur de finitions" subtitle="Visualisez vos choix de matériaux en 3D avec leur impact immédiat sur le prix et le délai." />
      <WithProject>{(p) => <ModelsList projectId={p.id} />}</WithProject>
    </div>
  );
}
