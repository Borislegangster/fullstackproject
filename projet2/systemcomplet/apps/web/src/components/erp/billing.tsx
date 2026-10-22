"use client";

import { AlertTriangle, CheckCircle2, Download, Gavel, Plus, RefreshCw, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { OutgoingPaymentForm } from "@/components/erp/finance";
import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { DisputeCreate, SubcontractorInvoices } from "@/components/erp/subcontracting";
import { RefSelect } from "@/components/forms/ref-select";
import { SchemaForm, type FieldConfig } from "@/components/forms/schema-form";
import { Checkbox, Field, FileDrop, Input, Select } from "@/components/ui/form";
import { Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, PageTitle, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage, newKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

const CLIENT_INVOICE_STATUSES = ["draft", "validated", "sent", "partially_paid", "overdue", "paid", "credited", "cancelled"];
const SUPPLIER_INVOICE_STATUSES = ["received", "matching", "matched", "exception", "approved_for_payment", "partially_paid", "paid", "disputed", "rejected"];
const FUNDS_CALL_STATUSES = ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"];
const INVOICE_KINDS = [
  { value: "invoice", label: "Facture" },
  { value: "deposit", label: "Acompte" },
  { value: "progress", label: "Situation / avancement" },
  { value: "final", label: "Décompte final" },
];

function PaymentsMini({ payments }: { payments?: Row[] }) {
  if (!payments?.length) return <p className="text-sm text-muted">Aucun règlement imputé.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {payments.map((p) => (
        <li key={p.id} className="flex justify-between gap-2">
          <span>
            <CellLink href={`/erp/finances/paiements/${p.id}`}>{p.number}</CellLink> · {optionLabel(p.method)} · {p.paid_at ? date(p.paid_at) : "non exécuté"}
          </span>
          <span className="flex items-center gap-2">
            <span className="tabular-nums">{money(p.allocated)}</span>
            <StatusBadge status={p.status} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------------------------- encaissements hors ligne */

/** Règlement reçu hors plateforme : saisi avec preuve, approuvé par une autre personne (Finances › Paiements). */
const RECEIPT_FIELDS: Record<string, FieldConfig> = {
  amount: { label: "Montant encaissé", help: "Paiement partiel possible, au plus le reste dû." },
  method: {
    label: "Mode de règlement",
    options: [
      { value: "bank_transfer", label: "Virement bancaire" },
      { value: "cheque", label: "Chèque" },
      { value: "cash", label: "Espèces" },
      { value: "mobile_money", label: "Mobile Money (dépôt direct, hors plateforme)" },
    ],
  },
  value_date: { label: "Date de valeur", help: "Crédit du compte, remise du chèque ou des espèces." },
  reference: { label: "Référence", help: "N° de virement, de chèque ou de transaction Mobile Money (facultatif pour les espèces) ; sert au rapprochement bancaire." },
  proof: { label: "Preuve de l'encaissement", help: "Avis de crédit, bordereau de remise, copie du chèque ou reçu Mobile Money (PDF ou image)." },
  notes: { label: "Notes" },
};
const RECEIPT_SUCCESS = "Encaissement enregistré : à approuver par une autre personne (Finances › Paiements)";

function receiptInitial(due: number): Row {
  return { method: "bank_transfer", value_date: new Date().toISOString().slice(0, 10), amount: due > 0 ? due : "" };
}

/* ----------------------------------------------------------------------------- factures clients */

/** Lien de paiement en un clic (A6) : copié pour être transmis au client (WhatsApp, SMS, e-mail). */
function usePayLink() {
  const toast = useToast();
  return (targetType: "client_invoice" | "funds_call", id: string) => {
    void (async () => {
      try {
        const res = await api<{ url: string; expires_at: string }>("/pay-links", { body: { target_type: targetType, target_id: id } });
        await navigator.clipboard?.writeText(res.url).catch(() => undefined);
        toast.success("Lien de paiement copié", `${res.url} — valable jusqu'au ${date(res.expires_at)}.`);
      } catch (err) {
        toast.error("Lien impossible", errorMessage(err));
      }
    })();
  };
}

export function ClientInvoicesList({ projectId }: { projectId?: string }) {
  const payLink = usePayLink();
  return (
    <ResourceView
      embedded
      config={{
        title: "Factures clients",
        subtitle: "Brouillon → validation → envoi (notification espace client) → règlement en ligne ou manuel → avoir éventuel.",
        path: "/client-invoices",
        query: { project_id: projectId },
        exportDataset: "client_invoices",
        columns: [
          { key: "number", label: "N°" },
          { key: "title", label: "Objet" },
          { key: "kind", label: "Type", render: (r) => INVOICE_KINDS.find((k) => k.value === r.kind)?.label ?? optionLabel(r.kind), hideOnMobile: true },
          { key: "issue_date", label: "Émise le", format: "date", sortable: true },
          { key: "due_date", label: "Échéance", format: "date" },
          { key: "total", label: "TTC", format: "money", align: "right", sortable: true },
          { key: "balance_due", label: "Reste dû", format: "money", align: "right" },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: CLIENT_INVOICE_STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) }],
        create: {
          endpoint: "POST /client-invoices",
          label: "Nouvelle facture",
          perms: ["billing:write"],
          fixed: projectId ? { project_id: projectId } : undefined,
          initial: { issue_date: new Date().toISOString().slice(0, 10), kind: "invoice", tax_rate: 19.25, currency: "XAF" },
          fields: {
            kind: { options: INVOICE_KINDS },
            organization_id: { ref: "clientOrganizations", label: "Client (organisation)" },
            contract_id: { ref: { path: "/crm/contracts", label: (r) => `${r.number ?? ""} ${r.title ?? ""}`.trim(), paginated: true, searchable: true }, label: "Contrat" },
            lines: { columns: ["designation", "unit", "quantity", "unit_price"] },
          },
        },
        detailPath: (r) => `/client-invoices/${r.id}`,
        detail: (r) => (
          <div className="space-y-4">
            <DescriptionList
              items={[
                { label: "Objet", value: r.title },
                { label: "Type", value: INVOICE_KINDS.find((k) => k.value === r.kind)?.label ?? r.kind },
                { label: "Émise / échéance", value: `${date(r.issue_date)} · ${date(r.due_date)}` },
                { label: "HT / TVA / TTC", value: `${money(r.subtotal)} / ${money(r.tax_amount)} / ${money(r.total)}` },
                { label: "Payé", value: money(r.amount_paid) },
                { label: "Reste dû", value: money(r.balance_due) },
                { label: "Envoyée le", value: r.sent_at ? dateTime(r.sent_at) : "—" },
                { label: "Statut", value: <StatusBadge status={r.status} /> },
              ]}
            />
            {r.pdf_file_id ? (
              <a href={apiUrl(`/client-invoices/${r.id}/pdf`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
                <Download className="h-4 w-4" /> Facture PDF
              </a>
            ) : null}
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-1">Désignation</th>
                  <th className="py-1 text-right">Qté</th>
                  <th className="py-1 text-right">PU</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {((r.lines ?? []) as Row[]).map((l) => (
                  <tr key={l.id}>
                    <td className="py-1">{l.designation}</td>
                    <td className="py-1 text-right tabular-nums">
                      {number(l.quantity, 2)} {l.unit}
                    </td>
                    <td className="py-1 text-right tabular-nums">{money(l.unit_price)}</td>
                    <td className="py-1 text-right tabular-nums">{money(l.total ?? toNumber(l.quantity) * toNumber(l.unit_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted">Règlements</p>
              <PaymentsMini payments={r.payments} />
            </div>
            {((r.reminders ?? []) as Row[]).length ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted">Relances</p>
                {(r.reminders as Row[]).map((m) => (
                  <p key={m.id} className="text-sm">
                    {dateTime(m.created_at)} · {optionLabel(m.stage.startsWith("manual") ? "manual_reminder" : m.stage)} · {money(m.amount_due)}
                  </p>
                ))}
              </div>
            ) : null}
            {((r.credit_notes ?? []) as Row[]).length ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted">Avoirs</p>
                {(r.credit_notes as Row[]).map((n) => (
                  <p key={n.id} className="text-sm">
                    {n.number} · {money(n.amount)} · {n.reason}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ),
        actions: [
          {
            key: "edit",
            label: "Modifier le brouillon",
            endpoint: "PATCH /client-invoices/{invoice_id}",
            when: (r) => r.status === "draft",
            perms: ["billing:write"],
            initial: (r) => ({
              title: r.title,
              issue_date: r.issue_date,
              due_date: r.due_date,
              tax_rate: r.tax_rate,
              notes: r.notes,
              lines: ((r.lines ?? []) as Row[]).map((l) => ({ designation: l.designation, unit: l.unit, quantity: l.quantity, unit_price: l.unit_price })),
            }),
            fields: { lines: { columns: ["designation", "unit", "quantity", "unit_price"] }, notes: { widget: "textarea" } },
            success: "Brouillon mis à jour",
          },
          { key: "validate", label: "Valider", path: (r) => `/client-invoices/${r.id}/validate`, when: (r) => r.status === "draft", perms: ["billing:validate"], confirm: "Valider cette facture ? Elle ne sera plus modifiable et son PDF sera généré.", success: "Facture validée" },
          { key: "send", label: "Envoyer au client", path: (r) => `/client-invoices/${r.id}/send`, when: (r) => r.status === "validated", perms: ["billing:write"], confirm: "Envoyer la facture ? Le client est notifié dans son espace et peut régler en ligne.", success: "Facture envoyée" },
          { key: "pdf", label: "PDF", when: (r) => !!r.pdf_file_id, run: (r) => window.open(apiUrl(`/client-invoices/${r.id}/pdf`), "_blank", "noopener") },
          {
            key: "remind",
            label: "Relancer le client",
            path: (r) => `/client-invoices/${r.id}/remind`,
            when: (r) => ["sent", "partially_paid", "overdue"].includes(r.status) && toNumber(r.balance_due) > 0,
            perms: ["billing:write"],
            confirm: "Envoyer une relance de paiement au client (espace client, e-mail, notification) ?",
            success: "Relance envoyée",
          },
          {
            key: "paylink",
            label: "Copier un lien de paiement",
            when: (r) => ["sent", "partially_paid", "overdue"].includes(r.status) && toNumber(r.balance_due) > 0,
            perms: ["billing:write"],
            run: (r) => payLink("client_invoice", String(r.id)),
          },
          {
            key: "receipt",
            label: "Enregistrer un encaissement",
            endpoint: "POST /client-invoices/{invoice_id}/payments",
            when: (r) => ["validated", "sent", "partially_paid", "overdue"].includes(r.status) && toNumber(r.balance_due) > 0,
            perms: ["finance:write", "billing:write"],
            tone: "accent",
            initial: (r) => receiptInitial(toNumber(r.balance_due)),
            fields: RECEIPT_FIELDS,
            success: RECEIPT_SUCCESS,
          },
          { key: "credit", label: "Émettre un avoir", endpoint: "POST /client-invoices/{invoice_id}/credit-notes", when: (r) => ["validated", "sent", "partially_paid", "overdue", "paid"].includes(r.status), perms: ["billing:validate"], tone: "danger", success: "Avoir émis" },
          { key: "cancel", label: "Annuler la facture", endpoint: "POST /client-invoices/{invoice_id}/cancel", when: (r) => ["draft", "validated"].includes(r.status), perms: ["billing:validate"], tone: "danger", fields: { reason: { widget: "textarea", label: "Motif de l'annulation" } }, success: "Facture annulée" },
        ],
      }}
    />
  );
}

/* ----------------------------------------------------------------------------- appels de fonds */

export function FundsCallsList({ projectId }: { projectId?: string }) {
  return (
    <ResourceView
      embedded
      config={{
        title: "Appels de fonds",
        subtitle: "Échéancier client lié aux jalons ; l'émission génère la facture et la notification de paiement. Règlement en ligne par le client ou encaissement hors ligne saisi ici.",
        path: "/funds-calls",
        query: { project_id: projectId },
        columns: [
          { key: "number", label: "N°" },
          { key: "label", label: "Libellé" },
          { key: "due_date", label: "Échéance", format: "date" },
          { key: "amount", label: "Montant", format: "money", align: "right" },
          { key: "amount_paid", label: "Encaissé", format: "money", align: "right" },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: FUNDS_CALL_STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) }],
        create: { endpoint: "POST /funds-calls", label: "Nouvel appel de fonds", perms: ["billing:write"], fixed: projectId ? { project_id: projectId } : undefined },
        detailPath: (r) => `/funds-calls/${r.id}`,
        detail: (r) => (
          <div className="space-y-4">
            <DescriptionList
              items={[
                { label: "Libellé", value: r.label },
                { label: "Échéance", value: date(r.due_date) },
                { label: "Montant appelé", value: money(r.amount) },
                { label: "Encaissé", value: money(r.amount_paid) },
                { label: "Reste dû", value: money(r.balance_due ?? toNumber(r.amount) - toNumber(r.amount_paid)) },
                ...(toNumber(r.pending_receipts) > 0 ? [{ label: "Encaissements à approuver", value: money(r.pending_receipts) }] : []),
                { label: "Statut", value: <StatusBadge status={r.status} /> },
              ]}
            />
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted">Règlements</p>
              <PaymentsMini payments={r.payments} />
            </div>
          </div>
        ),
        actions: [
          {
            key: "issue",
            label: "Émettre",
            path: (r) => `/funds-calls/${r.id}/issue`,
            when: (r) => r.status === "draft",
            perms: ["billing:write"],
            confirm: "Émettre l'appel de fonds ? Une facture d'acompte (TVA 19,25 %) est générée et le client est notifié.",
            body: () => ({ tax_rate: 19.25 }),
            success: "Appel de fonds émis",
          },
          {
            key: "receipt",
            label: "Enregistrer un encaissement",
            endpoint: "POST /funds-calls/{call_id}/payments",
            when: (r) => ["issued", "partially_paid", "overdue"].includes(r.status) && toNumber(r.amount) > toNumber(r.amount_paid),
            perms: ["finance:write", "billing:write"],
            tone: "accent",
            initial: (r) => receiptInitial(toNumber(r.amount) - toNumber(r.amount_paid) - toNumber(r.pending_receipts)),
            fields: RECEIPT_FIELDS,
            success: RECEIPT_SUCCESS,
          },
        ],
      }}
    />
  );
}

/* ----------------------------------------------------------------------------- factures fournisseurs */

interface InvoiceLineDraft {
  po_line_id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
}

/** Saisie d'une facture fournisseur pré-remplie depuis le bon de commande (quantités réceptionnées non facturées). */
export function SupplierInvoiceForm({ onDone, onCancel }: { onDone: (inv: Row) => void; onCancel: () => void }) {
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [poId, setPoId] = useState<string | null>(null);
  const [head, setHead] = useState({ supplier_reference: "", invoice_date: new Date().toISOString().slice(0, 10), due_date: "", tax_amount: "" });
  const [lines, setLines] = useState<InvoiceLineDraft[]>([{ po_line_id: null, description: "", quantity: "", unit_price: "" }]);
  const [file, setFile] = useState<File[]>([]);
  const [autoMatch, setAutoMatch] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newKey);
  const loadPo = async (id: string | null) => {
    setPoId(id);
    if (!id) return;
    try {
      const po = await api<Row>(`/procurement/orders/${id}`);
      const prefilled = ((po.lines ?? []) as Row[])
        .map((l) => {
          const base = toNumber(l.quantity_accepted) || toNumber(l.quantity_received) || toNumber(l.quantity);
          const remaining = Math.max(0, base - toNumber(l.quantity_invoiced));
          return { po_line_id: l.id as string, description: l.description as string, quantity: remaining ? String(remaining) : "", unit_price: String(toNumber(l.unit_price)) };
        })
        .filter((l) => l.quantity !== "");
      if (prefilled.length) setLines(prefilled);
      if (!supplierId && po.supplier_id) setSupplierId(po.supplier_id);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const subtotal = lines.reduce((s, l) => s + toNumber(l.quantity) * toNumber(l.unit_price), 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fournisseur" required>
          <RefSelect source={REFS.suppliers} value={supplierId} onChange={(v) => { setSupplierId(v); setPoId(null); }} />
        </Field>
        <Field label="Bon de commande" help="Le rapprochement 3 pièces (BC / réception / facture) s'appuie sur ce lien.">
          <RefSelect key={supplierId ?? "all"} source={{ ...REFS.purchaseOrders, query: supplierId ? { supplier_id: supplierId } : undefined }} value={poId} onChange={(v) => void loadPo(v)} />
        </Field>
        <Field label="N° de facture du fournisseur" required>
          <Input value={head.supplier_reference} onChange={(e) => setHead({ ...head, supplier_reference: e.target.value })} maxLength={80} />
        </Field>
        <Field label="Date de facture" required>
          <Input type="date" value={head.invoice_date} onChange={(e) => setHead({ ...head, invoice_date: e.target.value })} />
        </Field>
        <Field label="Échéance">
          <Input type="date" value={head.due_date} onChange={(e) => setHead({ ...head, due_date: e.target.value })} />
        </Field>
        <Field label="Montant de TVA">
          <Input type="number" min={0} step="any" value={head.tax_amount} onChange={(e) => setHead({ ...head, tax_amount: e.target.value })} />
        </Field>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="py-1">Désignation</th>
              <th className="py-1">Quantité</th>
              <th className="py-1">Prix unitaire HT</th>
              <th className="py-1 text-right">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <Input value={l.description} onChange={(e) => setLines((all) => all.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                  {l.po_line_id ? <span className="text-xs text-muted">Ligne du BC</span> : null}
                </td>
                <td className="py-1 pr-2">
                  <Input type="number" min={0} step="any" className="w-28" value={l.quantity} onChange={(e) => setLines((all) => all.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                </td>
                <td className="py-1 pr-2">
                  <Input type="number" min={0} step="any" className="w-36" value={l.unit_price} onChange={(e) => setLines((all) => all.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} />
                </td>
                <td className="py-1 text-right tabular-nums">{money(toNumber(l.quantity) * toNumber(l.unit_price))}</td>
                <td>
                  <button type="button" className="rounded p-1.5 text-muted hover:text-red-600" aria-label="Retirer la ligne" onClick={() => setLines((all) => all.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="secondary" onClick={() => setLines((all) => [...all, { po_line_id: null, description: "", quantity: "", unit_price: "" }])}>
          <Plus className="h-4 w-4" /> Ligne
        </Button>
        <p className="text-sm">
          HT <strong>{money(subtotal)}</strong> · TTC <strong>{money(subtotal + toNumber(head.tax_amount))}</strong>
        </p>
      </div>
      <Field label="Facture (PDF ou image)">
        <FileDrop files={file} onChange={setFile} accept=".pdf,image/*" maxSizeMb={20} />
      </Field>
      <Checkbox label="Lancer le rapprochement 3 pièces dès l'enregistrement" checked={autoMatch} onChange={setAutoMatch} />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={!supplierId || !head.supplier_reference || !head.invoice_date || !lines.some((l) => l.description && toNumber(l.quantity) > 0)}
          onClick={async () => {
            // Ligne commencée mais incomplète : signalée, jamais retirée en silence (une ligne vide est ignorée).
            const started = lines.filter((l) => l.description.trim() || toNumber(l.quantity) > 0 || toNumber(l.unit_price) > 0);
            const incomplete = started.findIndex((l) => !l.description.trim() || toNumber(l.quantity) <= 0);
            if (incomplete >= 0) {
              setError(`Ligne ${lines.indexOf(started[incomplete]) + 1} incomplète : désignation et quantité (supérieure à 0) obligatoires.`);
              return;
            }
            if (!started.length) {
              setError("Ajoutez au moins une ligne facturée (bouton « Ligne »).");
              return;
            }
            setBusy(true);
            setError(null);
            try {
              let fileId: string | null = null;
              if (file[0]) {
                const fd = new FormData();
                fd.append("file", file[0]);
                fileId = (await api<{ file_id: string }>("/supplier-invoices/upload", { method: "POST", form: fd })).file_id;
              }
              const inv = await api<Row>("/supplier-invoices", {
                method: "POST",
                idempotent: key,
                body: {
                  supplier_id: supplierId,
                  supplier_reference: head.supplier_reference.trim(),
                  purchase_order_id: poId,
                  invoice_date: head.invoice_date,
                  due_date: head.due_date || null,
                  tax_amount: toNumber(head.tax_amount),
                  file_id: fileId,
                  auto_match: autoMatch && !!poId,
                  lines: started.map((l) => ({ po_line_id: l.po_line_id, description: l.description, quantity: toNumber(l.quantity), unit_price: toNumber(l.unit_price) })),
                },
              });
              onDone(inv);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Enregistrer la facture
        </Button>
      </div>
    </div>
  );
}

export function SupplierInvoicesList({ status }: { status?: string }) {
  const { can } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <ResourceView
        embedded
        config={{
          title: "Factures fournisseurs",
          subtitle: "Rapprochement 3 pièces avec tolérances, arbitrage des anomalies, validation finance, paiement.",
          path: "/supplier-invoices",
          query: { status },
          exportDataset: "supplier_invoices",
          href: (r) => `/erp/facturation/fournisseurs/${r.id}`,
          columns: [
            { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/facturation/fournisseurs/${r.id}`}>{r.number}</CellLink> },
            { key: "supplier_reference", label: "Réf. fournisseur" },
            { key: "invoice_date", label: "Date", format: "date" },
            { key: "due_date", label: "Échéance", format: "date", hideOnMobile: true },
            { key: "total", label: "TTC", format: "money", align: "right" },
            { key: "amount_paid", label: "Payé", format: "money", align: "right", hideOnMobile: true },
            { key: "match_status", label: "3 pièces", render: (r) => (r.match_status ? <StatusBadge status={r.match_status} /> : "—") },
            { key: "status", label: "Statut", format: "status" },
          ],
          filters: [{ key: "status", label: "Statut", options: SUPPLIER_INVOICE_STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) }],
          toolbar: can("billing:write") ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Saisir une facture
            </Button>
          ) : undefined,
        }}
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="Facture fournisseur" size="xl">
        <SupplierInvoiceForm onCancel={() => setCreating(false)} onDone={(inv) => router.push(`/erp/facturation/fournisseurs/${inv.id}`)} />
      </Modal>
    </>
  );
}

export function SupplierInvoiceDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const invoice = useApi<Row>(`/supplier-invoices/${id}`);
  const [dialog, setDialog] = useState<null | "resolve" | "pay" | "dispute" | "credit">(null);
  const [busy, setBusy] = useState(false);
  if (invoice.loading && !invoice.data) return <Skeleton className="h-96 w-full" />;
  if (!invoice.data) return <Alert tone="danger">{invoice.error}</Alert>;
  const inv = invoice.data;
  const match = inv.match as Row | null;
  const outstanding = toNumber(inv.total) - toNumber(inv.amount_paid) - toNumber(inv.amount_credited);
  const run = async (path: string, message: string) => {
    setBusy(true);
    try {
      invoice.setData(await api<Row>(path, { method: "POST" }));
      void invoice.reload();
      toast.success(message);
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/facturation?onglet=fournisseurs" className="hover:underline">Factures fournisseurs</Link>}
        title={`${inv.number} — ${inv.supplier ?? ""}`}
        subtitle={`Réf. fournisseur ${inv.supplier_reference} · ${date(inv.invoice_date)}${inv.po_number ? ` · BC ${inv.po_number}` : ""} · source ${optionLabel(inv.source)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={inv.status} />
            {inv.file_id ? (
              <a href={apiUrl(`/supplier-invoices/${id}/file`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                <Download className="h-3.5 w-3.5" /> Facture
              </a>
            ) : null}
            {can("billing:write") && ["received", "exception", "matching"].includes(inv.status) && inv.purchase_order_id ? (
              <Button size="sm" variant="secondary" loading={busy} onClick={() => run(`/supplier-invoices/${id}/match`, "Rapprochement relancé")}>
                <RefreshCw className="h-4 w-4" /> Rapprocher
              </Button>
            ) : null}
            {can("finance:approve") && inv.status === "exception" ? (
              <Button size="sm" variant="accent" onClick={() => setDialog("resolve")}>
                <Gavel className="h-4 w-4" /> Arbitrer
              </Button>
            ) : null}
            {can("billing:validate") && inv.status === "matched" ? (
              <Button size="sm" loading={busy} onClick={() => run(`/supplier-invoices/${id}/validate`, "Facture validée : bon à payer")}>
                <CheckCircle2 className="h-4 w-4" /> Valider (bon à payer)
              </Button>
            ) : null}
            {can("finance:pay") && ["approved_for_payment", "partially_paid"].includes(inv.status) && outstanding > 0 ? (
              <Button size="sm" onClick={() => setDialog("pay")}>
                <Wallet className="h-4 w-4" /> Payer
              </Button>
            ) : null}
            {can("billing:validate") && !["rejected", "paid"].includes(inv.status) && outstanding > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setDialog("credit")}>
                Avoir fournisseur
              </Button>
            ) : null}
            {can("disputes:write") && !["paid", "rejected", "disputed"].includes(inv.status) ? (
              <Button size="sm" variant="ghost" onClick={() => setDialog("dispute")}>
                Ouvrir un litige
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total TTC" value={money(inv.total)} hint={`HT ${money(inv.subtotal)} · TVA ${money(inv.tax_amount)}`} tone="info" />
        <Stat label="Payé" value={money(inv.amount_paid)} hint={toNumber(inv.amount_credited) ? `Avoirs ${money(inv.amount_credited)}` : undefined} />
        <Stat label="Reste à payer" value={money(outstanding)} tone={outstanding > 0 ? "warning" : "success"} hint={`Échéance ${date(inv.due_date)}`} />
        <Stat label="Gelé (litige)" value={money(inv.amount_frozen)} tone={toNumber(inv.amount_frozen) > 0 ? "danger" : "neutral"} />
      </div>
      {match ? (
        <Card>
          <CardHeader
            title="Rapprochement 3 pièces"
            subtitle={`Tolérances : quantités ${number(match.tolerance_qty_pct, 1)} % · prix ${number(match.tolerance_price_pct, 1)} % — ${dateTime(match.created_at)}`}
            actions={match.result === "matched" ? <Badge tone="success">Conforme</Badge> : <Badge tone="danger">Anomalies</Badge>}
          />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Stat label="Bon de commande HT" value={money(match.po_total)} />
            <Stat label="Réceptionné accepté HT" value={money(match.received_total)} />
            <Stat label="Facturé HT" value={money(match.invoice_total)} tone={toNumber(match.invoice_total) > toNumber(match.po_total) ? "danger" : "neutral"} />
          </div>
          {((match.line_results ?? []) as Row[]).length ? (
            <div className="overflow-x-auto border-t border-line">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Ligne</th>
                    <th className="px-3 py-2 text-right">Commandé</th>
                    <th className="px-3 py-2 text-right">Reçu accepté</th>
                    <th className="px-3 py-2 text-right">Facturé (cumul)</th>
                    <th className="px-3 py-2 text-right">PU BC</th>
                    <th className="px-3 py-2 text-right">PU facture</th>
                    <th className="px-3 py-2">Contrôle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(match.line_results as Row[]).map((l, i) => (
                    <tr key={l.po_line_id ?? i} className={l.status !== "ok" ? "bg-red-50/60" : ""}>
                      <td className="px-3 py-1.5">{l.description}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{number(l.ordered, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{number(l.received, 2)}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${l.status === "qty_exceeds_received" ? "font-semibold text-red-700" : ""}`}>{number(l.invoiced, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{money(l.po_price)}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${l.status === "price_variance" ? "font-semibold text-red-700" : ""}`}>{money(l.invoice_price)}</td>
                      <td className="px-3 py-1.5">{l.status === "ok" ? <Badge tone="success">OK</Badge> : <Badge tone="danger">{l.status === "price_variance" ? "Écart de prix" : "Quantité > reçu"}</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {((match.exceptions ?? []) as Row[]).length ? (
            <ul className="space-y-1 border-t border-line px-5 py-3 text-sm">
              {(match.exceptions as Row[]).map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {optionLabel(e.type)} {e.line ? `— ${e.line}` : ""} {e.message ? `: ${e.message}` : ""}
                    {e.invoiced ? ` (facturé ${e.invoiced} / reçu ${e.received})` : ""}
                    {e.invoice_price ? ` (PU facture ${money(e.invoice_price)} / BC ${money(e.po_price)})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {match.resolution ? <p className="border-t border-line px-5 py-3 text-sm">Arbitrage du {dateTime(match.resolved_at)} : {match.resolution}</p> : null}
        </Card>
      ) : inv.purchase_order_id ? (
        <Alert tone="warning">Rapprochement non encore effectué.</Alert>
      ) : (
        <Alert tone="warning" title="Facture sans bon de commande">
          Le contrôle 3 pièces est impossible : la facture doit être arbitrée par la finance avant tout paiement.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Lignes facturées" />
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Désignation</th>
                <th className="px-3 py-2 text-right">Qté</th>
                <th className="px-3 py-2 text-right">PU</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {((inv.lines ?? []) as Row[]).map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-1.5">{l.description}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{number(l.quantity, 2)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(l.unit_price)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Règlements" />
          <div className="p-5">
            <PaymentsMini payments={inv.payments} />
            {inv.validated_at ? <p className="mt-3 text-xs text-muted">Validée par la finance le {dateTime(inv.validated_at)}</p> : null}
          </div>
        </Card>
      </div>

      <Modal open={dialog === "resolve"} onClose={() => setDialog(null)} title="Arbitrage de l'anomalie">
        <SchemaForm
          endpoint="POST /supplier-invoices/{invoice_id}/resolve"
          params={{ invoice_id: id }}
          fields={{
            decision: {
              options: [
                { value: "accept", label: "Accepter (dérogation tracée)" },
                { value: "reject", label: "Rejeter la facture" },
              ],
            },
            justification: { widget: "textarea" },
          }}
          onCancel={() => setDialog(null)}
          onSuccess={(res: Row) => {
            invoice.setData(res);
            void invoice.reload();
            setDialog(null);
          }}
          columns={1}
        />
      </Modal>
      <Modal open={dialog === "pay"} onClose={() => setDialog(null)} title="Ordre de paiement" size="lg">
        <OutgoingPaymentForm initial={{ target_type: "supplier_invoice", target_id: id, amount: outstanding, label: inv.number }} onCancel={() => setDialog(null)} onDone={(p) => router.push(`/erp/finances/paiements/${p.id}`)} />
      </Modal>
      <Modal open={dialog === "credit"} onClose={() => setDialog(null)} title="Avoir fournisseur" description={`Reste à payer : ${money(outstanding)}`}>
        <SchemaForm
          endpoint="POST /supplier-invoices/{invoice_id}/credit-notes"
          params={{ invoice_id: id }}
          fields={{ reason: { widget: "textarea", label: "Motif (retour, écart de prix ou de quantité…)" }, supplier_reference: { label: "N° d'avoir du fournisseur" } }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            void invoice.reload();
            setDialog(null);
            toast.success("Avoir imputé", "Le reste à payer est réduit d'autant.");
          }}
          columns={1}
        />
      </Modal>
      <Modal open={dialog === "dispute"} onClose={() => setDialog(null)} title="Ouvrir un litige fournisseur" size="lg">
        <DisputeCreate
          initial={{ party_type: "supplier", party_id: inv.supplier_id, related_type: "supplier_invoice", related_id: id, project_id: inv.project_id ?? null, title: `Contestation facture ${inv.supplier_reference}`, amount_disputed: String(outstanding) }}
          onCancel={() => setDialog(null)}
          onCreated={(d) => router.push(`/erp/litiges/${d.id}`)}
        />
      </Modal>
    </div>
  );
}

export function CreditNotesList() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Avoirs",
        path: "/credit-notes",
        columns: [
          { key: "number", label: "N°" },
          { key: "side", label: "Côté", render: (r) => (r.side === "client" ? "Client" : "Fournisseur") },
          { key: "issue_date", label: "Date", format: "date" },
          { key: "amount", label: "Montant", format: "money", align: "right" },
          { key: "reason", label: "Motif" },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [
          {
            key: "side",
            label: "Côté",
            options: [
              { value: "client", label: "Clients" },
              { value: "supplier", label: "Fournisseurs" },
            ],
          },
        ],
      }}
    />
  );
}

const AGING_COLUMNS: { key: string; label: string }[] = [
  { key: "not_due", label: "Non échu" },
  { key: "d1_30", label: "1–30 j" },
  { key: "d31_60", label: "31–60 j" },
  { key: "d61_90", label: "61–90 j" },
  { key: "d90_plus", label: "+ 90 j" },
];

function AgingTable({ side }: { side: "client" | "supplier" }) {
  const aging = useApi<Row>("/billing/aging", { side });
  if (aging.loading && !aging.data) return <Skeleton className="h-48 w-full" />;
  if (!aging.data) return <Alert tone="danger">{aging.error}</Alert>;
  const totals = aging.data.totals as Row;
  return (
    <Card>
      <CardHeader title={side === "client" ? "Créances clients" : "Dettes fournisseurs"} subtitle={`Reste dû par ancienneté au ${date(aging.data.as_of)}`} />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">{side === "client" ? "Client" : "Fournisseur"}</th>
              {AGING_COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {((aging.data.rows ?? []) as Row[]).map((r) => (
              <tr key={r.party_id ?? "none"}>
                <td className="px-3 py-1.5">{r.party}</td>
                {AGING_COLUMNS.map((c) => (
                  <td key={c.key} className={`px-3 py-1.5 text-right tabular-nums ${c.key !== "not_due" && toNumber(r[c.key]) > 0 ? "font-semibold text-red-700" : ""}`}>
                    {toNumber(r[c.key]) ? money(r[c.key]) : "—"}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{money(r.total)}</td>
              </tr>
            ))}
            {!((aging.data.rows ?? []) as Row[]).length ? (
              <tr>
                <td colSpan={AGING_COLUMNS.length + 2} className="px-3 py-4 text-center text-muted">
                  Aucun montant en attente.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className="px-3 py-2">Total</td>
              {AGING_COLUMNS.map((c) => (
                <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                  {money(totals[c.key])}
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums">{money(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function BillingKpis() {
  const kpis = useApi<Row>("/billing/summary");
  const k = kpis.data;
  if (!k) return kpis.loading ? <Skeleton className="h-24 w-full" /> : null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Facturé ce mois" value={money(k.issued_this_month)} hint={`Encaissé ${money(k.collected_this_month)}`} tone="info" />
      <Stat label="Créances clients" value={money(k.receivables)} hint={k.overdue_count ? `${k.overdue_count} en retard · ${money(k.overdue_amount)}` : "Aucun retard"} tone={k.overdue_count ? "warning" : "success"} />
      <Stat label="Dettes fournisseurs" value={money(k.supplier_payables)} hint={`${k.supplier_to_validate} facture(s) à valider`} />
      <Stat label="Factures en anomalie" value={k.supplier_exceptions} hint="Rapprochement 3 pièces" tone={k.supplier_exceptions ? "danger" : "neutral"} />
    </div>
  );
}

function ExportJournal() {
  const { can } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const first = `${today.slice(0, 8)}01`;
  const [period, setPeriod] = useState({ kind: "client", date_from: first, date_to: today });
  if (!can("reports:export")) return null;
  return (
    <Card className="flex flex-wrap items-end gap-3 p-4">
      <Field label="Journal">
        <Select
          value={period.kind}
          onChange={(e) => setPeriod({ ...period, kind: e.target.value })}
          options={[
            { value: "client", label: "Ventes (factures clients)" },
            { value: "supplier", label: "Achats (factures fournisseurs)" },
          ]}
        />
      </Field>
      <Field label="Du">
        <Input type="date" value={period.date_from} onChange={(e) => setPeriod({ ...period, date_from: e.target.value })} />
      </Field>
      <Field label="Au">
        <Input type="date" value={period.date_to} onChange={(e) => setPeriod({ ...period, date_to: e.target.value })} />
      </Field>
      <a href={apiUrl("/billing/export", period)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
        <Download className="h-4 w-4" /> Export comptable (CSV)
      </a>
    </Card>
  );
}

export function BillingHub({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  return (
    <div className="space-y-5">
      <PageTitle title="Facturation" subtitle="Clients (appels de fonds, factures, avoirs, relances) et fournisseurs / sous-traitants (3 pièces, validation, bon à payer)." />
      <BillingKpis />
      <Tabs
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "clients", label: "Factures clients" },
          { key: "appels", label: "Appels de fonds" },
          { key: "fournisseurs", label: "Factures fournisseurs" },
          { key: "anomalies", label: "Anomalies 3 pièces" },
          { key: "sous-traitants", label: "Factures sous-traitants" },
          { key: "avoirs", label: "Avoirs" },
          { key: "balance", label: "Balance âgée" },
          { key: "export", label: "Export comptable" },
        ]}
      />
      {tab === "clients" ? <ClientInvoicesList /> : null}
      {tab === "appels" ? <FundsCallsList /> : null}
      {tab === "fournisseurs" ? <SupplierInvoicesList /> : null}
      {tab === "anomalies" ? <SupplierInvoicesList status="exception" /> : null}
      {tab === "sous-traitants" ? <SubcontractorInvoices /> : null}
      {tab === "avoirs" ? <CreditNotesList /> : null}
      {tab === "balance" ? (
        <div className="space-y-6">
          <AgingTable side="client" />
          <AgingTable side="supplier" />
        </div>
      ) : null}
      {tab === "export" ? <ExportJournal /> : null}
    </div>
  );
}
