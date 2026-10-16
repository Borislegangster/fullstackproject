"use client";

import { Download, ExternalLink, ShieldCheck } from "lucide-react";

import { WithProject } from "@/components/client/client-project";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { download } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Proof {
  id: string;
  number: string;
  title: string;
  subject: string;
  sha256: string;
  issued_at: string;
  anchor_status: string;
  anchored_at?: string | null;
  revoked: boolean;
  public_code: string;
  leaves: { label: string; sha256: string }[];
}

function Proofs({ projectId }: { projectId: string }) {
  const { data, loading, error } = useApi<Proof[]>(`/client/projects/${projectId}/proofs`);
  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <Alert tone="danger">{error}</Alert>;
  return (
    <div className="space-y-6">
      <PageTitle
        title="Preuves certifiées"
        subtitle="Chaque décision validée, document publié et lot de photos de votre chantier est scellé par son empreinte numérique : impossible de le modifier sans que cela se voie."
      />
      <Alert tone="info" title="Comment ça marche ?">
        Une empreinte SHA-256 identifie un fichier de manière unique. Sur la page de vérification, déposez le fichier que vous détenez : son empreinte est
        recalculée sur votre appareil et comparée à celle certifiée le jour J. Les preuves horodatées publiquement (OpenTimestamps) sont vérifiables sans
        dépendre de GLOBUS.
      </Alert>
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> {data.length} preuve(s)
            </span>
          }
        />
        {data.length ? (
          <ul className="divide-y divide-line">
            {data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {p.title} {p.revoked ? <Badge tone="danger">Révoquée</Badge> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {p.subject} · {p.number} · certifiée le {dateTime(p.issued_at)}
                    {p.anchored_at ? " · horodatage public OpenTimestamps" : ""}
                    {p.leaves.length ? ` · ${p.leaves.length} pièce(s)` : ""}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{p.sha256}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a href={`/verification/${p.public_code}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> Vérifier un fichier
                  </a>
                  <Button size="sm" variant="secondary" onClick={() => void download(`/proofs/${p.id}/certificate.pdf`, `certificat-${p.number}.pdf`)}>
                    <Download className="h-4 w-4" /> Certificat
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState title="Aucune preuve pour l'instant" text="Vos décisions validées et les photos publiées de votre chantier apparaîtront ici, certifiées." />
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ClientProofsPage() {
  return <WithProject>{(p) => <Proofs projectId={p.id} />}</WithProject>;
}
