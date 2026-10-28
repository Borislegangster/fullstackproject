"use client";

import { Lock, LockOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { type Row } from "@/components/erp/resource";
import { Field, Select } from "@/components/ui/form";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, money } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface Deliverables {
  items: Row[];
  validated: number;
  invoices: { id: string; number: string; title: string; kind: string; status: string; total: string }[];
}

/** Onglet « Études et livrables » : livrables payants, validation client, facture d'études, remise après règlement. */
export function ProjectStudiesTab({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const data = useApi<Deliverables>(`/projects/${projectId}/deliverables`);
  const [invoiceId, setInvoiceId] = useState("");
  const [busy, setBusy] = useState(false);
  if (data.loading && !data.data) return <Skeleton className="h-64 w-full" />;
  if (!data.data) return <Alert tone="danger">{data.error}</Alert>;
  const d = data.data;
  const unlinked = d.items.filter((i) => !i.deliverable?.invoice_id).length;
  const delivered = d.items.filter((i) => i.deliverable && !i.deliverable.locked).length;
  return (
    <div className="space-y-5">
      <Alert tone="info" title="Les études d'abord">
        1. Déposez plans, rendus 3D et notes dans la <Link href={`/erp/ged?project=${projectId}`} className="underline">GED</Link>, publiez-les au client et cochez « Livrable d&apos;études payant ».
        2. Faites-les valider par le client (onglet Décisions : type « Plan », référence « Version de document »).
        3. Émettez la facture d&apos;études (Facturation, type « Études et conception ») et rattachez-y les livrables ci-dessous.
        4. Dès la facture réglée, les originaux sont remis au client (sans filigrane) ; le devis de travaux suit, sur ce même projet.
      </Alert>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Livrables d'études" value={d.items.length} tone="info" />
        <Stat label="Validés par le client" value={d.validated} />
        <Stat label="Sans facture d'études" value={unlinked} tone={unlinked ? "warning" : "neutral"} />
        <Stat label="Remis au client" value={delivered} tone="success" />
      </div>
      {can("documents:write") && d.items.length ? (
        <Card className="space-y-3 p-5">
          <p className="font-semibold">Rattacher les livrables à la facture d&apos;études</p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Facture d'études" className="min-w-[18rem] flex-1">
              <Select
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                options={[{ value: "", label: "Choisir une facture du projet" }, ...d.invoices.map((i) => ({ value: i.id, label: `${i.number} — ${i.title} (${optionLabel(i.kind)}, ${optionLabel(i.status)}, ${money(i.total)})` }))]}
              />
            </Field>
            <Button
              loading={busy}
              disabled={!invoiceId}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await api<{ linked: number }>(`/projects/${projectId}/deliverables/link-invoice`, { method: "POST", body: { invoice_id: invoiceId } });
                  toast.success("Livrables rattachés", `${res.linked} livrable(s) seront remis au règlement de la facture.`);
                  void data.reload();
                } catch (err) {
                  toast.error("Rattachement impossible", errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Rattacher les livrables sans facture
            </Button>
          </div>
          {!d.invoices.length ? <p className="text-sm text-muted">Aucune facture sur ce projet : créez d&apos;abord la facture d&apos;études dans Finance › Facturation.</p> : null}
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Livrables" subtitle="Aperçu filigrané pour le client tant que la facture liée n'est pas réglée." />
        {d.items.length ? (
          <ul className="divide-y divide-line text-sm">
            {d.items.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span>
                  <Link href={`/erp/ged/documents/${doc.id}`} className="font-medium text-brand-700 hover:underline">
                    {doc.title}
                  </Link>
                  <span className="block text-xs text-muted">
                    {optionLabel(doc.doc_type)} · {doc.published_version ? `publié ${doc.published_version.label}` : "non publié"} {doc.client_visible ? "· visible du client" : "· non visible du client"}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {doc.client_decision ? <StatusBadge status={doc.client_decision.status} /> : <Badge>Validation non demandée</Badge>}
                  {doc.deliverable?.invoice_number ? <Badge tone="info">Facture {doc.deliverable.invoice_number}</Badge> : <Badge tone="warning">Sans facture</Badge>}
                  {doc.deliverable?.locked ? (
                    <Badge tone="warning">
                      <Lock className="mr-1 inline h-3 w-3" /> Aperçu seulement
                    </Badge>
                  ) : (
                    <Badge tone="success">
                      <LockOpen className="mr-1 inline h-3 w-3" /> Remis {doc.deliverable?.delivered_at ? dateTime(doc.deliverable.delivered_at) : ""}
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState title="Aucun livrable d'études" text="Dans la GED, ouvrez un plan ou un rendu, « Propriétés », et cochez « Livrable d'études payant »." />
          </div>
        )}
      </Card>
    </div>
  );
}
