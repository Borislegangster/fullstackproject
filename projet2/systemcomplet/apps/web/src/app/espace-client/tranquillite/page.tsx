"use client";

import { Anchor, BadgeCheck, CalendarClock, FileCheck2, FolderLock, UserRound } from "lucide-react";

import { WithProject } from "@/components/client/client-project";
import { Alert, Badge, Card, EmptyState, PageTitle, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { date, dateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface Item {
  id: string;
  category: string;
  title: string;
  authority?: string | null;
  status: string;
  issued_date?: string | null;
  expiry_date?: string | null;
  due_date?: string | null;
  responsible?: string | null;
  reference_masked?: string | null;
  verified_at?: string | null;
  anchored: boolean;
  proofs: number;
}

const CATEGORIES: Record<string, string> = {
  foncier: "Documents fonciers",
  titre: "Certificat / titre",
  permis: "Permis et autorisations",
  notarie: "Actes notariés",
  verification: "Vérifications",
  administratif: "Dossier administratif",
  assurance: "Assurances",
  autre: "Autres pièces",
};

function TranquilliteContent({ projectId }: { projectId: string }) {
  const { data, error, loading } = useApi<Item[]>(`/client/projects/${projectId}/tranquillite`);
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <Alert tone="danger">{error}</Alert>;
  if (!data.length) return <EmptyState icon={<FolderLock className="h-8 w-8" />} title="Dossier en cours de constitution" text="Votre responsable GLOBUS rassemble les pièces foncières et administratives de votre projet." />;
  const groups = new Map<string, Item[]>();
  data.forEach((i) => groups.set(i.category, [...(groups.get(i.category) ?? []), i]));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([cat, items]) => (
        <Card key={cat}>
          <div className="border-b border-line px-5 py-3 font-semibold text-brand-800">{CATEGORIES[cat] ?? optionLabel(cat)}</div>
          <ul className="divide-y divide-line">
            {items.map((i) => {
              const expired = i.expiry_date && i.expiry_date < today;
              const dueSoon = i.due_date && i.due_date >= today && Date.parse(i.due_date) - Date.now() < 30 * 86_400_000;
              return (
                <li key={i.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-ink">{i.title}</p>
                      <p className="text-xs text-muted">
                        {i.authority ?? ""} {i.reference_masked ? `· réf. ${i.reference_masked}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge status={i.status} />
                      {i.verified_at ? (
                        <Badge tone="success">
                          <BadgeCheck className="h-3 w-3" /> Vérifié le {date(i.verified_at)}
                        </Badge>
                      ) : null}
                      {i.anchored ? (
                        <Badge tone="info">
                          <Anchor className="h-3 w-3" /> Empreinte ancrée
                        </Badge>
                      ) : null}
                      {expired ? <Badge tone="danger">Expiré</Badge> : dueSoon ? <Badge tone="warning">Échéance proche</Badge> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                    {i.issued_date ? <span>Délivré le {date(i.issued_date)}</span> : null}
                    {i.expiry_date ? <span>Expire le {date(i.expiry_date)}</span> : null}
                    {i.due_date ? (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" /> Échéance {date(i.due_date)}
                      </span>
                    ) : null}
                    {i.responsible ? (
                      <span className="flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" /> {i.responsible}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <FileCheck2 className="h-3.5 w-3.5" /> {i.proofs} preuve(s)
                    </span>
                    {i.verified_at ? <span>Contrôle : {dateTime(i.verified_at)}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export default function TranquillitePage() {
  return (
    <div>
      <PageTitle title="Dossier Tranquillité" subtitle="Foncier, permis, actes et vérifications : le statut de chaque pièce, ses échéances et ses preuves." />
      <WithProject>{(p) => <TranquilliteContent projectId={p.id} />}</WithProject>
    </div>
  );
}
