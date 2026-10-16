"use client";

import { CheckCircle2, Download, FileUp, MessageSquareReply, Truck, XCircle } from "lucide-react";
import { useState } from "react";

import { Field, FileDrop, Input, Textarea } from "@/components/ui/form";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, StatusBadge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlay";
import { api, errorMessage } from "@/lib/api";
import { date, dateTime, money, number, toNumber } from "@/lib/format";
import { optionLabel } from "@/lib/labels";

export interface SupplierOrder {
  id?: string;
  number: string;
  status: string;
  currency: string;
  subtotal: string;
  tax_amount: string;
  total: string;
  expected_date?: string | null;
  urgent: boolean;
  payment_terms?: string | null;
  delivery_address?: string | null;
  notes?: string | null;
  supplier: string;
  project: string;
  site?: string | null;
  sent_at?: string | null;
  supplier_response?: string | null;
  counter_offer?: { lines?: { line_id: string; unit_price?: string; quantity?: string }[]; expected_date?: string; message?: string } | null;
  eta?: string | null;
  lines: { id: string; reference?: string | null; description: string; quantity: string; unit: string; unit_price: string; total: string; received: string; accepted: string; invoiced: string }[];
  deliveries: { number: string; status: string; eta?: string | null; carrier?: string | null; tracking_ref?: string | null }[];
  invoices: { reference: string; status: string; total: string; amount_paid: string }[];
  actions: { respond: boolean; ship: boolean; invoice: boolean };
}

export interface SupplierOrderEndpoints {
  respond: string;
  shipment: string;
  invoice: string;
  pdf: string;
}

/** Vue fournisseur d'un bon de commande (portail sécurisé par lien ou extranet) : réponse, expédition, facture. */
export function SupplierOrderView({
  order,
  endpoints,
  onUpdated,
  refresh,
}: {
  order: SupplierOrder;
  endpoints: SupplierOrderEndpoints;
  onUpdated: (o: SupplierOrder) => void;
  refresh: () => Promise<SupplierOrder>;
}) {
  const cur = order.currency === "XAF" ? "FCFA" : order.currency;
  const [dialog, setDialog] = useState<null | "confirm" | "refuse" | "counter" | "ship" | "invoice">(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [contactName, setContactName] = useState("");
  const [counter, setCounter] = useState<Record<string, { unit_price: string; quantity: string }>>({});
  const [counterDate, setCounterDate] = useState("");
  const [ship, setShip] = useState({ eta: "", carrier: "", tracking_ref: "", vehicle_plate: "", driver_name: "", driver_phone: "", delivery_note_ref: "" });
  const [inv, setInv] = useState({ supplier_reference: "", invoice_date: new Date().toISOString().slice(0, 10), due_date: "", tax_amount: "0" });
  const [invLines, setInvLines] = useState<Record<string, { quantity: string; unit_price: string }>>({});
  const [files, setFiles] = useState<File[]>([]);

  const run = async (fn: () => Promise<SupplierOrder>) => {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await fn());
      setDialog(null);
      setNote("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const respond = (action: "confirm" | "refuse" | "counter") =>
    run(() =>
      api<SupplierOrder>(endpoints.respond, {
        method: "POST",
        body: {
          action,
          note: note || null,
          contact_name: contactName || null,
          counter:
            action === "counter"
              ? {
                  lines: Object.entries(counter)
                    .filter(([, v]) => v.unit_price || v.quantity)
                    .map(([line_id, v]) => ({ line_id, unit_price: v.unit_price || null, quantity: v.quantity || null })),
                  expected_date: counterDate || null,
                  message: note || null,
                }
              : null,
        },
      }),
    );

  const invoiceLines = order.lines
    .map((l) => {
      const draft = invLines[l.id];
      const remaining = Math.max(0, toNumber(l.accepted) - toNumber(l.invoiced));
      return { line: l, quantity: draft?.quantity ?? (remaining ? String(remaining) : ""), unit_price: draft?.unit_price ?? l.unit_price };
    })
    .filter((x) => toNumber(x.quantity) > 0);
  const invoiceTotal = invoiceLines.reduce((s, x) => s + toNumber(x.quantity) * toNumber(x.unit_price), 0) + toNumber(inv.tax_amount);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Bon de commande</p>
          <h1 className="text-3xl font-bold text-brand-800">{order.number}</h1>
          <p className="mt-1 text-sm text-muted">
            {order.project}
            {order.site ? ` · ${order.site}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {order.urgent ? <Badge tone="danger">Urgent</Badge> : null}
          <StatusBadge status={order.status} />
          <a href={endpoints.pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
            <Download className="h-4 w-4" /> PDF
          </a>
        </div>
      </div>

      {order.actions.respond || order.actions.ship || order.actions.invoice ? (
        <Card className="flex flex-wrap gap-2 p-4">
          {order.actions.respond ? (
            <>
              <Button onClick={() => setDialog("confirm")}>
                <CheckCircle2 className="h-4 w-4" /> Confirmer la commande
              </Button>
              <Button variant="secondary" onClick={() => setDialog("counter")}>
                <MessageSquareReply className="h-4 w-4" /> Proposer une contre-offre
              </Button>
              <Button variant="danger" onClick={() => setDialog("refuse")}>
                <XCircle className="h-4 w-4" /> Refuser
              </Button>
            </>
          ) : null}
          {order.actions.ship ? (
            <Button variant="accent" onClick={() => setDialog("ship")}>
              <Truck className="h-4 w-4" /> Annoncer une expédition
            </Button>
          ) : null}
          {order.actions.invoice ? (
            <Button variant="secondary" onClick={() => setDialog("invoice")}>
              <FileUp className="h-4 w-4" /> Déposer une facture
            </Button>
          ) : null}
        </Card>
      ) : null}

      <Card className="p-5">
        <DescriptionList
          columns={3}
          items={[
            { label: "Client", value: "GLOBUS ENGINEERING" },
            { label: "Date d'envoi", value: dateTime(order.sent_at) },
            { label: "Livraison souhaitée", value: date(order.expected_date) },
            { label: "Adresse de livraison", value: order.delivery_address },
            { label: "Conditions de paiement", value: order.payment_terms },
            { label: "Arrivée annoncée", value: dateTime(order.eta) },
          ]}
        />
        {order.notes ? <p className="mt-4 whitespace-pre-line rounded-xl bg-surface p-3 text-sm text-ink">{order.notes}</p> : null}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Articles commandés" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Article</th>
                <th className="px-4 py-2.5 text-right">Qté</th>
                <th className="px-4 py-2.5 text-right">Prix unitaire</th>
                <th className="px-4 py-2.5 text-right">Total HT</th>
                <th className="px-4 py-2.5 text-right">Reçu</th>
                <th className="px-4 py-2.5 text-right">Facturé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {order.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{l.description}</p>
                    {l.reference ? <p className="text-xs text-muted">Réf. {l.reference}</p> : null}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {number(l.quantity, 2)} {l.unit}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(l.unit_price, cur)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(l.total, cur)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{number(l.received, 2)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{number(l.invoiced, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto max-w-xs space-y-1 border-t border-line p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Total HT</dt>
            <dd>{money(order.subtotal, cur)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">TVA</dt>
            <dd>{money(order.tax_amount, cur)}</dd>
          </div>
          <div className="flex justify-between font-bold text-brand-800">
            <dt>Total TTC</dt>
            <dd>{money(order.total, cur)}</dd>
          </div>
        </dl>
      </Card>

      {order.counter_offer ? (
        <Alert tone="warning" title="Contre-offre transmise">
          {order.counter_offer.message ?? "Votre proposition est en cours d'examen par GLOBUS."}
          {order.counter_offer.expected_date ? ` Date proposée : ${date(order.counter_offer.expected_date)}.` : ""}
        </Alert>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Livraisons" />
          {order.deliveries.length ? (
            <ul className="divide-y divide-line">
              {order.deliveries.map((d) => (
                <li key={d.number} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    {d.number}
                    <span className="block text-xs text-muted">
                      {[d.carrier, d.tracking_ref, d.eta ? `ETA ${dateTime(d.eta)}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">Aucune expédition annoncée.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Factures" />
          {order.invoices.length ? (
            <ul className="divide-y divide-line">
              {order.invoices.map((i) => (
                <li key={i.reference} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    {i.reference}
                    <span className="block text-xs text-muted">
                      {money(i.total, cur)} · payé {money(i.amount_paid, cur)}
                    </span>
                  </span>
                  <StatusBadge status={i.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">Aucune facture déposée.</p>
          )}
        </Card>
      </div>

      <Modal
        open={dialog === "confirm" || dialog === "refuse"}
        onClose={() => setDialog(null)}
        title={dialog === "confirm" ? "Confirmer la commande" : "Refuser la commande"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Annuler
            </Button>
            <Button variant={dialog === "refuse" ? "danger" : "primary"} loading={busy} disabled={dialog === "refuse" && note.trim().length < 3} onClick={() => respond(dialog as "confirm" | "refuse")}>
              {dialog === "confirm" ? "Confirmer" : "Refuser"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Votre nom">
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </Field>
          <Field label={dialog === "refuse" ? "Motif du refus" : "Commentaire (facultatif)"} required={dialog === "refuse"}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </Field>
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>
      </Modal>

      <Modal
        open={dialog === "counter"}
        onClose={() => setDialog(null)}
        title="Proposer une contre-offre"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Annuler
            </Button>
            <Button loading={busy} onClick={() => respond("counter")}>
              Envoyer la contre-offre
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">Indiquez uniquement les prix ou quantités que vous proposez de modifier.</p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Article</th>
                  <th className="px-3 py-2 text-left">Prix unitaire proposé</th>
                  <th className="px-3 py-2 text-left">Quantité proposée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {order.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      {l.description}
                      <span className="block text-xs text-muted">
                        {number(l.quantity, 2)} {l.unit} × {money(l.unit_price, cur)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={0} value={counter[l.id]?.unit_price ?? ""} onChange={(e) => setCounter((c) => ({ ...c, [l.id]: { unit_price: e.target.value, quantity: c[l.id]?.quantity ?? "" } }))} />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={0} value={counter[l.id]?.quantity ?? ""} onChange={(e) => setCounter((c) => ({ ...c, [l.id]: { quantity: e.target.value, unit_price: c[l.id]?.unit_price ?? "" } }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date de livraison proposée">
              <Input type="date" value={counterDate} onChange={(e) => setCounterDate(e.target.value)} />
            </Field>
            <Field label="Votre nom">
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </Field>
          </div>
          <Field label="Message">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </Field>
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>
      </Modal>

      <Modal
        open={dialog === "ship"}
        onClose={() => setDialog(null)}
        title="Annoncer une expédition"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Annuler
            </Button>
            <Button
              variant="accent"
              loading={busy}
              disabled={!ship.eta}
              onClick={() =>
                run(() =>
                  api<SupplierOrder>(endpoints.shipment, {
                    method: "POST",
                    body: Object.fromEntries(Object.entries({ ...ship, eta: ship.eta ? new Date(ship.eta).toISOString() : "" }).map(([k, v]) => [k, v || null])),
                  }),
                )
              }
            >
              Annoncer
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Arrivée estimée" required className="sm:col-span-2">
            <Input type="datetime-local" value={ship.eta} onChange={(e) => setShip({ ...ship, eta: e.target.value })} />
          </Field>
          <Field label="Transporteur">
            <Input value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} />
          </Field>
          <Field label="N° de suivi">
            <Input value={ship.tracking_ref} onChange={(e) => setShip({ ...ship, tracking_ref: e.target.value })} />
          </Field>
          <Field label="Immatriculation">
            <Input value={ship.vehicle_plate} onChange={(e) => setShip({ ...ship, vehicle_plate: e.target.value })} />
          </Field>
          <Field label="N° bon de livraison">
            <Input value={ship.delivery_note_ref} onChange={(e) => setShip({ ...ship, delivery_note_ref: e.target.value })} />
          </Field>
          <Field label="Chauffeur">
            <Input value={ship.driver_name} onChange={(e) => setShip({ ...ship, driver_name: e.target.value })} />
          </Field>
          <Field label="Téléphone du chauffeur">
            <Input type="tel" value={ship.driver_phone} onChange={(e) => setShip({ ...ship, driver_phone: e.target.value })} />
          </Field>
          {error ? (
            <div className="sm:col-span-2">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={dialog === "invoice"}
        onClose={() => setDialog(null)}
        title="Déposer une facture"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Annuler
            </Button>
            <Button
              loading={busy}
              disabled={!files.length || !inv.supplier_reference || !invoiceLines.length}
              onClick={() =>
                run(async () => {
                  const form = new FormData();
                  form.append("supplier_reference", inv.supplier_reference);
                  form.append("invoice_date", inv.invoice_date);
                  if (inv.due_date) form.append("due_date", inv.due_date);
                  form.append("tax_amount", inv.tax_amount || "0");
                  form.append("lines_json", JSON.stringify(invoiceLines.map((x) => ({ po_line_id: x.line.id, quantity: x.quantity, unit_price: x.unit_price }))));
                  form.append("file", files[0]);
                  await api(endpoints.invoice, { method: "POST", form });
                  setFiles([]);
                  return refresh();
                })
              }
            >
              Déposer la facture
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Numéro de votre facture" required>
              <Input value={inv.supplier_reference} onChange={(e) => setInv({ ...inv, supplier_reference: e.target.value })} />
            </Field>
            <Field label="Date de facture" required>
              <Input type="date" value={inv.invoice_date} onChange={(e) => setInv({ ...inv, invoice_date: e.target.value })} />
            </Field>
            <Field label="Échéance">
              <Input type="date" value={inv.due_date} onChange={(e) => setInv({ ...inv, due_date: e.target.value })} />
            </Field>
            <Field label="Montant de TVA">
              <Input type="number" min={0} value={inv.tax_amount} onChange={(e) => setInv({ ...inv, tax_amount: e.target.value })} />
            </Field>
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Article</th>
                  <th className="px-3 py-2 text-left">Qté facturée</th>
                  <th className="px-3 py-2 text-left">Prix unitaire HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {order.lines.map((l) => {
                  const remaining = Math.max(0, toNumber(l.accepted) - toNumber(l.invoiced));
                  return (
                    <tr key={l.id}>
                      <td className="px-3 py-2">
                        {l.description}
                        <span className="block text-xs text-muted">
                          Accepté : {number(l.accepted, 2)} · déjà facturé : {number(l.invoiced, 2)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={invLines[l.id]?.quantity ?? (remaining ? String(remaining) : "")}
                          onChange={(e) => setInvLines((c) => ({ ...c, [l.id]: { quantity: e.target.value, unit_price: c[l.id]?.unit_price ?? l.unit_price } }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={invLines[l.id]?.unit_price ?? l.unit_price}
                          onChange={(e) => setInvLines((c) => ({ ...c, [l.id]: { unit_price: e.target.value, quantity: c[l.id]?.quantity ?? String(remaining) } }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-right text-sm">
            Total TTC calculé : <strong>{money(invoiceTotal, cur)}</strong>
          </p>
          <Field label="Facture (PDF ou image)" required>
            <FileDrop files={files} onChange={setFiles} accept=".pdf,image/*" maxSizeMb={20} />
          </Field>
          <p className="text-xs text-muted">La facture est rapprochée automatiquement du bon de commande et des réceptions (contrôle 3 pièces) : {optionLabel("matched")} ou {optionLabel("exception")}.</p>
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>
      </Modal>
    </div>
  );
}
