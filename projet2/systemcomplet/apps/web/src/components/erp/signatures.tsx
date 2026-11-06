"use client";

import { ExternalLink, FileSignature, RotateCcw, Stamp, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { type Column, DataTable } from "@/components/ui/data-table";
import { FileDrop } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { Alert, Button, Card, CardHeader, PageTitle, Skeleton } from "@/components/ui/primitives";
import { PartyBadge, SignDocumentDialog, type PartyState, type SignableDocument } from "@/components/signatures/sign-document";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, money } from "@/lib/format";
import { useApi, useList } from "@/lib/hooks";

type Row = {
  id: string;
  kind: string;
  kind_label: string;
  entity_id: string;
  reference: string | null;
  title: string | null;
  party_name: string | null;
  amount: string | null;
  currency: string | null;
  issued_on: string | null;
  erp_link: string;
  parties: PartyState[];
  available: boolean;
};

const KINDS = [
  { value: "quote", label: "Devis" },
  { value: "contract", label: "Contrats" },
  { value: "invoice", label: "Factures" },
  { value: "proforma", label: "Factures proforma" },
  { value: "credit_note", label: "Factures d'avoir" },
  { value: "receipt", label: "Reçus de paiement" },
  { value: "payment_notice", label: "Avis de paiement" },
  { value: "purchase_order", label: "Bons de commande" },
  { value: "subcontract", label: "Marchés de sous-traitance" },
  { value: "payslip", label: "Bulletins de paie" },
  { value: "executive_report", label: "Rapports de direction" },
  { value: "building_passport", label: "Passeports du bâtiment" },
];

const STATES = [
  { value: "to_sign", label: "À signer par l'entreprise" },
  { value: "signed", label: "Signés par l'entreprise" },
  { value: "all", label: "Tous les documents" },
];

/** Signatures : tous les documents émis par la plateforme, à signer (signature manuscrite + cachet) au nom de
 * l'entreprise ; cachet de l'entreprise apposé sur chaque document. */
export function SignaturesView() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList<Row>("/signatures/documents", { filters: { state: "to_sign" } });
  const [doc, setDoc] = useState<SignableDocument | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const openSign = async (row: Row) => {
    setOpening(row.id);
    try {
      setDoc(await api<SignableDocument>(`/signatures/${row.kind}/${row.entity_id}`));
    } catch (err) {
      toast.error("Document indisponible", errorMessage(err));
    } finally {
      setOpening(null);
    }
  };

  const columns: Column<Row>[] = [
    { key: "kind_label", label: "Document" },
    {
      key: "reference",
      label: "Référence",
      render: (r) => (
        <span>
          <span className="font-semibold text-ink">{r.reference ?? "—"}</span>
          {r.title ? <span className="block text-xs text-muted">{r.title}</span> : null}
        </span>
      ),
    },
    { key: "party_name", label: "Destinataire", hideOnMobile: true },
    { key: "issued_on", label: "Émis le", render: (r) => date(r.issued_on), hideOnMobile: true },
    { key: "amount", label: "Montant", align: "right", render: (r) => (r.amount ? money(r.amount, r.currency === "XAF" || !r.currency ? "FCFA" : r.currency) : "—"), hideOnMobile: true },
    {
      key: "company",
      label: "Entreprise",
      render: (r) => {
        const p = r.parties.find((x) => x.party === "company");
        return p ? <PartyBadge state={p} /> : "—";
      },
    },
    {
      key: "client",
      label: "Client",
      render: (r) => {
        const p = r.parties.find((x) => x.party === "client");
        return p ? <PartyBadge state={p} /> : <span className="text-xs text-muted">—</span>;
      },
      hideOnMobile: true,
    },
  ];

  return (
    <div className="space-y-5">
      <PageTitle
        title="Signatures"
        subtitle="Signez à la main (souris, doigt ou stylet) les documents émis par la plateforme, puis validez par code : votre signature est apposée sur le cachet de l'entreprise."
      />
      {can("settings:read") ? <StampCard /> : null}
      <DataTable
        columns={columns}
        list={list}
        filters={[
          { key: "state", label: "Statut", options: STATES },
          { key: "kind", label: "Type de document", options: KINDS },
        ]}
        empty={{ title: "Aucun document", text: "Les devis, contrats, factures, reçus et rapports apparaissent ici dès leur première édition." }}
        rowActions={(r) => (
          <div className="flex justify-end gap-1.5">
            <a href={apiUrl(`/signatures/${r.kind}/${r.entity_id}/pdf`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
              <ExternalLink className="h-3.5 w-3.5" /> PDF
            </a>
            {r.available ? (
              <Link href={r.erp_link} className="inline-flex h-8 items-center rounded-xl px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                Ouvrir
              </Link>
            ) : null}
            {r.available && !r.parties.find((p) => p.party === "company")?.signed ? (
              <Button size="sm" loading={opening === r.id} onClick={() => void openSign(r)}>
                <FileSignature className="h-4 w-4" /> Signer
              </Button>
            ) : null}
          </div>
        )}
      />
      <SignDocumentDialog
        open={doc !== null}
        onClose={() => setDoc(null)}
        doc={doc}
        party="company"
        onSigned={() => {
          setDoc(null);
          void list.reload();
        }}
      />
    </div>
  );
}

type StampState = { custom: boolean; updated_at: string | null; original_name: string | null; image: string };

/** Cachet de l'entreprise : aperçu (fond transparent), remplacement par une photo ou un scan, retour au cachet officiel. */
function StampCard() {
  const { can } = useAuth();
  const toast = useToast();
  const stamp = useApi<StampState>("/signatures/stamp");
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  if (stamp.loading && !stamp.data) return <Skeleton className="h-32 w-full" />;
  if (!stamp.data) return null;
  const upload = async () => {
    if (!files[0]) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", files[0]);
      stamp.setData(await api<StampState>("/signatures/stamp", { method: "POST", form }));
      toast.success("Cachet mis à jour", "Le fond a été retiré ; le nouveau cachet est apposé sur les prochains documents.");
      setOpen(false);
      setFiles([]);
    } catch (err) {
      toast.error("Cachet refusé", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader
        title="Cachet de l'entreprise"
        subtitle={stamp.data.custom ? `Cachet déposé (${stamp.data.original_name ?? "image"}).` : "Cachet officiel GLOBUS ENGINEERING, apposé sur tous les documents."}
        actions={
          can("settings:write") ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
                <Upload className="h-4 w-4" /> Remplacer le cachet
              </Button>
              {stamp.data.custom ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
                  <RotateCcw className="h-4 w-4" /> Cachet officiel
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />
      <div className="flex items-center gap-5 px-5 pb-5">
        <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-2xl bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px] ring-1 ring-line">
          <img src={stamp.data.image} alt="Cachet de l'entreprise (fond transparent)" className="max-h-32 max-w-32 -rotate-6 object-contain" />
        </div>
        <p className="text-sm text-muted">
          <Stamp className="mr-1 inline h-4 w-4 text-brand-600" />
          Le cachet, au fond transparent, est apposé dans le bloc « GLOBUS ENGINEERING » de chaque devis, contrat, facture, reçu, bon de commande, marché, bulletin et rapport. La signature manuscrite de la personne qui signe pour l&apos;entreprise vient par-dessus.
        </p>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Remplacer le cachet"
        description="Photo ou scan du cachet sur papier blanc : le fond est retiré automatiquement."
        footer={
          <Button onClick={upload} loading={busy} disabled={!files.length}>
            <Upload className="h-4 w-4" /> Enregistrer le cachet
          </Button>
        }
      >
        <div className="space-y-3">
          <FileDrop files={files} onChange={setFiles} accept="image/png,image/jpeg,image/webp" maxSizeMb={12} label="Déposez la photo du cachet ou cliquez pour parcourir" />
          <Alert tone="info">Cadrez le cachet seul, à plat et bien éclairé ; l&apos;encre est conservée dans sa couleur d&apos;origine.</Alert>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Revenir au cachet officiel ?"
        text="Le cachet déposé est remplacé par le cachet officiel livré avec la plateforme sur les prochains documents."
        confirmLabel="Revenir au cachet officiel"
        onConfirm={async () => {
          stamp.setData(await api<StampState>("/signatures/stamp", { method: "DELETE" }));
          toast.success("Cachet officiel rétabli");
        }}
      />
    </Card>
  );
}
