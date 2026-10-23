"use client";

import { CheckCircle2, Download, MessageCircle, QrCode, Send, Star, Truck, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { SchemaForm } from "@/components/forms/schema-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Progress, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage, newKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

export const PR_STATUSES = ["draft", "submitted", "approved", "rejected", "ordered", "cancelled"];
export const PO_STATUSES = ["draft", "pending_approval", "approved", "sent", "confirmed", "countered", "refused", "shipped", "partially_received", "received", "invoiced", "closed", "cancelled"];

export function RequestsList({ projectId, mine }: { projectId?: string; mine?: boolean }) {
  return (
    <ResourceView
      embedded
      config={{
        title: "Demandes d'achat",
        subtitle: "Expression du besoin (chantier, zone, lot, urgence) → approbation hiérarchique → commande.",
        path: "/procurement/requests",
        query: { project_id: projectId, mine: mine || undefined },
        href: (r) => `/erp/achats/demandes/${r.id}`,
        columns: [
          { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/achats/demandes/${r.id}`}>{r.number}</CellLink> },
          { key: "category", label: "Catégorie", format: "option" },
          { key: "urgency", label: "Urgence", render: (r) => <Badge tone={r.urgency === "normal" ? "neutral" : "danger"}>{optionLabel(r.urgency)}</Badge> },
          { key: "needed_by", label: "Besoin pour", format: "date" },
          { key: "total_estimated", label: "Estimation", format: "money", align: "right" },
          { key: "status", label: "Statut", format: "status" },
          { key: "created_at", label: "Créée le", format: "date", hideOnMobile: true },
        ],
        filters: [
          { key: "status", label: "Statut", options: PR_STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) },
          { key: "urgency", label: "Urgence", options: ["normal", "urgent", "critical"].map((v) => ({ value: v, label: optionLabel(v) })) },
        ],
        create: {
          endpoint: "POST /procurement/requests",
          label: "Nouvelle demande",
          perms: ["procurement:request"],
          fixed: projectId ? { project_id: projectId } : undefined,
          exclude: ["source", "budget_line_id"],
          initial: { source: "web" },
          fields: {
            justification: { widget: "textarea", requiredIf: (v) => !!v.submit, help: "Obligatoire pour soumettre : à quoi sert l'achat (ex. « Coulage des fondations »)." },
            lines: { columns: ["stock_item_id", "description", "quantity", "unit", "estimated_unit_price", "notes"] },
          },
        },
      }}
    />
  );
}

export function OrdersList({ projectId, supplierId }: { projectId?: string; supplierId?: string }) {
  return (
    <ResourceView
      embedded
      config={{
        title: "Bons de commande",
        subtitle: "Envoi WhatsApp / e-mail / SMS traçable, confirmation fournisseur, expédition, réception, facture.",
        path: "/procurement/orders",
        query: { project_id: projectId, supplier_id: supplierId },
        href: (r) => `/erp/achats/commandes/${r.id}`,
        exportDataset: "purchase_orders",
        columns: [
          { key: "number", label: "N°", render: (r) => <CellLink href={`/erp/achats/commandes/${r.id}`}>{r.number}</CellLink> },
          { key: "supplier", label: "Fournisseur", render: (r) => r.supplier?.legal_name ?? "—" },
          { key: "project", label: "Projet", render: (r) => r.project?.code ?? "—", hideOnMobile: true },
          { key: "total", label: "Total TTC", format: "money", align: "right", sortable: true },
          { key: "expected_date", label: "Livraison", format: "date" },
          { key: "sent_channel", label: "Canal", format: "option", hideOnMobile: true },
          { key: "status", label: "Statut", render: (r) => <span className="flex items-center gap-1">{r.urgent ? <Badge tone="danger">Urgent</Badge> : null}<StatusBadge status={r.status} /></span> },
        ],
        filters: [{ key: "status", label: "Statut", options: PO_STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) }],
        create: {
          endpoint: "POST /procurement/orders",
          label: "Commande directe",
          perms: ["procurement:order"],
          fixed: projectId ? { project_id: projectId } : undefined,
          fields: { justification: { help: "Commande sans demande d'achat : justification obligatoire (exception tracée)." }, lines: { columns: ["supplier_product_id", "description", "quantity", "unit", "unit_price", "tax_rate"] } },
          idempotent: true,
        },
      }}
    />
  );
}

export function PendingApprovals() {
  const toast = useToast();
  const pending = useApi<{ approval: Row; request?: Row }[]>("/procurement/approvals/pending");
  const [decide, setDecide] = useState<{ request: Row; approve: boolean } | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  if (pending.loading) return <Skeleton className="h-48 w-full" />;
  if (pending.error) return <Alert tone="danger">{pending.error}</Alert>;
  const items = (pending.data ?? []).filter((x) => x.request);
  if (!items.length) return <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="Aucune approbation en attente" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map(({ approval, request }) => (
        <Card key={approval.id} className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link href={`/erp/achats/demandes/${request!.id}`} className="text-lg font-semibold text-brand-700 hover:underline">
                {request!.number}
              </Link>
              <p className="text-xs text-muted">
                Niveau {approval.level} · {optionLabel(approval.approver_role)} · {dateTime(request!.submitted_at)}
              </p>
            </div>
            <Badge tone={request!.urgency === "normal" ? "neutral" : "danger"}>{optionLabel(request!.urgency)}</Badge>
          </div>
          <p className="mt-2 font-title text-xl font-bold">{money(request!.total_estimated)}</p>
          {request!.justification ? <p className="mt-1 text-sm text-muted">{request!.justification}</p> : null}
          <ul className="mt-3 space-y-1 text-sm">
            {(request!.lines as Row[]).slice(0, 5).map((l) => (
              <li key={l.id} className="flex justify-between gap-2">
                <span className="truncate">{l.description}</span>
                <span className="text-muted">
                  {number(l.quantity, 2)} {l.unit}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => setDecide({ request: request!, approve: true })}>
              Approuver
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDecide({ request: request!, approve: false })}>
              Refuser
            </Button>
          </div>
        </Card>
      ))}
      <Modal
        open={!!decide}
        onClose={() => setDecide(null)}
        title={decide?.approve ? "Approuver la demande" : "Refuser la demande"}
        size="sm"
        footer={
          <Button
            variant={decide?.approve ? "primary" : "danger"}
            loading={busy}
            disabled={!decide?.approve && comment.trim().length < 3}
            onClick={async () => {
              if (!decide) return;
              setBusy(true);
              try {
                await api(`/procurement/requests/${decide.request.id}/decision`, { method: "POST", body: { approve: decide.approve, comment: comment || null } });
                toast.success(decide.approve ? "Demande approuvée" : "Demande refusée");
                setDecide(null);
                setComment("");
                void pending.reload();
              } catch (err) {
                toast.error("Décision impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmer
          </Button>
        }
      >
        <Field label={decide?.approve ? "Commentaire (facultatif)" : "Motif du refus"} required={!decide?.approve}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        </Field>
      </Modal>
    </div>
  );
}

interface Ranked {
  supplier_id: string;
  supplier: string;
  score: number;
  coverage_pct: number;
  total: string;
  lead_time_days: number;
  quality_score?: string | null;
  zone_ok: boolean;
  whatsapp: boolean;
  breakdown: Record<string, number>;
  lines: { line_id: string; product_id: string; reference?: string | null; unit_price: string; unit: string }[];
}

/** Fiche demande d'achat : lignes, circuit d'approbation, classement des fournisseurs, transformation en commande. */
export function RequestDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const pr = useApi<Row>(`/procurement/requests/${id}`);
  const [ranking, setRanking] = useState<Ranked[] | null>(null);
  const [ordering, setOrdering] = useState<Ranked | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [orderForm, setOrderForm] = useState({ expected_date: "", notes: "", send: true, channel: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [decide, setDecide] = useState<boolean | null>(null);
  const [cancel, setCancel] = useState(false);
  const [comment, setComment] = useState("");
  const [idemKey] = useState(() => newKey());
  if (pr.loading && !pr.data) return <Skeleton className="h-96 w-full" />;
  if (!pr.data) return <Alert tone="danger">{pr.error}</Alert>;
  const r = pr.data;
  const lines = (r.lines ?? []) as Row[];
  const loadRanking = async () => {
    setBusy("rank");
    try {
      setRanking(await api<Ranked[]>(`/procurement/requests/${id}/suppliers`));
    } catch (err) {
      toast.error("Classement indisponible", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow={<Link href="/erp/achats?onglet=demandes" className="hover:underline">Demandes d'achat</Link>}
        title={`Demande ${r.number}`}
        subtitle={`Créée le ${dateTime(r.created_at)} · source ${optionLabel(r.source)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={r.urgency === "normal" ? "neutral" : "danger"}>{optionLabel(r.urgency)}</Badge>
            <StatusBadge status={r.status} />
            {r.status === "draft" && can("procurement:request") ? (
              <Button
                size="sm"
                loading={busy === "submit"}
                onClick={async () => {
                  setBusy("submit");
                  try {
                    pr.setData(await api(`/procurement/requests/${id}/submit`, { method: "POST" }));
                    toast.success("Demande soumise à approbation");
                  } catch (err) {
                    toast.error("Soumission impossible", errorMessage(err));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <Send className="h-4 w-4" /> Soumettre
              </Button>
            ) : null}
            {r.status === "submitted" && can("procurement:approve") ? (
              <>
                <Button size="sm" onClick={() => setDecide(true)}>
                  Approuver
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDecide(false)}>
                  Refuser
                </Button>
              </>
            ) : null}
            {["draft", "submitted", "approved"].includes(r.status) ? (
              <Button size="sm" variant="ghost" onClick={() => setCancel(true)}>
                Annuler
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Besoin exprimé" subtitle={`Estimation : ${money(r.total_estimated)}`} />
          <div className="p-5">
            <DescriptionList
              columns={3}
              items={[
                { label: "Catégorie", value: optionLabel(r.category) },
                { label: "Zone", value: r.zone },
                { label: "Centre de coût", value: r.cost_center },
                { label: "Besoin pour le", value: date(r.needed_by) },
                { label: "Soumise le", value: dateTime(r.submitted_at) },
                { label: "Approuvée le", value: dateTime(r.approved_at) },
              ]}
            />
            {r.justification ? <p className="mt-4 whitespace-pre-line rounded-xl bg-surface p-3 text-sm">{r.justification}</p> : null}
            {r.rejected_reason ? <Alert tone="danger" title="Motif du refus">{r.rejected_reason}</Alert> : null}
          </div>
          <div className="overflow-x-auto border-t border-line">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">Article</th>
                  <th className="px-4 py-2 text-right">Quantité</th>
                  <th className="px-4 py-2 text-right">PU estimé</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2">
                      {l.description}
                      {l.notes ? <span className="block text-xs text-muted">{l.notes}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {number(l.quantity, 2)} {l.unit}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(l.estimated_unit_price)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(toNumber(l.quantity) * toNumber(l.estimated_unit_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Circuit d'approbation" />
            <ol className="space-y-3 p-5">
              {(r.approvals as Row[]).map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  {a.status === "approved" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : a.status === "rejected" ? <XCircle className="h-5 w-5 text-red-600" /> : <span className="mt-0.5 h-4 w-4 rounded-full border-2 border-slate-300" />}
                  <span>
                    <span className="font-medium">
                      Niveau {a.level} — {optionLabel(a.approver_role)}
                    </span>
                    <span className="block text-xs text-muted">
                      {optionLabel(a.status)} {a.decided_at ? `· ${dateTime(a.decided_at)}` : ""}
                    </span>
                    {a.comment ? <span className="block text-xs italic text-muted">« {a.comment} »</span> : null}
                  </span>
                </li>
              ))}
              {!(r.approvals as Row[]).length ? <li className="text-sm text-muted">Le circuit est déterminé à la soumission (montant, catégorie, urgence).</li> : null}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Commandes générées" />
            <ul className="divide-y divide-line text-sm">
              {(r.orders as Row[]).map((o) => (
                <li key={o.id} className="flex justify-between px-5 py-2.5">
                  <CellLink href={`/erp/achats/commandes/${o.id}`}>{o.number}</CellLink>
                  <StatusBadge status={o.status} />
                </li>
              ))}
              {!(r.orders as Row[]).length ? <li className="px-5 py-3 text-muted">Aucune commande.</li> : null}
            </ul>
          </Card>
        </div>
      </div>
      {["approved"].includes(r.status) && can("procurement:order") ? (
        <Card>
          <CardHeader
            title="Choix du fournisseur"
            subtitle="Classement automatique : prix (40), délai (20), qualité (20), stock (10), zone de livraison (10), pondéré par la couverture."
            actions={
              <Button size="sm" onClick={loadRanking} loading={busy === "rank"}>
                Classer les fournisseurs
              </Button>
            }
          />
          {ranking ? (
            ranking.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-2">Fournisseur</th>
                      <th className="px-4 py-2">Score</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2">Couverture</th>
                      <th className="px-4 py-2">Délai</th>
                      <th className="px-4 py-2">Canal</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ranking.map((s, i) => (
                      <tr key={s.supplier_id} className={i === 0 ? "bg-emerald-50/50" : ""}>
                        <td className="px-4 py-2 font-medium">
                          {s.supplier} {i === 0 ? <Badge tone="success">Recommandé</Badge> : null}
                          <span className="block text-xs text-muted">
                            {Object.entries(s.breakdown)
                              .map(([k, v]) => `${optionLabel(k)} ${v}`)
                              .join(" · ")}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <Progress value={s.score} className="w-24" label={`${number(s.score, 1)}`} />
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{money(s.total)}</td>
                        <td className="px-4 py-2">{s.coverage_pct} %</td>
                        <td className="px-4 py-2">{s.lead_time_days} j</td>
                        <td className="px-4 py-2">{s.whatsapp ? <Badge tone="success">WhatsApp</Badge> : <Badge>E-mail / SMS</Badge>}</td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setOrdering(s);
                              setPrices(Object.fromEntries(s.lines.map((l) => [l.line_id, String(l.unit_price)])));
                            }}
                          >
                            Commander
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <Alert tone="warning">Aucun fournisseur actif ne référence ces articles. Ajoutez des produits au catalogue fournisseurs.</Alert>
              </div>
            )
          ) : null}
        </Card>
      ) : null}

      <Modal
        open={!!ordering}
        onClose={() => setOrdering(null)}
        title={`Commande chez ${ordering?.supplier ?? ""}`}
        size="lg"
        footer={
          <Button
            loading={busy === "order"}
            onClick={async () => {
              if (!ordering) return;
              setBusy("order");
              try {
                const po = await api<Row>(`/procurement/requests/${id}/order`, {
                  method: "POST",
                  idempotent: `${idemKey}-${ordering.supplier_id}`,
                  body: {
                    supplier_id: ordering.supplier_id,
                    prices: Object.fromEntries(Object.entries(prices).filter(([, v]) => v !== "").map(([k, v]) => [k, v])),
                    expected_date: orderForm.expected_date || null,
                    notes: orderForm.notes || null,
                    send: orderForm.send,
                    channel: orderForm.channel || null,
                  },
                });
                toast.success("Bon de commande créé", po.number);
                window.location.href = `/erp/achats/commandes/${po.id}`;
              } catch (err) {
                toast.error("Commande impossible", errorMessage(err));
                setBusy(null);
              }
            }}
          >
            Créer le bon de commande
          </Button>
        }
      >
        {ordering ? (
          <div className="space-y-4">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 text-left">Article</th>
                  <th className="py-1 text-left">Prix unitaire négocié</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l) => {
                  const offer = ordering.lines.find((x) => x.line_id === l.id);
                  return (
                    <tr key={l.id}>
                      <td className="py-1.5 pr-3">
                        {l.description} <span className="text-xs text-muted">({number(l.quantity, 2)} {l.unit})</span>
                        {!offer ? <span className="block text-xs text-amber-700">Non référencé chez ce fournisseur</span> : null}
                      </td>
                      <td className="py-1.5">
                        <Input type="number" min={0} value={prices[l.id] ?? ""} onChange={(e) => setPrices((p) => ({ ...p, [l.id]: e.target.value }))} placeholder={offer ? String(offer.unit_price) : "Prix"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Livraison souhaitée">
                <Input type="date" value={orderForm.expected_date} onChange={(e) => setOrderForm({ ...orderForm, expected_date: e.target.value })} />
              </Field>
              <Field label="Canal d'envoi">
                <Select
                  value={orderForm.channel}
                  onChange={(e) => setOrderForm({ ...orderForm, channel: e.target.value })}
                  options={["whatsapp", "email", "sms"].map((v) => ({ value: v, label: optionLabel(v) }))}
                  placeholder="Automatique (préférence fournisseur)"
                />
              </Field>
            </div>
            <Field label="Notes pour le fournisseur">
              <Textarea value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} rows={2} />
            </Field>
            <Checkbox label="Envoyer immédiatement au fournisseur (si le montant ne requiert pas d'approbation)" checked={orderForm.send} onChange={(v) => setOrderForm({ ...orderForm, send: v })} />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={decide !== null}
        onClose={() => setDecide(null)}
        title={decide ? "Approuver la demande" : "Refuser la demande"}
        size="sm"
        footer={
          <Button
            variant={decide ? "primary" : "danger"}
            loading={busy === "decide"}
            disabled={!decide && comment.trim().length < 3}
            onClick={async () => {
              setBusy("decide");
              try {
                pr.setData(await api(`/procurement/requests/${id}/decision`, { method: "POST", body: { approve: !!decide, comment: comment || null } }));
                setDecide(null);
                setComment("");
              } catch (err) {
                toast.error("Décision impossible", errorMessage(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            Confirmer
          </Button>
        }
      >
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder={decide ? "Commentaire (facultatif)" : "Motif du refus"} />
      </Modal>
      <ConfirmDialog
        open={cancel}
        onClose={() => setCancel(false)}
        title="Annuler la demande"
        reasonLabel="Motif"
        tone="danger"
        confirmLabel="Annuler la demande"
        onConfirm={async (reason) => {
          pr.setData(await api(`/procurement/requests/${id}/cancel`, { method: "POST", body: { approve: false, comment: reason } }));
        }}
      />
    </div>
  );
}

/** Fiche bon de commande : envoi traçable, réponse fournisseur, expéditions, réceptions, factures, notation. */
export function OrderDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const po = useApi<Row>(`/procurement/orders/${id}`);
  const [dialog, setDialog] = useState<null | "send" | "ship" | "rate" | "cancel" | "close" | "edit">(null);
  const [channel, setChannel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  if (po.loading && !po.data) return <Skeleton className="h-96 w-full" />;
  if (!po.data) return <Alert tone="danger">{po.error}</Alert>;
  const o = po.data;
  const lines = (o.lines ?? []) as Row[];
  const cur = o.currency === "XAF" ? "FCFA" : o.currency;
  const act = async (key: string, fn: () => Promise<Row>, message: string) => {
    setBusy(key);
    try {
      po.setData(await fn());
      toast.success(message);
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow={<Link href="/erp/achats?onglet=commandes" className="hover:underline">Bons de commande</Link>}
        title={`Commande ${o.number}`}
        subtitle={`${o.supplier?.legal_name ?? ""} · ${o.project?.code ?? ""} ${o.project?.name ?? ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {o.urgent ? <Badge tone="danger">Urgent</Badge> : null}
            <StatusBadge status={o.status} />
            <a href={apiUrl(`/procurement/orders/${id}/pdf`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
            <a href={apiUrl(`/procurement/orders/${id}/qr`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50" title="QR de réception chantier">
              <QrCode className="h-3.5 w-3.5" /> QR réception
            </a>
          </div>
        }
      />
      <Card className="flex flex-wrap gap-2 p-4">
        {o.status === "pending_approval" && can("procurement:approve") ? (
          <Button size="sm" loading={busy === "approve"} onClick={() => act("approve", () => api(`/procurement/orders/${id}/approve`, { method: "POST" }), "Commande approuvée")}>
            Approuver
          </Button>
        ) : null}
        {["approved", "draft"].includes(o.status) && can("procurement:order") ? (
          <Button size="sm" onClick={() => setDialog("send")}>
            <MessageCircle className="h-4 w-4" /> Envoyer au fournisseur
          </Button>
        ) : null}
        {["sent", "countered"].includes(o.status) && can("procurement:order") ? (
          <Button size="sm" variant="secondary" onClick={() => setDialog("send")}>
            Relancer
          </Button>
        ) : null}
        {o.status === "countered" && can("procurement:order") ? (
          <Button size="sm" variant="accent" loading={busy === "counter"} onClick={() => act("counter", () => api(`/procurement/orders/${id}/accept-counter`, { method: "POST" }), "Contre-offre acceptée")}>
            Accepter la contre-offre
          </Button>
        ) : null}
        {["confirmed", "shipped"].includes(o.status) && can("procurement:order") ? (
          <Button size="sm" variant="secondary" onClick={() => setDialog("ship")}>
            <Truck className="h-4 w-4" /> Saisir une expédition
          </Button>
        ) : null}
        {["draft", "pending_approval", "approved"].includes(o.status) && can("procurement:order") ? (
          <Button size="sm" variant="secondary" onClick={() => setDialog("edit")}>
            Modifier
          </Button>
        ) : null}
        {["received", "partially_received", "invoiced"].includes(o.status) ? (
          <Button size="sm" variant="secondary" onClick={() => setDialog("rate")}>
            <Star className="h-4 w-4" /> Noter le fournisseur
          </Button>
        ) : null}
        <Link href={`/erp/livraisons/receptions/nouvelle?commande=${id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
          Réceptionner
        </Link>
        {["invoiced", "received"].includes(o.status) && can("procurement:order") ? (
          <Button size="sm" variant="ghost" onClick={() => setDialog("close")}>
            Clôturer
          </Button>
        ) : null}
        {!["partially_received", "received", "invoiced", "closed", "cancelled"].includes(o.status) && can("procurement:order") ? (
          <Button size="sm" variant="ghost" onClick={() => setDialog("cancel")}>
            Annuler
          </Button>
        ) : null}
      </Card>
      {o.supplier_response ? (
        <Alert tone={o.supplier_response === "confirm" ? "success" : o.supplier_response === "refuse" ? "danger" : "warning"} title={`Réponse du fournisseur : ${optionLabel(o.supplier_response)}`}>
          {o.supplier_response_note}
          {o.counter_offer?.expected_date ? ` · date proposée ${date(o.counter_offer.expected_date)}` : ""}
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Lignes" />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">Article</th>
                  <th className="px-4 py-2 text-right">Qté</th>
                  <th className="px-4 py-2 text-right">PU HT</th>
                  <th className="px-4 py-2 text-right">Total HT</th>
                  <th className="px-4 py-2 text-right">Reçu / accepté</th>
                  <th className="px-4 py-2 text-right">Facturé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2">
                      {l.description}
                      {l.reference ? <span className="block text-xs text-muted">Réf. {l.reference}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {number(l.quantity, 2)} {l.unit}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(l.unit_price, cur)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(l.total, cur)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {number(l.quantity_received, 2)} / {number(l.quantity_accepted, 2)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{number(l.quantity_invoiced, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto max-w-xs space-y-1 border-t border-line p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Total HT</dt>
              <dd>{money(o.subtotal, cur)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">TVA ({number(o.tax_rate, 2)} %)</dt>
              <dd>{money(o.tax_amount, cur)}</dd>
            </div>
            <div className="flex justify-between font-bold">
              <dt>Total TTC</dt>
              <dd>{money(o.total, cur)}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Informations" />
          <div className="p-5">
            <DescriptionList
              columns={1}
              items={[
                { label: "Livraison souhaitée", value: date(o.expected_date) },
                { label: "Arrivée annoncée", value: dateTime(o.eta) },
                { label: "Adresse de livraison", value: o.delivery_address },
                { label: "Conditions de paiement", value: o.payment_terms },
                { label: "Envoyé le", value: `${dateTime(o.sent_at)} ${o.sent_channel ? `(${optionLabel(o.sent_channel)})` : ""}` },
                { label: "Vu par le fournisseur", value: dateTime(o.supplier_viewed_at) },
                { label: "Confirmé le", value: dateTime(o.supplier_confirmed_at) },
              ]}
            />
            {o.notes ? <p className="mt-3 whitespace-pre-line text-sm text-muted">{o.notes}</p> : null}
          </div>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Messages fournisseur (WhatsApp / e-mail / SMS)" />
          <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">
            {((o.messages ?? []) as Row[]).map((m) => (
              <li key={m.id} className="px-5 py-2.5">
                <p className="flex items-center gap-2 text-xs text-muted">
                  <Badge tone={m.direction === "out" ? "info" : "accent"}>{m.direction === "out" ? "Envoyé" : "Reçu"}</Badge> {optionLabel(m.channel)} · {dateTime(m.created_at)} · <StatusBadge status={m.status} />
                </p>
                <p className="mt-1 whitespace-pre-line">{m.content}</p>
                {m.error ? <p className="text-xs text-red-600">{m.error}</p> : null}
              </li>
            ))}
            {!(o.messages ?? []).length ? <li className="px-5 py-4 text-muted">Aucun message.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Livraisons, réceptions et factures" />
          <div className="space-y-4 p-5 text-sm">
            {((o.deliveries ?? []) as Row[]).map((d) => (
              <div key={d.id} className="flex justify-between gap-2">
                <span>
                  <CellLink href={`/erp/livraisons/${d.id}`}>{d.number}</CellLink>
                  <span className="block text-xs text-muted">
                    {[d.carrier, d.tracking_ref, d.eta ? `ETA ${dateTime(d.eta)}` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <StatusBadge status={d.status} />
              </div>
            ))}
            {((o.receipts ?? []) as Row[]).map((g) => (
              <div key={g.id} className="flex justify-between gap-2">
                <span>
                  <CellLink href={`/erp/livraisons/receptions/${g.id}`}>{g.number}</CellLink>
                  <span className="block text-xs text-muted">
                    {dateTime(g.received_at)} {g.has_exceptions ? "· avec écarts" : ""}
                  </span>
                </span>
                <StatusBadge status={g.status} />
              </div>
            ))}
            {((o.invoices ?? []) as Row[]).map((i) => (
              <div key={i.id} className="flex justify-between gap-2">
                <span>
                  <CellLink href={`/erp/facturation/fournisseurs/${i.id}`}>{i.number}</CellLink>
                  <span className="block text-xs text-muted">
                    {i.supplier_reference} · {money(i.total, cur)}
                  </span>
                </span>
                <StatusBadge status={i.status} />
              </div>
            ))}
            {!(o.deliveries ?? []).length && !(o.receipts ?? []).length && !(o.invoices ?? []).length ? <p className="text-muted">Rien pour le moment.</p> : null}
          </div>
        </Card>
      </div>

      <Modal
        open={dialog === "send"}
        onClose={() => setDialog(null)}
        title="Envoyer le bon de commande"
        size="sm"
        footer={
          <Button
            loading={busy === "send"}
            onClick={async () => {
              setBusy("send");
              try {
                const res = await api<Row>(`/procurement/orders/${id}/send`, { method: "POST", body: { channel: channel || null } });
                po.setData(res);
                toast.success("Bon de commande envoyé", res.sent?.channel ? `Canal : ${optionLabel(res.sent.channel)}` : undefined);
                setDialog(null);
              } catch (err) {
                toast.error("Envoi impossible", errorMessage(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            Envoyer
          </Button>
        }
      >
        <p className="mb-3 text-sm text-muted">Le fournisseur reçoit le PDF et un lien sécurisé pour confirmer, refuser, proposer une contre-offre, annoncer l'expédition et déposer sa facture.</p>
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} options={["whatsapp", "email", "sms"].map((v) => ({ value: v, label: optionLabel(v) }))} placeholder="Canal préféré du fournisseur" aria-label="Canal" />
      </Modal>
      <Modal open={dialog === "ship"} onClose={() => setDialog(null)} title="Expédition annoncée par le fournisseur">
        <SchemaForm endpoint="POST /procurement/orders/{order_id}/shipment" params={{ order_id: id }} onCancel={() => setDialog(null)} onSuccess={(res: Row) => { po.setData(res); setDialog(null); toast.success("Expédition enregistrée"); }} />
      </Modal>
      <Modal open={dialog === "rate"} onClose={() => setDialog(null)} title="Noter le fournisseur">
        <SchemaForm endpoint="POST /procurement/orders/{order_id}/ratings" params={{ order_id: id }} fields={{ goods_receipt_id: { hidden: true } }} onCancel={() => setDialog(null)} onSuccess={() => { setDialog(null); toast.success("Notation enregistrée"); }} />
      </Modal>
      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Modifier la commande" size="xl">
        <SchemaForm endpoint="PATCH /procurement/orders/{order_id}" params={{ order_id: id }} initial={o} partial fields={{ lines: { columns: ["supplier_product_id", "description", "quantity", "unit", "unit_price", "tax_rate"] } }} onCancel={() => setDialog(null)} onSuccess={(res: Row) => { po.setData(res); setDialog(null); }} />
      </Modal>
      <ConfirmDialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title="Annuler la commande"
        reasonLabel="Motif (communiqué au fournisseur)"
        reasonMin={5}
        tone="danger"
        confirmLabel="Annuler la commande"
        onConfirm={async (reason) => {
          po.setData(await api(`/procurement/orders/${id}/cancel`, { method: "POST", body: { reason } }));
        }}
      />
      <ConfirmDialog
        open={dialog === "close"}
        onClose={() => setDialog(null)}
        title="Clôturer la commande"
        reasonLabel="Commentaire de clôture"
        reasonMin={5}
        onConfirm={async (reason) => {
          po.setData(await api(`/procurement/orders/${id}/close`, { method: "POST", body: { reason } }));
        }}
      />
    </div>
  );
}

interface Kpis {
  period_days: number;
  orders: number;
  orders_by_status: Record<string, number>;
  requests: number;
  requests_pending: number;
  avg_approval_hours?: number | null;
  avg_supplier_confirmation_hours?: number | null;
  on_time_delivery_rate?: number | null;
  receipts: number;
  receipts_with_exceptions: number;
  spend_total: string;
  top_suppliers: { supplier_id: string; supplier: string; amount: string }[];
}

export function ProcurementKpis({ projectId }: { projectId?: string }) {
  const [days, setDays] = useState("90");
  const kpis = useApi<Kpis>("/procurement/kpis", { days, project_id: projectId });
  if (kpis.loading && !kpis.data) return <Skeleton className="h-48 w-full" />;
  if (!kpis.data) return <Alert tone="danger">{kpis.error}</Alert>;
  const k = kpis.data;
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select className="w-auto" value={days} onChange={(e) => setDays(e.target.value)} options={["30", "90", "180", "365"].map((d) => ({ value: d, label: `${d} derniers jours` }))} aria-label="Période" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted">Dépenses engagées</p>
          <p className="mt-1 font-title text-2xl font-bold">{money(k.spend_total)}</p>
          <p className="text-xs text-muted">{k.orders} commande(s)</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Délai moyen d'approbation</p>
          <p className="mt-1 font-title text-2xl font-bold">{k.avg_approval_hours !== null && k.avg_approval_hours !== undefined ? `${number(k.avg_approval_hours, 1)} h` : "—"}</p>
          <p className="text-xs text-muted">{k.requests_pending} demande(s) en attente sur {k.requests}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Confirmation fournisseur</p>
          <p className="mt-1 font-title text-2xl font-bold">{k.avg_supplier_confirmation_hours !== null && k.avg_supplier_confirmation_hours !== undefined ? `${number(k.avg_supplier_confirmation_hours, 1)} h` : "—"}</p>
          <p className="text-xs text-muted">délai moyen après envoi</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Livraisons à l'heure</p>
          <p className="mt-1 font-title text-2xl font-bold">{k.on_time_delivery_rate !== null && k.on_time_delivery_rate !== undefined ? `${number(k.on_time_delivery_rate, 1)} %` : "—"}</p>
          <p className="text-xs text-muted">
            {k.receipts_with_exceptions} réception(s) avec écart sur {k.receipts}
          </p>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Commandes par statut" />
          <ul className="divide-y divide-line text-sm">
            {Object.entries(k.orders_by_status).map(([status, count]) => (
              <li key={status} className="flex justify-between px-5 py-2">
                <StatusBadge status={status} />
                <span className="font-semibold">{count}</span>
              </li>
            ))}
            {!Object.keys(k.orders_by_status).length ? <li className="px-5 py-3 text-muted">Aucune commande.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Top fournisseurs (dépenses)" />
          <ul className="divide-y divide-line text-sm">
            {k.top_suppliers.map((s) => (
              <li key={s.supplier_id} className="flex justify-between px-5 py-2">
                <CellLink href={`/erp/fournisseurs/${s.supplier_id}`}>{s.supplier}</CellLink>
                <span className="tabular-nums">{money(s.amount)}</span>
              </li>
            ))}
            {!k.top_suppliers.length ? <li className="px-5 py-3 text-muted">Aucune dépense.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
