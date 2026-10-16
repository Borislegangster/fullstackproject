"use client";

import { LifeBuoy, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useClientProject } from "@/components/client/client-project";
import { SchemaForm } from "@/components/forms/schema-form";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/overlay";
import { Badge, Button, PageTitle } from "@/components/ui/primitives";
import { dateTime } from "@/lib/format";
import { useList } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface TicketRow {
  id: string;
  number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  resolution_due_at?: string | null;
  resolution_breached?: boolean;
}

export default function ClientSupportPage() {
  const router = useRouter();
  const { project } = useClientProject();
  const list = useList<TicketRow>("/support/tickets", { pageSize: 25 }, { project_id: project?.id });
  const [open, setOpen] = useState(false);
  return (
    <div>
      <PageTitle
        title="SAV et garanties"
        subtitle="Signalez un désordre : délais d'intervention garantis, suivi et validation de la réparation."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nouvelle demande
          </Button>
        }
      />
      <DataTable
        list={list}
        onRowClick={(r) => router.push(`/espace-client/sav/${r.id}`)}
        filters={[{ key: "status", label: "Statut", options: ["new", "assigned", "diagnosis", "scheduled", "in_progress", "resolved", "closed", "reopened"].map((v) => ({ value: v, label: optionLabel(v) })) }]}
        columns={[
          { key: "number", label: "N°", render: (r) => <Link href={`/espace-client/sav/${r.id}`} className="font-medium text-brand-600">{r.number}</Link> },
          { key: "subject", label: "Objet" },
          { key: "category", label: "Catégorie", format: "option", hideOnMobile: true },
          { key: "priority", label: "Priorité", format: "option", hideOnMobile: true },
          { key: "created_at", label: "Ouvert le", format: "datetime", hideOnMobile: true },
          { key: "resolution_due_at", label: "Résolution attendue", render: (r) => <span>{dateTime(r.resolution_due_at)} {r.resolution_breached ? <Badge tone="danger">Dépassé</Badge> : null}</span>, hideOnMobile: true },
          { key: "status", label: "Statut", format: "status" },
        ]}
        empty={{ title: "Aucune demande", text: "Vos demandes SAV et leur suivi apparaîtront ici.", action: <Button onClick={() => setOpen(true)}><LifeBuoy className="h-4 w-4" /> Signaler un problème</Button> }}
      />
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle demande SAV" size="lg">
        <SchemaForm
          endpoint="POST /support/tickets"
          fixed={project ? { project_id: project.id } : undefined}
          exclude={["zone_id"]}
          fields={{ project_id: { hidden: !!project } }}
          submitLabel="Envoyer la demande"
          onCancel={() => setOpen(false)}
          onSuccess={(res: { id: string }) => {
            setOpen(false);
            router.push(`/espace-client/sav/${res.id}`);
          }}
        />
      </Modal>
    </div>
  );
}
