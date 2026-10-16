"use client";

import { Download, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SupplierOrderView, type SupplierOrder } from "@/components/procurement/supplier-order-view";
import { DataTable } from "@/components/ui/data-table";
import { Checkbox, Field, FileDrop, Input, Select, TagInput } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Progress, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { date, dateTime, money, number, percent, toNumber } from "@/lib/format";
import { useApi, useList } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

type Row = Record<string, any>;
const ORDER_STATUSES = ["sent", "viewed", "confirmed", "countered", "refused", "shipped", "partially_received", "received", "invoiced", "closed", "cancelled"];

/* ----------------------------------------------------------------------------- commandes */

export function SupplierOrders() {
  const [status, setStatus] = useState("");
  const list = useList<Row>("/extranet/supplier/orders", { pageSize: 25 }, { status: status || undefined });
  return (
    <div className="space-y-4">
      <PageTitle title="Mes commandes" subtitle="Bons de commande GLOBUS : confirmez, proposez une contre-offre, annoncez l'expédition, déposez votre facture." />
      <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "", label: "Toutes" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: optionLabel(s) }))]} aria-label="Statut" />
      <Card>
        <DataTable
          list={list}
          rowKey={(r) => r.id}
          columns={[
            { key: "number", label: "Commande", render: (r) => <Link href={`/extranet/commandes/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.number}</Link> },
            { key: "project", label: "Chantier", render: (r) => `${r.project}${r.site ? ` · ${r.site}` : ""}` },
            { key: "expected_date", label: "Livraison souhaitée", format: "date" },
            { key: "total", label: "Montant TTC", align: "right", render: (r) => money(r.total, r.currency === "XAF" ? "FCFA" : r.currency) },
            { key: "urgent", label: "", render: (r) => (r.urgent ? <Badge tone="danger">Urgent</Badge> : null) },
            { key: "status", label: "Statut", format: "status" },
          ]}
          empty={{ title: "Aucune commande." }}
        />
      </Card>
    </div>
  );
}

export function SupplierOrderPage({ id }: { id: string }) {
  const order = useApi<SupplierOrder>(`/extranet/supplier/orders/${id}`);
  if (order.loading && !order.data) return <Skeleton className="h-96 w-full" />;
  if (!order.data) return <Alert tone="danger">{order.error}</Alert>;
  const base = `/extranet/supplier/orders/${id}`;
  return (
    <div className="space-y-4">
      <Link href="/extranet/commandes" className="text-sm text-brand-600 hover:underline">
        ← Mes commandes
      </Link>
      <SupplierOrderView
        order={order.data}
        endpoints={{ respond: `${base}/respond`, shipment: `${base}/shipment`, invoice: `${base}/invoices`, pdf: apiUrl(`${base}/pdf`) }}
        onUpdated={(o) => order.setData(o)}
        refresh={async () => {
          const fresh = await api<SupplierOrder>(`/extranet/supplier/orders/${id}`);
          order.setData(fresh);
          return fresh;
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------------- livraisons, factures, paiements */

export function SupplierDeliveries() {
  const rows = useApi<Row[]>("/extranet/supplier/deliveries");
  return (
    <div className="space-y-4">
      <PageTitle title="Livraisons" subtitle="Livraisons annoncées et leur réception sur chantier." />
      <Card>
        <DataTable
          rows={rows.data ?? []}
          loading={rows.loading}
          searchable={false}
          rowKey={(r) => r.id}
          columns={[
            { key: "number", label: "Livraison" },
            { key: "eta", label: "Arrivée prévue", format: "datetime" },
            { key: "carrier", label: "Transporteur" },
            { key: "vehicle_plate", label: "Véhicule" },
            { key: "delivery_note_ref", label: "Bon de livraison" },
            { key: "status", label: "Statut", format: "status" },
          ]}
          empty={{ title: "Aucune livraison." }}
        />
      </Card>
    </div>
  );
}

export function SupplierInvoices() {
  const list = useList<Row>("/extranet/supplier/invoices", { pageSize: 25 });
  return (
    <div className="space-y-4">
      <PageTitle title="Mes factures" subtitle="Déposées depuis vos commandes ; contrôle 3 pièces (commande, réception, facture) puis mise en paiement." />
      <Card>
        <DataTable
          list={list}
          rowKey={(r) => r.id}
          columns={[
            { key: "reference", label: "N° de facture" },
            { key: "number", label: "Référence GLOBUS" },
            { key: "invoice_date", label: "Date", format: "date" },
            { key: "due_date", label: "Échéance", format: "date" },
            { key: "total", label: "TTC", format: "money", align: "right" },
            { key: "amount_paid", label: "Réglé", format: "money", align: "right" },
            { key: "match_status", label: "Contrôle", render: (r) => (r.match_status === "matched" ? <Badge tone="success">Conforme</Badge> : r.match_status === "exception" ? <Badge tone="warning">Écart en cours d'analyse</Badge> : "—") },
            { key: "status", label: "Statut", format: "status" },
          ]}
          empty={{ title: "Aucune facture." }}
        />
      </Card>
    </div>
  );
}

export function PartnerPayments({ path, title }: { path: string; title: string }) {
  const rows = useApi<Row[]>(path);
  const total = (rows.data ?? []).filter((p) => p.status === "succeeded").reduce((s, p) => s + toNumber(p.amount), 0);
  return (
    <div className="space-y-4">
      <PageTitle title={title} subtitle="Paiements émis par GLOBUS à votre profit." />
      <Stat label="Total encaissé" value={money(total)} tone="success" />
      <Card>
        <DataTable
          rows={rows.data ?? []}
          loading={rows.loading}
          searchable={false}
          rowKey={(r) => r.number}
          columns={[
            { key: "number", label: "Paiement" },
            { key: "amount", label: "Montant", format: "money", align: "right" },
            { key: "method", label: "Mode", format: "option" },
            { key: "paid_at", label: "Payé le", format: "datetime" },
            { key: "status", label: "Statut", format: "status" },
          ]}
          empty={{ title: "Aucun paiement." }}
        />
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------------------- documents, performance, profil */

export function SupplierDocuments() {
  const toast = useToast();
  const profile = useApi<Row>("/extranet/supplier/profile");
  const [files, setFiles] = useState<File[]>([]);
  const [meta, setMeta] = useState({ kind: "attestation_fiscale", title: "", valid_until: "" });
  const [open, setOpen] = useState(false);
  const docs = (profile.data?.documents ?? []) as Row[];
  return (
    <div className="space-y-4">
      <PageTitle
        title="Mes documents"
        subtitle="Attestations fiscales et sociales, assurances, certificats : tenez-les à jour pour rester référencé."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Upload className="h-4 w-4" /> Déposer un document
          </Button>
        }
      />
      {(profile.data?.expired_documents ?? []).length ? <Alert tone="warning" title="Documents expirés">{(profile.data?.expired_documents as string[]).join(", ")}</Alert> : null}
      <Card>
        <ul className="divide-y divide-line text-sm">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <span>
                {d.title}
                <span className="block text-xs text-muted">
                  {optionLabel(d.kind)} {d.valid_until ? `· valable jusqu'au ${date(d.valid_until)}` : ""} {d.verified ? "· vérifié par GLOBUS" : "· en attente de vérification"}
                </span>
              </span>
              <a href={apiUrl(`/extranet/supplier/documents/${d.id}/file`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                <Download className="h-4 w-4" /> Ouvrir
              </a>
            </li>
          ))}
          {!profile.loading && !docs.length ? <li className="px-5 py-4 text-muted">Aucun document.</li> : null}
        </ul>
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Déposer un document"
        footer={
          <Button
            disabled={!files.length || meta.title.length < 2}
            onClick={async () => {
              try {
                const fd = new FormData();
                fd.append("kind", meta.kind);
                fd.append("title", meta.title);
                if (meta.valid_until) fd.append("valid_until", meta.valid_until);
                fd.append("file", files[0]);
                await api("/extranet/supplier/documents", { method: "POST", form: fd });
                setOpen(false);
                setFiles([]);
                setMeta({ kind: "attestation_fiscale", title: "", valid_until: "" });
                void profile.reload();
                toast.success("Document déposé", "Il sera vérifié par nos équipes.");
              } catch (err) {
                toast.error("Dépôt impossible", errorMessage(err));
              }
            }}
          >
            Déposer
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Type">
            <Select value={meta.kind} onChange={(e) => setMeta({ ...meta, kind: e.target.value })} options={["attestation_fiscale", "assurance", "certification", "rccm", "niu", "fiche_technique", "autre"].map((k) => ({ value: k, label: optionLabel(k) }))} />
          </Field>
          <Field label="Intitulé">
            <Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
          </Field>
          <Field label="Valable jusqu'au">
            <Input type="date" value={meta.valid_until} onChange={(e) => setMeta({ ...meta, valid_until: e.target.value })} />
          </Field>
          <FileDrop files={files} onChange={setFiles} accept=".pdf,image/*" maxSizeMb={20} />
        </div>
      </Modal>
    </div>
  );
}

export function SupplierPerformance() {
  const score = useApi<Row>("/extranet/supplier/scorecard");
  if (score.loading && !score.data) return <Skeleton className="h-48" />;
  if (!score.data) return <Alert tone="danger">{score.error}</Alert>;
  const s = score.data;
  return (
    <div className="space-y-4">
      <PageTitle title="Ma performance" subtitle="Indicateurs calculés sur vos livraisons et contrôles de réception." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Note qualité" value={s.quality_score !== null && s.quality_score !== undefined ? `${number(s.quality_score, 1)} / 100` : "—"} tone="info" />
        <Stat label="Taux de service" value={percent(s.service_rate ?? 0, 1)} tone={toNumber(s.service_rate) >= 95 ? "success" : "warning"} />
        <Stat label="Livraisons à l'heure" value={percent(s.on_time_rate ?? 0, 1)} hint={s.avg_delay_days ? `Retard moyen ${number(s.avg_delay_days, 1)} j` : undefined} />
        <Stat label="Taux d'erreur" value={percent(s.error_rate ?? 0, 1)} tone={toNumber(s.error_rate) > 5 ? "danger" : "success"} />
      </div>
      <Card className="space-y-3 p-5">
        <Progress value={toNumber(s.quality_score)} label="Note globale" tone={toNumber(s.quality_score) >= 80 ? "success" : "accent"} />
        <p className="text-sm text-muted">La note conditionne votre priorité dans nos consultations : livrez à l'heure, conforme à la commande et avec un bon de livraison lisible.</p>
      </Card>
    </div>
  );
}

export function SupplierProfile() {
  const toast = useToast();
  const profile = useApi<Row>("/extranet/supplier/profile");
  const [edit, setEdit] = useState<Row | null>(null);
  if (profile.loading && !profile.data) return <Skeleton className="h-64" />;
  if (!profile.data) return <Alert tone="danger">{profile.error}</Alert>;
  const p = profile.data;
  const v = edit ?? { address: p.address ?? "", city: p.city ?? "", email: p.email ?? "", phone: p.phone ?? "", whatsapp_number: p.whatsapp_number ?? "", whatsapp_opt_in: !!p.whatsapp_opt_in, delivery_zones: p.delivery_zones ?? [], lead_time_days: p.lead_time_days ?? 0 };
  return (
    <Card>
      <CardHeader title={p.trade_name || p.legal_name} subtitle={[p.code, p.city].filter(Boolean).join(" · ")} actions={<StatusBadge status={p.status} />} />
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <DescriptionList
          columns={1}
          items={[
            { label: "Raison sociale", value: p.legal_name },
            { label: "NIU / RCCM", value: [p.tax_id, p.trade_register].filter(Boolean).join(" · ") || "—" },
            { label: "Compte bancaire", value: p.bank_account_masked ?? "—" },
            { label: "Mobile Money", value: p.mobile_money_masked ?? "—" },
          ]}
        />
        <div className="space-y-3">
          <Field label="E-mail">
            <Input type="email" value={v.email} onChange={(e) => setEdit({ ...v, email: e.target.value })} />
          </Field>
          <Field label="Téléphone">
            <Input value={v.phone} onChange={(e) => setEdit({ ...v, phone: e.target.value })} />
          </Field>
          <Field label="WhatsApp (bons de commande)">
            <Input value={v.whatsapp_number} onChange={(e) => setEdit({ ...v, whatsapp_number: e.target.value })} />
          </Field>
          <Checkbox label="Recevoir les commandes par WhatsApp" checked={v.whatsapp_opt_in} onChange={(c) => setEdit({ ...v, whatsapp_opt_in: c })} />
          <Field label="Adresse">
            <Input value={v.address} onChange={(e) => setEdit({ ...v, address: e.target.value })} />
          </Field>
          <Field label="Ville">
            <Input value={v.city} onChange={(e) => setEdit({ ...v, city: e.target.value })} />
          </Field>
          <Field label="Zones de livraison">
            <TagInput value={v.delivery_zones} onChange={(z) => setEdit({ ...v, delivery_zones: z })} />
          </Field>
          <Field label="Délai habituel (jours)">
            <Input type="number" min={0} max={365} value={v.lead_time_days} onChange={(e) => setEdit({ ...v, lead_time_days: Number(e.target.value) })} />
          </Field>
          {edit ? (
            <Button
              onClick={async () => {
                try {
                  profile.setData(await api<Row>("/extranet/supplier/profile", { method: "PATCH", body: { ...v, email: v.email || null } }));
                  setEdit(null);
                  toast.success("Coordonnées mises à jour");
                } catch (err) {
                  toast.error("Mise à jour impossible", errorMessage(err));
                }
              }}
            >
              Enregistrer
            </Button>
          ) : null}
          <p className="text-xs text-muted">Les coordonnées bancaires se modifient avec votre interlocuteur achats (contrôle anti-fraude).</p>
        </div>
      </div>
    </Card>
  );
}

export function SupplierHome() {
  const orders = useApi<{ items: Row[]; total: number }>("/extranet/supplier/orders", { page_size: 100 });
  const score = useApi<Row>("/extranet/supplier/scorecard");
  const items = orders.data?.items ?? [];
  const toRespond = items.filter((o) => o.actions?.respond);
  const toShip = items.filter((o) => o.actions?.ship);
  const toInvoice = items.filter((o) => o.actions?.invoice);
  return (
    <div className="space-y-5">
      <PageTitle title="Espace fournisseur" subtitle="Vos commandes GLOBUS, livraisons, factures et paiements." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="À confirmer" value={toRespond.length} tone={toRespond.length ? "warning" : "success"} />
        <Stat label="À expédier" value={toShip.length} tone="info" />
        <Stat label="À facturer" value={toInvoice.length} />
        <Stat label="Note qualité" value={score.data?.quality_score !== undefined && score.data?.quality_score !== null ? `${number(score.data.quality_score, 1)} / 100` : "—"} />
      </div>
      <Card>
        <CardHeader title="Actions attendues" />
        <ul className="divide-y divide-line text-sm">
          {[...toRespond, ...toShip, ...toInvoice].slice(0, 20).map((o, i) => (
            <li key={`${o.id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <Link href={`/extranet/commandes/${o.id}`} className="font-medium text-brand-700 hover:underline">
                {o.number} · {o.project}
              </Link>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted">{o.actions?.respond ? "Réponse attendue" : o.actions?.ship ? "Annoncer l'expédition" : "Déposer la facture"}</span>
                <StatusBadge status={o.status} />
              </span>
            </li>
          ))}
          {!orders.loading && !toRespond.length && !toShip.length && !toInvoice.length ? (
            <li className="p-5">
              <EmptyState title="Rien en attente" text="Toutes vos commandes sont à jour." />
            </li>
          ) : null}
        </ul>
      </Card>
      <p className="text-xs text-muted">Dernière mise à jour {dateTime(new Date().toISOString())}</p>
    </div>
  );
}
