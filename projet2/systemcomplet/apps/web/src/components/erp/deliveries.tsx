"use client";

import { Camera, CheckCircle2, Download, MapPin, PackageCheck, ScanLine, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { RefSelect } from "@/components/forms/ref-select";
import { SchemaForm } from "@/components/forms/schema-form";
import { Field, FileDrop, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, PageTitle, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage, newKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

export function DeliveriesList({ purchaseOrderId }: { purchaseOrderId?: string }) {
  return (
    <ResourceView
      embedded
      config={{
        title: "Livraisons",
        subtitle: "Expéditions annoncées par les fournisseurs (portail, WhatsApp, extranet) et arrivées sur chantier.",
        path: "/deliveries",
        query: {},
        href: (r) => `/erp/livraisons/${r.id}`,
        columns: [
          { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/livraisons/${r.id}`}>{r.number}</CellLink> },
          { key: "po_number", label: "Commande", render: (r) => (r.purchase_order_id ? <CellLink href={`/erp/achats/commandes/${r.purchase_order_id}`}>{r.po_number}</CellLink> : "—") },
          { key: "supplier", label: "Fournisseur" },
          { key: "eta", label: "Arrivée estimée", format: "datetime" },
          { key: "carrier", label: "Transporteur", hideOnMobile: true },
          { key: "driver_name", label: "Chauffeur", hideOnMobile: true },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: ["announced", "in_transit", "arrived", "received", "cancelled"].map((v) => ({ value: v, label: optionLabel(v) })) }],
        search: !purchaseOrderId,
      }}
    />
  );
}

export function ReceiptsList() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Réceptions (GRN)",
        subtitle: "Quantités reçues / acceptées / refusées, preuves (photos, bon de livraison, signature), écarts.",
        path: "/goods-receipts",
        href: (r) => `/erp/livraisons/receptions/${r.id}`,
        columns: [
          { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/livraisons/receptions/${r.id}`}>{r.number}</CellLink> },
          { key: "po_number", label: "Commande" },
          { key: "supplier", label: "Fournisseur" },
          { key: "received_at", label: "Reçu le", format: "datetime" },
          { key: "destination", label: "Destination", format: "option" },
          { key: "has_exceptions", label: "Écarts", render: (r) => (r.has_exceptions ? <Badge tone="warning">Oui</Badge> : "Non") },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [
          { key: "status", label: "Statut", options: ["draft", "validated", "cancelled"].map((v) => ({ value: v, label: optionLabel(v) })) },
          { key: "has_exceptions", label: "Écarts", options: [{ value: "true", label: "Avec écarts" }, { value: "false", label: "Sans écart" }] },
        ],
        toolbar: (
          <Link href="/erp/livraisons/receptions/nouvelle" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600">
            <PackageCheck className="h-4 w-4" /> Nouvelle réception
          </Link>
        ),
      }}
    />
  );
}

export function SupplierReturns() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Retours fournisseurs",
        path: "/supplier-returns",
        columns: [
          { key: "number", label: "N°" },
          { key: "reason", label: "Motif", format: "option" },
          { key: "amount", label: "Montant", format: "money", align: "right" },
          { key: "created_at", label: "Créé le", format: "date" },
          { key: "status", label: "Statut", format: "status" },
        ],
        actions: [{ key: "status", label: "Mettre à jour", endpoint: "POST /supplier-returns/{return_id}/status", perms: ["deliveries:receive", "procurement:order"], fields: { credit_note_id: { ref: null, help: "Identifiant de l'avoir reçu (facturation)" } } }],
      }}
    />
  );
}

export function DeliveryDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const delivery = useApi<Row>(`/deliveries/${id}`);
  const [arriving, setArriving] = useState(false);
  if (delivery.loading && !delivery.data) return <Skeleton className="h-96 w-full" />;
  if (!delivery.data) return <Alert tone="danger">{delivery.error}</Alert>;
  const d = delivery.data;
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/livraisons" className="hover:underline">Livraisons</Link>}
        title={`Livraison ${d.number}`}
        subtitle={`${d.supplier ?? ""} · commande ${d.po_number ?? "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={d.status} />
            {["announced", "in_transit"].includes(d.status) && can("deliveries:receive") ? (
              <Button size="sm" variant="secondary" onClick={() => setArriving(true)}>
                <MapPin className="h-4 w-4" /> Signaler l'arrivée
              </Button>
            ) : null}
            {d.purchase_order_id && d.status !== "received" && can("deliveries:receive") ? (
              <Link href={`/erp/livraisons/receptions/nouvelle?commande=${d.purchase_order_id}&livraison=${d.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600">
                <PackageCheck className="h-4 w-4" /> Réceptionner
              </Link>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <DescriptionList
            items={[
              { label: "Expédiée le", value: dateTime(d.shipped_at) },
              { label: "Arrivée estimée", value: dateTime(d.eta) },
              { label: "Arrivée réelle", value: dateTime(d.arrived_at) },
              { label: "Transporteur", value: d.carrier },
              { label: "N° de suivi", value: d.tracking_ref },
              { label: "Véhicule", value: d.vehicle_plate },
              { label: "Chauffeur", value: [d.driver_name, d.driver_phone].filter(Boolean).join(" · ") },
              { label: "Bon de livraison", value: d.delivery_note_ref },
              { label: "Annoncée par", value: optionLabel(d.announced_by) },
            ]}
          />
          {d.notes ? <p className="mt-3 text-sm text-muted">{d.notes}</p> : null}
        </Card>
        <Card>
          <CardHeader title="Articles de la commande" />
          <ul className="divide-y divide-line text-sm">
            {((d.lines ?? []) as Row[]).map((l) => (
              <li key={l.id} className="flex justify-between px-5 py-2">
                <span>{l.description}</span>
                <span className="text-muted">
                  {number(l.received, 2)} / {number(l.quantity, 2)} {l.unit}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {((d.receipts ?? []) as Row[]).length ? (
        <Card>
          <CardHeader title="Réceptions" />
          <ul className="divide-y divide-line text-sm">
            {(d.receipts as Row[]).map((g) => (
              <li key={g.id} className="flex justify-between px-5 py-2.5">
                <CellLink href={`/erp/livraisons/receptions/${g.id}`}>{g.number}</CellLink>
                <StatusBadge status={g.status} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Modal open={arriving} onClose={() => setArriving(false)} title="Arrivée sur chantier">
        <SchemaForm
          endpoint="POST /deliveries/{delivery_id}/arrived"
          params={{ delivery_id: id }}
          onCancel={() => setArriving(false)}
          onSuccess={(res: Row) => {
            delivery.setData({ ...d, ...res });
            setArriving(false);
            toast.success("Arrivée enregistrée");
          }}
          columns={1}
        />
      </Modal>
    </div>
  );
}

interface LookupLine {
  po_line_id: string;
  description: string;
  unit: string;
  ordered: string;
  received: string;
  remaining: string;
  stock_item_id?: string | null;
}

/** Réception de marchandise (GRN) : quantités, écarts, lots, preuves géolocalisées, destination stock ou chantier. */
export function NewReceipt({ purchaseOrderId, deliveryId }: { purchaseOrderId?: string | null; deliveryId?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [po, setPo] = useState<(Row & { remaining: LookupLine[] }) | null>(null);
  const [lines, setLines] = useState<Record<string, { quantity_received: string; quantity_rejected: string; rejection_reason: string; condition_notes: string; batch_number: string }>>({});
  const [form, setForm] = useState({ destination: "site_allocation", warehouse_id: "", site_id: "", driver_name: "", vehicle_plate: "", delivery_note_ref: "", notes: "" });
  const [photos, setPhotos] = useState<File[]>([]);
  const [note, setNote] = useState<File[]>([]);
  const [geo, setGeo] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(() => newKey());

  const load = async (value: string) => {
    setError(null);
    try {
      const res = await api<Row & { remaining: LookupLine[] }>("/goods-receipts/lookup", { query: { code: value } });
      setPo(res);
      setForm((f) => ({ ...f, site_id: res.site_id ?? "" }));
      setLines(Object.fromEntries(res.remaining.map((l) => [l.po_line_id, { quantity_received: String(toNumber(l.remaining)), quantity_rejected: "0", rejection_reason: "", condition_notes: "", batch_number: "" }])));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  useEffect(() => {
    if (!purchaseOrderId) return;
    api<Row>(`/procurement/orders/${purchaseOrderId}`)
      .then((o) => {
        setCode(o.number);
        void load(o.number);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [purchaseOrderId]);

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setGeo({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => toast.warning("Géolocalisation refusée"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async (validate: boolean) => {
    if (!po) return;
    setBusy(true);
    setError(null);
    try {
      const receipt = await api<Row>("/goods-receipts", {
        method: "POST",
        idempotent: key,
        body: {
          purchase_order_id: po.id,
          delivery_id: deliveryId ?? null,
          site_id: form.site_id || null,
          warehouse_id: form.destination === "stock" ? form.warehouse_id || null : null,
          destination: form.destination,
          received_at: new Date().toISOString(),
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          geo_accuracy_m: geo?.accuracy ?? null,
          driver_name: form.driver_name || null,
          vehicle_plate: form.vehicle_plate || null,
          delivery_note_ref: form.delivery_note_ref || null,
          notes: form.notes || null,
          source: "web",
          lines: po.remaining
            .filter((l) => toNumber(lines[l.po_line_id]?.quantity_received) > 0 || toNumber(lines[l.po_line_id]?.quantity_rejected) > 0)
            .map((l) => {
              const v = lines[l.po_line_id];
              return {
                po_line_id: l.po_line_id,
                stock_item_id: l.stock_item_id ?? null,
                quantity_received: Number(v.quantity_received || 0),
                quantity_rejected: Number(v.quantity_rejected || 0),
                rejection_reason: v.rejection_reason || null,
                condition_notes: v.condition_notes || null,
                batch_number: v.batch_number || null,
              };
            }),
        },
      });
      for (const f of photos) {
        const fd = new FormData();
        fd.append("kind", "photo");
        fd.append("file", f);
        if (geo) {
          fd.append("latitude", String(geo.latitude));
          fd.append("longitude", String(geo.longitude));
        }
        await api(`/goods-receipts/${receipt.id}/attachments`, { method: "POST", form: fd });
      }
      for (const f of note) {
        const fd = new FormData();
        fd.append("kind", "delivery_note");
        fd.append("file", f);
        await api(`/goods-receipts/${receipt.id}/attachments`, { method: "POST", form: fd });
      }
      if (validate) await api(`/goods-receipts/${receipt.id}/validate`, { method: "POST" });
      toast.success(validate ? "Réception validée" : "Réception enregistrée");
      router.push(`/erp/livraisons/receptions/${receipt.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageTitle eyebrow={<Link href="/erp/livraisons?onglet=receptions" className="hover:underline">Réceptions</Link>} title="Nouvelle réception" subtitle="Scannez le QR du bon de commande ou saisissez son numéro." />
      {!po ? (
        <Card className="p-5">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void load(code);
            }}
          >
            <Field label="N° de bon de commande ou contenu du QR" className="min-w-[16rem] flex-1">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="BC-2026-000123 ou GLOBUS:PO:…" autoFocus />
            </Field>
            <Button type="submit" disabled={code.trim().length < 3}>
              <ScanLine className="h-4 w-4" /> Rechercher
            </Button>
          </form>
          {error ? (
            <div className="mt-3">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                Commande {po.number} — {po.supplier?.legal_name}
              </p>
              <StatusBadge status={po.status} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Destination">
                <Select value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} options={["site_allocation", "stock"].map((v) => ({ value: v, label: optionLabel(v) }))} />
              </Field>
              {form.destination === "stock" ? (
                <Field label="Dépôt" required>
                  <RefSelect source={REFS.warehouses} value={form.warehouse_id || null} onChange={(v) => setForm({ ...form, warehouse_id: v ?? "" })} />
                </Field>
              ) : (
                <Field label="Chantier">
                  <RefSelect source={REFS.sites} value={form.site_id || null} onChange={(v) => setForm({ ...form, site_id: v ?? "" })} context={{ project_id: po.project_id }} />
                </Field>
              )}
              <Field label="Chauffeur">
                <Input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} />
              </Field>
              <Field label="Immatriculation">
                <Input value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })} />
              </Field>
              <Field label="N° bon de livraison">
                <Input value={form.delivery_note_ref} onChange={(e) => setForm({ ...form, delivery_note_ref: e.target.value })} />
              </Field>
            </div>
          </Card>
          <Card>
            <CardHeader title="Contrôle des quantités" subtitle="Saisissez le reçu et le refusé ; tout écart (manquant, endommagé, non conforme) crée un incident fournisseur." />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Article</th>
                    <th className="px-3 py-2">Reste</th>
                    <th className="px-3 py-2">Reçu</th>
                    <th className="px-3 py-2">Refusé</th>
                    <th className="px-3 py-2">Motif</th>
                    <th className="px-3 py-2">Lot</th>
                    <th className="px-3 py-2">Observations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {po.remaining.map((l) => {
                    const v = lines[l.po_line_id];
                    const set = (k: keyof typeof v, value: string) => setLines((all) => ({ ...all, [l.po_line_id]: { ...all[l.po_line_id], [k]: value } }));
                    return (
                      <tr key={l.po_line_id}>
                        <td className="px-3 py-2">{l.description}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {number(l.remaining, 2)} {l.unit}
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min={0} className="w-24" value={v?.quantity_received ?? ""} onChange={(e) => set("quantity_received", e.target.value)} />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min={0} className="w-24" value={v?.quantity_rejected ?? ""} onChange={(e) => set("quantity_rejected", e.target.value)} />
                        </td>
                        <td className="px-3 py-2">
                          <Select className="w-36" value={v?.rejection_reason ?? ""} onChange={(e) => set("rejection_reason", e.target.value)} options={["damaged", "different", "missing", "excess", "quality"].map((x) => ({ value: x, label: optionLabel(x) }))} placeholder="—" />
                        </td>
                        <td className="px-3 py-2">
                          <Input className="w-28" value={v?.batch_number ?? ""} onChange={(e) => set("batch_number", e.target.value)} />
                        </td>
                        <td className="px-3 py-2">
                          <Input className="w-48" value={v?.condition_notes ?? ""} onChange={(e) => set("condition_notes", e.target.value)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-3 p-5">
              <p className="flex items-center gap-2 font-semibold">
                <Camera className="h-4 w-4" /> Photos de la livraison
              </p>
              <FileDrop files={photos} onChange={setPhotos} multiple accept="image/*" capture="environment" maxSizeMb={20} />
              <Button size="sm" variant="secondary" onClick={locate}>
                <MapPin className="h-4 w-4" /> {geo ? `Position relevée (±${Math.round(geo.accuracy)} m)` : "Relever la position GPS"}
              </Button>
            </Card>
            <Card className="space-y-3 p-5">
              <p className="font-semibold">Bon de livraison signé</p>
              <FileDrop files={note} onChange={setNote} accept="image/*,.pdf" capture="environment" maxSizeMb={20} />
              <Field label="Notes">
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </Field>
            </Card>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => void submit(false)} loading={busy}>
              Enregistrer en brouillon
            </Button>
            <Button onClick={() => void submit(true)} loading={busy} disabled={!photos.length && !note.length}>
              <CheckCircle2 className="h-4 w-4" /> Enregistrer et valider
            </Button>
          </div>
          {!photos.length && !note.length ? <p className="text-right text-xs text-muted">La validation exige au moins une preuve (photo ou bon de livraison).</p> : null}
        </>
      )}
    </div>
  );
}

export function ReceiptDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const receipt = useApi<Row>(`/goods-receipts/${id}`);
  const [returning, setReturning] = useState(false);
  const [validating, setValidating] = useState(false);
  const [upload, setUpload] = useState<File[]>([]);
  const [kind, setKind] = useState("photo");
  const [busy, setBusy] = useState(false);
  if (receipt.loading && !receipt.data) return <Skeleton className="h-96 w-full" />;
  if (!receipt.data) return <Alert tone="danger">{receipt.error}</Alert>;
  const g = receipt.data;
  const files: { id: string; kind: string }[] = [
    ...((g.photo_file_ids ?? []) as string[]).map((f) => ({ id: f, kind: "photo" })),
    ...(g.delivery_note_file_id ? [{ id: g.delivery_note_file_id as string, kind: "delivery_note" }] : []),
    ...(g.invoice_file_id ? [{ id: g.invoice_file_id as string, kind: "invoice" }] : []),
    ...(g.signature_file_id ? [{ id: g.signature_file_id as string, kind: "signature" }] : []),
  ];
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/livraisons?onglet=receptions" className="hover:underline">Réceptions</Link>}
        title={`Réception ${g.number}`}
        subtitle={`${g.supplier ?? ""} · commande ${g.po_number ?? "—"} · ${dateTime(g.received_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {g.has_exceptions ? <Badge tone="warning">Écarts constatés</Badge> : null}
            <StatusBadge status={g.status} />
            {g.status === "draft" && can("deliveries:receive") ? (
              <Button size="sm" onClick={() => setValidating(true)}>
                Valider
              </Button>
            ) : null}
            {g.status === "validated" && g.has_exceptions && can("deliveries:receive") ? (
              <Button size="sm" variant="secondary" onClick={() => setReturning(true)}>
                <Undo2 className="h-4 w-4" /> Retour fournisseur
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Lignes réceptionnées" />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Article</th>
                  <th className="px-3 py-2 text-right">Commandé</th>
                  <th className="px-3 py-2 text-right">Reçu</th>
                  <th className="px-3 py-2 text-right">Accepté</th>
                  <th className="px-3 py-2 text-right">Refusé</th>
                  <th className="px-3 py-2">Motif / lot</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {((g.lines ?? []) as Row[]).map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      {l.description}
                      {l.is_substitution ? <Badge tone="accent">Substitution {optionLabel(l.substitution_status)}</Badge> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(l.quantity_ordered, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(l.quantity_received, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(l.quantity_accepted, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(l.quantity_rejected, 2)}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {[optionLabel(l.rejection_reason) !== "—" ? optionLabel(l.rejection_reason) : null, l.batch_number, l.condition_notes].filter(Boolean).join(" · ")}
                    </td>
                    <td className="px-3 py-2">
                      {l.is_substitution && l.substitution_status === "pending" && can("procurement:order") ? (
                        <span className="flex gap-1">
                          <Button size="sm" onClick={async () => {
                            try {
                              receipt.setData(await api(`/goods-receipts/${id}/lines/${l.id}/substitution`, { method: "POST", body: { approve: true } }));
                            } catch (err) {
                              toast.error("Action impossible", errorMessage(err));
                            }
                          }}>
                            Accepter
                          </Button>
                          <Button size="sm" variant="ghost" onClick={async () => {
                            try {
                              receipt.setData(await api(`/goods-receipts/${id}/lines/${l.id}/substitution`, { method: "POST", body: { approve: false } }));
                            } catch (err) {
                              toast.error("Action impossible", errorMessage(err));
                            }
                          }}>
                            Refuser
                          </Button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Array.isArray(g.exceptions) && g.exceptions.length ? (
            <div className="border-t border-line p-4">
              <Alert tone="warning" title="Écarts">
                <ul className="list-disc pl-5">
                  {(g.exceptions as Row[]).map((e, i) => (
                    <li key={i}>{typeof e === "string" ? e : `${e.description ?? e.line ?? ""} : ${optionLabel(e.kind ?? e.reason)} ${e.quantity ? `(${e.quantity})` : ""}`}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          ) : null}
        </Card>
        <Card>
          <CardHeader title="Preuves" />
          <div className="space-y-3 p-5 text-sm">
            <DescriptionList
              columns={1}
              items={[
                { label: "Destination", value: optionLabel(g.destination) },
                { label: "Chauffeur / véhicule", value: [g.driver_name, g.vehicle_plate].filter(Boolean).join(" · ") },
                { label: "Bon de livraison", value: g.delivery_note_ref },
                { label: "Position", value: g.latitude ? `${number(g.latitude, 5)}, ${number(g.longitude, 5)} (±${number(g.geo_accuracy_m ?? 0)} m)` : "—" },
                { label: "Validée le", value: dateTime(g.validated_at) },
              ]}
            />
            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.id}>
                  <a href={apiUrl(`/goods-receipts/${id}/files/${f.id}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brand-600 hover:underline">
                    <Download className="h-3.5 w-3.5" /> {optionLabel(f.kind)}
                  </a>
                </li>
              ))}
            </ul>
            {g.status === "draft" ? (
              <div className="space-y-2 border-t border-line pt-3">
                <Select value={kind} onChange={(e) => setKind(e.target.value)} options={["photo", "delivery_note", "invoice", "signature"].map((v) => ({ value: v, label: optionLabel(v) }))} aria-label="Type de pièce" />
                <FileDrop files={upload} onChange={setUpload} accept="image/*,.pdf" capture="environment" />
                <Button
                  size="sm"
                  disabled={!upload.length}
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      for (const f of upload) {
                        const fd = new FormData();
                        fd.append("kind", kind);
                        fd.append("file", f);
                        await api(`/goods-receipts/${id}/attachments`, { method: "POST", form: fd });
                      }
                      setUpload([]);
                      void receipt.reload();
                    } catch (err) {
                      toast.error("Envoi impossible", errorMessage(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Ajouter la pièce
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
      <ConfirmDialog
        open={validating}
        onClose={() => setValidating(false)}
        title="Valider la réception"
        text="La validation met à jour la commande, le stock ou l'affectation chantier et crée les incidents en cas d'écart."
        onConfirm={async () => {
          receipt.setData(await api(`/goods-receipts/${id}/validate`, { method: "POST" }));
          toast.success("Réception validée");
        }}
      />
      <Modal open={returning} onClose={() => setReturning(false)} title="Retour fournisseur">
        <SchemaForm
          endpoint="POST /goods-receipts/{receipt_id}/returns"
          params={{ receipt_id: id }}
          onCancel={() => setReturning(false)}
          onSuccess={() => {
            setReturning(false);
            toast.success("Retour créé");
          }}
          columns={1}
        />
      </Modal>
    </div>
  );
}
