"use client";

import { BadgeCheck, Download, FileText, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { WithProject } from "@/components/client/client-project";
import { canPreview, PreviewButton } from "@/components/ui/file-preview";
import { Input, Select } from "@/components/ui/form";
import { Alert, Badge, Card, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { date, fileSize } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface ClientDocument {
  id: string;
  title: string;
  type: string;
  discipline?: string | null;
  version: string;
  published_at?: string | null;
  size?: number | null;
  mime?: string | null;
  filename?: string | null;
  authenticity_url: string;
  url: string;
}

const DOC_TYPES: Record<string, string> = {
  plan: "Plans",
  maquette_bim: "Maquettes BIM",
  contrat: "Contrats",
  devis: "Devis",
  facture: "Factures",
  pv: "Procès-verbaux",
  rapport: "Rapports",
  permis: "Permis et autorisations",
  note_calcul: "Notes de calcul",
  photo: "Photos",
  autre: "Autres documents",
};

function DocumentsContent({ projectId }: { projectId: string }) {
  const { data, error, loading } = useApi<ClientDocument[]>(`/client/projects/${projectId}/documents`);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const filtered = useMemo(() => (data ?? []).filter((d) => (!type || d.type === type) && (!q || d.title.toLowerCase().includes(q.toLowerCase()))), [data, q, type]);
  const groups = useMemo(() => {
    const map = new Map<string, ClientDocument[]>();
    filtered.forEach((d) => map.set(d.type, [...(map.get(d.type) ?? []), d]));
    return [...map.entries()];
  }, [filtered]);
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <Alert tone="danger">{error}</Alert>;
  const types = [...new Set(data.map((d) => d.type))];
  return (
    <div className="space-y-6">
      <PageTitle title="Documents" subtitle="Seule la version en vigueur de chaque document est publiée ; les téléchargements sont tracés et filigranés." />
      <div className="flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un document" className="pl-9" />
        </div>
        <Select className="w-auto" value={type} onChange={(e) => setType(e.target.value)} options={types.map((t) => ({ value: t, label: DOC_TYPES[t] ?? optionLabel(t) }))} placeholder="Tous les types" aria-label="Type" />
      </div>
      {groups.length ? (
        groups.map(([t, docs]) => (
          <Card key={t}>
            <div className="border-b border-line px-5 py-3 font-semibold text-brand-800">{DOC_TYPES[t] ?? optionLabel(t)}</div>
            <ul className="divide-y divide-line">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-brand-500" />
                    <span>
                      <span className="font-medium">{d.title}</span> <Badge tone="info">{d.version}</Badge>
                      <span className="block text-xs text-muted">
                        Publié le {date(d.published_at)} {d.size ? `· ${fileSize(d.size)}` : ""} {d.discipline ? `· ${optionLabel(d.discipline)}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Link href={d.authenticity_url} target="_blank" className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline">
                      <BadgeCheck className="h-4 w-4" /> Authenticité
                    </Link>
                    {canPreview(d.filename ?? d.title, d.mime) ? <PreviewButton source={{ url: d.url, name: d.filename ?? d.title, mime: d.mime, size: d.size }} /> : null}
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
                      <Download className="h-3.5 w-3.5" /> Ouvrir
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      ) : (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="Aucun document publié" text="Plans, contrats, procès-verbaux et rapports apparaîtront ici dès leur publication." />
      )}
    </div>
  );
}

export default function ClientDocumentsPage() {
  return <WithProject>{(p) => <DocumentsContent projectId={p.id} />}</WithProject>;
}
