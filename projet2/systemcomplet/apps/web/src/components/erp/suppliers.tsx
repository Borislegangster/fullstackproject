"use client";

import { BadgeCheck, Download, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { OrdersList } from "@/components/erp/procurement";
import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { SchemaForm, type FieldConfig } from "@/components/forms/schema-form";
import { BarChartCard } from "@/components/ui/charts";
import { Input } from "@/components/ui/form";
import { Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, PageTitle, Progress, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, money, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

const SUPPLIER_FIELDS: Record<string, FieldConfig> = {
  organization_id: { ref: "supplierOrganizations", label: "Organisation (accès extranet)", help: "Organisation de type « fournisseur » créée dans Administration › Utilisateurs et rôles › Organisations : ses comptes ouvriront l'extranet fournisseur de cette fiche." },
};

export function SuppliersList() {
  return (
    <ResourceView
      config={{
        title: "Fournisseurs",
        subtitle: "Référentiel, catalogue et tarifs, documents légaux, performance, canal WhatsApp.",
        path: "/suppliers",
        href: (r) => `/erp/fournisseurs/${r.id}`,
        columns: [
          { key: "code", label: "Code", render: (r) => <CellLink href={`/erp/fournisseurs/${r.id}`}>{r.code ?? "—"}</CellLink> },
          { key: "legal_name", label: "Raison sociale", sortable: true, render: (r) => r.trade_name || r.legal_name },
          { key: "city", label: "Ville" },
          { key: "categories", label: "Catégories", render: (r) => (r.categories ?? []).slice(0, 3).join(", ") || "—", hideOnMobile: true },
          { key: "quality_score", label: "Qualité", sortable: true, render: (r) => <Progress value={toNumber(r.quality_score)} className="w-24" label={`${number(r.quality_score ?? 0)}`} /> },
          { key: "on_time_rate", label: "Ponctualité", sortable: true, format: "percent", hideOnMobile: true },
          { key: "whatsapp_opt_in", label: "WhatsApp", format: "bool", hideOnMobile: true },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: ["pending", "active", "suspended", "blacklisted"].map((v) => ({ value: v, label: optionLabel(v) })) }],
        create: { endpoint: "POST /suppliers", label: "Nouveau fournisseur", perms: ["suppliers:write"], fields: SUPPLIER_FIELDS },
      }}
    />
  );
}

interface Scorecard {
  kpis: { quality_score?: string | null; service_rate?: string | null; error_rate?: string | null; on_time_rate?: string | null; avg_delay_days?: string | null };
  ratings: { count: number; quality?: number | null; timeliness?: number | null; compliance?: number | null; communication?: number | null; latest: Row[] };
  incidents: Record<string, number>;
  spend_total: string;
  spend_monthly: { month: string; amount: string }[];
}

export function SupplierDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("profil");
  const supplier = useApi<Row>(`/suppliers/${id}`);
  const score = useApi<Scorecard>(tab === "performance" ? `/suppliers/${id}/scorecard` : null);
  const [dialog, setDialog] = useState<null | "edit" | "status" | "doc" | "rating">(null);
  const [compareQ, setCompareQ] = useState("");
  const [compare, setCompare] = useState<Row[] | null>(null);
  if (supplier.loading && !supplier.data) return <Skeleton className="h-96 w-full" />;
  if (!supplier.data) return <Alert tone="danger">{supplier.error}</Alert>;
  const s = supplier.data;
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/fournisseurs" className="hover:underline">Fournisseurs</Link>}
        title={s.trade_name || s.legal_name}
        subtitle={[s.code, s.legal_name !== s.trade_name ? s.legal_name : null, s.city].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            {s.whatsapp_opt_in ? <Badge tone="success">WhatsApp</Badge> : null}
            {can("suppliers:write") ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setDialog("edit")}>
                  Modifier
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("status")}>
                  Changer le statut
                </Button>
              </>
            ) : null}
          </div>
        }
      />
      {s.expired_documents?.length ? <Alert tone="warning" title="Documents expirés">{(s.expired_documents as string[]).join(", ")}</Alert> : null}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "profil", label: "Profil" },
          { key: "catalogue", label: "Catalogue et tarifs" },
          { key: "commandes", label: "Commandes", count: s.orders_count },
          { key: "documents", label: "Documents", count: (s.documents ?? []).length },
          { key: "performance", label: "Performance" },
          { key: "incidents", label: "Incidents", count: s.open_incidents },
          { key: "contacts", label: "Contacts" },
        ]}
      />
      {tab === "profil" ? (
        <Card className="p-5">
          <DescriptionList
            columns={3}
            items={[
              { label: "Raison sociale", value: s.legal_name },
              { label: "Forme juridique", value: s.legal_form },
              { label: "NIU", value: s.tax_id },
              { label: "RCCM", value: s.trade_register },
              { label: "Adresse", value: [s.address, s.city, s.country].filter(Boolean).join(", ") },
              { label: "Catégories", value: (s.categories ?? []).join(", ") },
              { label: "Zones de livraison", value: (s.delivery_zones ?? []).join(", ") },
              { label: "Délai de livraison", value: `${s.lead_time_days ?? "—"} j` },
              { label: "Commande minimum", value: money(s.min_order_amount) },
              { label: "Conditions de paiement", value: `${s.payment_terms ?? ""} (${s.payment_terms_days ?? 0} j)` },
              { label: "E-mail", value: s.email },
              { label: "Téléphone / SMS", value: [s.phone, s.sms_number].filter(Boolean).join(" / ") },
              { label: "WhatsApp", value: `${s.whatsapp_number ?? "—"} ${s.whatsapp_opt_in ? "(accord donné)" : "(pas d'accord)"}` },
              { label: "Canal préféré", value: optionLabel(s.preferred_channel) },
              { label: "Banque", value: `${s.bank_name ?? "—"} ${s.bank_account_masked ? `· ${s.bank_account_masked}` : ""}` },
              { label: "Mobile Money", value: s.mobile_money_masked },
            ]}
          />
          {s.notes ? <p className="mt-4 whitespace-pre-line text-sm text-muted">{s.notes}</p> : null}
        </Card>
      ) : null}
      {tab === "catalogue" ? (
        <div className="space-y-6">
          <ResourceView
            embedded
            config={{
              title: "Catalogue",
              path: "/supplier-products",
              query: { supplier_id: id },
              columns: [
                { key: "reference", label: "Réf." },
                { key: "name", label: "Produit" },
                { key: "category", label: "Catégorie", format: "option" },
                { key: "unit_price", label: "Prix", format: "money", align: "right" },
                { key: "unit", label: "Unité" },
                { key: "lead_time_days", label: "Délai (j)", format: "number" },
                { key: "stock_available", label: "Stock", format: "number" },
                { key: "price_valid_until", label: "Prix valable jusqu'au", format: "date" },
                { key: "is_active", label: "Actif", format: "bool" },
              ],
              create: { endpoint: "POST /supplier-products", label: "Nouveau produit", fixed: { supplier_id: id }, perms: ["suppliers:write"] },
              update: { endpoint: "PATCH /supplier-products/{item_id}", exclude: ["supplier_id"], perms: ["suppliers:write"] },
              remove: { path: (r) => `/supplier-products/${r.id}`, perms: ["suppliers:write"] },
              detail: (row) => <PriceHistory productId={row.id} />,
            }}
          />
          <Card>
            <CardHeader title="Comparateur multi-fournisseurs" subtitle="Prix, délai, stock et qualité des fournisseurs actifs pour un article." />
            <form
              className="flex gap-2 p-4"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setCompare(await api<Row[]>("/supplier-products/compare", { query: { q: compareQ } }));
                } catch (err) {
                  toast.error("Comparaison impossible", errorMessage(err));
                }
              }}
            >
              <Input value={compareQ} onChange={(e) => setCompareQ(e.target.value)} placeholder="Ciment, fer à béton HA12, carrelage…" />
              <Button type="submit" disabled={compareQ.trim().length < 2}>
                Comparer
              </Button>
            </form>
            {compare ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-2">Fournisseur</th>
                      <th className="px-4 py-2">Produit</th>
                      <th className="px-4 py-2 text-right">Prix</th>
                      <th className="px-4 py-2">Délai</th>
                      <th className="px-4 py-2">Stock</th>
                      <th className="px-4 py-2">Qualité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {compare.map((c, i) => (
                      <tr key={c.product.id} className={i === 0 ? "bg-emerald-50/60" : ""}>
                        <td className="px-4 py-2">
                          <CellLink href={`/erp/fournisseurs/${c.supplier.id}`}>{c.supplier.legal_name}</CellLink>
                        </td>
                        <td className="px-4 py-2">{c.product.name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {money(c.product.unit_price)}/{c.product.unit}
                        </td>
                        <td className="px-4 py-2">{c.lead_time_days ?? "—"} j</td>
                        <td className="px-4 py-2">{c.product.stock_available !== null && c.product.stock_available !== undefined ? number(c.product.stock_available) : "—"}</td>
                        <td className="px-4 py-2">{number(c.supplier.quality_score ?? 0)}</td>
                      </tr>
                    ))}
                    {!compare.length ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 text-center text-muted">
                          Aucun produit correspondant.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
      {tab === "commandes" ? <OrdersList supplierId={id} /> : null}
      {tab === "documents" ? (
        <Card>
          <CardHeader title="Documents légaux et qualité" actions={can("suppliers:write") ? <Button size="sm" onClick={() => setDialog("doc")}><Upload className="h-4 w-4" /> Ajouter</Button> : null} />
          <ul className="divide-y divide-line text-sm">
            {((s.documents ?? []) as Row[]).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span>
                  <span className="font-medium">{d.title}</span> <Badge>{optionLabel(d.kind)}</Badge>
                  <span className="block text-xs text-muted">
                    Valable jusqu'au {date(d.valid_until)} {d.verified ? "· vérifié" : "· à vérifier"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <a href={apiUrl(`/supplier-documents/${d.id}/file`)} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 text-brand-600 hover:bg-brand-50" aria-label="Télécharger">
                    <Download className="h-4 w-4" />
                  </a>
                  {!d.verified && can("suppliers:write") ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await api(`/supplier-documents/${d.id}/verify`, { method: "POST" });
                          void supplier.reload();
                        } catch (err) {
                          toast.error("Vérification impossible", errorMessage(err));
                        }
                      }}
                    >
                      <BadgeCheck className="h-4 w-4" /> Marquer vérifié
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
            {!(s.documents ?? []).length ? <li className="px-5 py-4 text-muted">Aucun document.</li> : null}
          </ul>
        </Card>
      ) : null}
      {tab === "performance" ? (
        score.loading ? (
          <Skeleton className="h-64 w-full" />
        ) : score.data ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Stat label="Score qualité" value={number(score.data.kpis.quality_score ?? 0, 1)} tone="info" />
              <Stat label="Taux de service" value={`${number(score.data.kpis.service_rate ?? 0, 1)} %`} />
              <Stat label="Taux d'erreur" value={`${number(score.data.kpis.error_rate ?? 0, 1)} %`} tone={toNumber(score.data.kpis.error_rate) > 5 ? "warning" : "neutral"} />
              <Stat label="Ponctualité" value={`${number(score.data.kpis.on_time_rate ?? 0, 1)} %`} />
              <Stat label="Retard moyen" value={`${number(score.data.kpis.avg_delay_days ?? 0, 1)} j`} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Achats sur 12 mois" subtitle={`Total : ${money(score.data.spend_total)}`} />
                <div className="p-4">
                  <BarChartCard data={score.data.spend_monthly.map((m) => ({ month: (m.month ?? "").slice(0, 7), amount: toNumber(m.amount) }))} x="month" series={[{ key: "amount", label: "Montant" }]} />
                </div>
              </Card>
              <Card>
                <CardHeader title={`Notes (${score.data.ratings.count})`} actions={<Button size="sm" variant="secondary" onClick={() => setDialog("rating")}>Noter</Button>} />
                <div className="space-y-3 p-5">
                  {(["quality", "timeliness", "compliance", "communication"] as const).map((k) => (
                    <Progress key={k} value={((score.data!.ratings[k] ?? 0) / 5) * 100} label={`${{ quality: "Qualité", timeliness: "Ponctualité", compliance: "Conformité", communication: "Communication" }[k]} — ${number(score.data!.ratings[k] ?? 0, 2)} / 5`} />
                  ))}
                  {Object.keys(score.data.incidents).length ? (
                    <p className="text-sm text-muted">
                      Incidents :{" "}
                      {Object.entries(score.data.incidents)
                        .map(([k, v]) => `${optionLabel(k)} ${v}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <Alert tone="danger">{score.error}</Alert>
        )
      ) : null}
      {tab === "incidents" ? (
        <ResourceView
          embedded
          config={{
            title: "Incidents fournisseur",
            path: "/supplier-incidents",
            query: { supplier_id: id },
            columns: [
              { key: "kind", label: "Type", format: "option" },
              { key: "description", label: "Description" },
              { key: "amount_impact", label: "Impact", format: "money", align: "right" },
              { key: "created_at", label: "Date", format: "date" },
              { key: "status", label: "Statut", format: "status" },
            ],
            create: {
              endpoint: "POST /supplier-incidents",
              label: "Déclarer un incident",
              fixed: { supplier_id: id },
              exclude: ["status", "resolution", "resolved_at"],
              fields: { purchase_order_id: { ref: { ...REFS.purchaseOrders, query: { supplier_id: id } }, label: "Bon de commande concerné" }, goods_receipt_id: { label: "Réception concernée" } },
              perms: ["procurement:order", "suppliers:write"],
            },
            actions: [{ key: "resolve", label: "Résoudre", endpoint: "POST /supplier-incidents/{incident_id}/resolve", when: (r) => r.status === "open", perms: ["procurement:order"] }],
          }}
        />
      ) : null}
      {tab === "contacts" ? (
        <ResourceView
          embedded
          config={{
            title: "Contacts",
            path: "/supplier-contacts",
            query: { supplier_id: id },
            columns: [
              { key: "kind", label: "Rôle", format: "option" },
              { key: "name", label: "Nom" },
              { key: "email", label: "E-mail" },
              { key: "phone", label: "Téléphone" },
              { key: "whatsapp", label: "WhatsApp" },
              { key: "is_primary", label: "Principal", format: "bool" },
            ],
            create: { endpoint: "POST /supplier-contacts", label: "Nouveau contact", fixed: { supplier_id: id }, perms: ["suppliers:write"] },
            update: { endpoint: "PATCH /supplier-contacts/{item_id}", exclude: ["supplier_id"], perms: ["suppliers:write"] },
            remove: { path: (r) => `/supplier-contacts/${r.id}`, perms: ["suppliers:write"] },
          }}
        />
      ) : null}

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Modifier le fournisseur" size="xl">
        <SchemaForm endpoint="PATCH /suppliers/{supplier_id}" params={{ supplier_id: id }} initial={s} partial fields={SUPPLIER_FIELDS} onCancel={() => setDialog(null)} onSuccess={(res: Row) => { supplier.setData({ ...s, ...res }); setDialog(null); }} />
      </Modal>
      <Modal open={dialog === "status"} onClose={() => setDialog(null)} title="Statut du fournisseur">
        <SchemaForm endpoint="POST /suppliers/{supplier_id}/status" params={{ supplier_id: id }} initial={{ status: s.status }} onCancel={() => setDialog(null)} onSuccess={() => { void supplier.reload(); setDialog(null); }} columns={1} />
      </Modal>
      <Modal open={dialog === "doc"} onClose={() => setDialog(null)} title="Ajouter un document">
        <SchemaForm
          endpoint="POST /suppliers/{supplier_id}/documents"
          params={{ supplier_id: id }}
          fields={{ kind: { options: ["rccm", "niu", "attestation_fiscale", "cnps", "assurance", "certification", "rib", "fiche_technique", "autre"].map((v) => ({ value: v, label: optionLabel(v) })) } }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            void supplier.reload();
            setDialog(null);
          }}
          columns={1}
        />
      </Modal>
      <Modal open={dialog === "rating"} onClose={() => setDialog(null)} title="Noter le fournisseur">
        <SchemaForm endpoint="POST /suppliers/{supplier_id}/ratings" params={{ supplier_id: id }} fields={{ goods_receipt_id: { hidden: true } }} onCancel={() => setDialog(null)} onSuccess={() => { void score.reload(); setDialog(null); }} />
      </Modal>
    </div>
  );
}

function PriceHistory({ productId }: { productId: string }) {
  const history = useApi<Row[]>(`/supplier-products/${productId}/price-history`);
  if (history.loading) return <Skeleton className="h-32 w-full" />;
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold">Historique des prix</p>
      <ul className="divide-y divide-line text-sm">
        {(history.data ?? []).map((h) => (
          <li key={h.id} className="flex justify-between py-2">
            <span>
              {date(h.valid_from)} → {date(h.valid_to)} <span className="text-xs text-muted">({optionLabel(h.source)} {h.reference ?? ""})</span>
            </span>
            <span className="tabular-nums">{money(h.unit_price)}</span>
          </li>
        ))}
        {!history.data?.length ? <li className="py-2 text-muted">Aucun historique.</li> : null}
      </ul>
    </div>
  );
}
