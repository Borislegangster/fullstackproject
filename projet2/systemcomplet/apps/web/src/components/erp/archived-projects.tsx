"use client";

import { Archive, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/overlay";
import { Button, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface ArchivedProject {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  status: string;
  archived_at: string;
  archived_by?: string | null;
  archive_reason?: string | null;
  can_restore: boolean;
}

/** Archives des chantiers : lecture des chantiers archivés (date, auteur, motif) et restauration à l'identique. */
export function ArchivedProjects() {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState<ArchivedProject | null>(null);
  const list = useApi<ArchivedProject[]>(open ? "/projects/archived" : null);
  return (
    <Card>
      <CardHeader
        title="Archives des chantiers"
        subtitle="Les chantiers archivés quittent les listes mais restent conservés intégralement ; ils peuvent être restaurés."
        actions={
          <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
            <Archive className="h-4 w-4" /> {open ? "Masquer les archives" : "Voir les archives"}
          </Button>
        }
      />
      {open ? (
        list.loading && !list.data ? (
          <Skeleton className="m-5 h-24" />
        ) : list.data?.length ? (
          <ul className="divide-y divide-line">
            {list.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{p.code}</span> — {p.name}
                  {p.city ? ` (${p.city})` : ""} · {optionLabel(p.status)}
                  <span className="block text-xs text-muted">
                    Archivé le {dateTime(p.archived_at)}
                    {p.archived_by ? ` par ${p.archived_by}` : ""}
                    {p.archive_reason ? ` · motif : ${p.archive_reason}` : ""}
                  </span>
                </span>
                {p.can_restore ? (
                  <Button size="sm" onClick={() => setRestoring(p)}>
                    <RotateCcw className="h-4 w-4" /> Restaurer
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted">Aucun chantier archivé.</p>
        )
      ) : null}
      <ConfirmDialog
        open={!!restoring}
        onClose={() => setRestoring(null)}
        title="Restaurer le chantier"
        text={restoring ? `${restoring.code} — ${restoring.name} retrouvera les listes, ses données et ses accès, à l'identique. L'opération est journalisée.` : null}
        reasonLabel="Motif de la restauration"
        reasonMin={10}
        confirmLabel="Restaurer"
        onConfirm={async (reason) => {
          if (!restoring) return;
          await api(`/projects/${restoring.id}/restore`, { method: "POST", body: { reason } });
          toast.success("Chantier restauré");
          router.push(`/erp/chantiers/${restoring.id}`);
        }}
      />
    </Card>
  );
}
