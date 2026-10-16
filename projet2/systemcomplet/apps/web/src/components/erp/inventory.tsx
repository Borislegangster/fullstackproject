"use client";

import { AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { RefSelect } from "@/components/forms/ref-select";
import { SchemaForm } from "@/components/forms/schema-form";
import { Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

const OPERATIONS = {
  receive: { label: "Entrée", endpoint: "POST /inventory/receive", icon: ArrowDownToLine },
  issue: { label: "Sortie chantier", endpoint: "POST /inventory/issue", icon: ArrowUpFromLine },
  transfer: { label: "Transfert", endpoint: "POST /inventory/transfer", icon: ArrowLeftRight },
  adjust: { label: "Ajustement", endpoint: "POST /inventory/adjust", icon: SlidersHorizontal },
} as const;

type Operation = keyof typeof OPERATIONS;

export function StockOperations({ itemId, onDone }: { itemId?: string; onDone?: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [op, setOp] = useState<Operation | null>(null);
  if (!can("inventory:write")) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(OPERATIONS) as Operation[]).map((k) => {
          const Icon = OPERATIONS[k].icon;
          return (
            <Button key={k} size="sm" variant="secondary" onClick={() => setOp(k)}>
              <Icon className="h-4 w-4" /> {OPERATIONS[k].label}
            </Button>
          );
        })}
      </div>
      <Modal open={!!op} onClose={() => setOp(null)} title={op ? OPERATIONS[op].label : ""} size="lg">
        {op ? (
          <SchemaForm
            endpoint={OPERATIONS[op].endpoint}
            initial={itemId ? { item_id: itemId } : undefined}
            fields={{ item_id: { ref: "stockItems", readOnly: !!itemId }, location_id: { ref: "locations" }, client_mutation_id: { hidden: true } }}
            onCancel={() => setOp(null)}
            onSuccess={() => {
              toast.success("Mouvement enregistré");
              setOp(null);
              onDone?.();
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

interface OverviewRow {
  id: string;
  sku: string;
  name: string;
  category?: string | null;
  unit: string;
  quantity: string;
  reserved: string;
  available: string;
  min_threshold?: string | null;
  average_cost?: string | null;
  value: string;
  below_threshold: boolean;
}

export function StockOverview() {
  const [warehouse, setWarehouse] = useState<string | null>(null);
  const [onlyLow, setOnlyLow] = useState(false);
  const [q, setQ] = useState("");
  const overview = useApi<OverviewRow[]>("/inventory/overview", { warehouse_id: warehouse ?? undefined, below_threshold: onlyLow || undefined });
  const valuation = useApi<{ total: string; warehouses: { warehouse_id: string; warehouse: string; value: string }[] }>("/inventory/valuation");
  const rows = (overview.data ?? []).filter((r) => !q || `${r.sku} ${r.name}`.toLowerCase().includes(q.toLowerCase()));
  const low = (overview.data ?? []).filter((r) => r.below_threshold).length;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Valeur du stock" value={money(valuation.data?.total)} tone="info" />
        <Stat label="Articles suivis" value={overview.data?.length ?? "—"} />
        <Stat label="Sous le seuil d'alerte" value={low} tone={low ? "danger" : "success"} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <RefSelect source={REFS.warehouses} value={warehouse} onChange={setWarehouse} placeholder="Tous les dépôts" />
        </div>
        <Input className="w-64" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer (SKU, désignation)" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Seulement sous le seuil
        </label>
        <div className="ml-auto">
          <StockOperations onDone={() => void overview.reload()} />
        </div>
      </div>
      <Card className="overflow-hidden">
        {overview.loading && !overview.data ? (
          <Skeleton className="m-4 h-48" />
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">Article</th>
                  <th className="px-4 py-2">Catégorie</th>
                  <th className="px-4 py-2 text-right">En stock</th>
                  <th className="px-4 py-2 text-right">Réservé</th>
                  <th className="px-4 py-2 text-right">Disponible</th>
                  <th className="px-4 py-2 text-right">Seuil</th>
                  <th className="px-4 py-2 text-right">CMUP</th>
                  <th className="px-4 py-2 text-right">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className={r.below_threshold ? "bg-red-50/60" : ""}>
                    <td className="px-4 py-2">
                      <CellLink href={`/erp/stocks/${r.id}`}>{r.sku}</CellLink> {r.name}
                    </td>
                    <td className="px-4 py-2">{optionLabel(r.category)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {number(r.quantity, 2)} {r.unit}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{number(r.reserved, 2)}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{number(r.available, 2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {number(r.min_threshold ?? 0, 2)} {r.below_threshold ? <Badge tone="danger">Alerte</Badge> : null}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(r.average_cost)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState title="Aucun article en stock" />
          </div>
        )}
      </Card>
      {valuation.data?.warehouses.length ? (
        <Card>
          <CardHeader title="Valorisation par dépôt" />
          <ul className="divide-y divide-line text-sm">
            {valuation.data.warehouses.map((w) => (
              <li key={w.warehouse_id} className="flex justify-between px-5 py-2">
                <span>{w.warehouse}</span>
                <span className="tabular-nums">{money(w.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

export function StockItemDetail({ id }: { id: string }) {
  const levels = useApi<{ item: Row; on_hand: string; available: string; levels: { warehouse_id: string; warehouse: string; location?: string | null; batch?: string | null; expiry_date?: string | null; quantity: string; reserved: string }[] }>(`/stock-items/${id}/levels`);
  if (levels.loading && !levels.data) return <Skeleton className="h-96 w-full" />;
  if (!levels.data) return <Alert tone="danger">{levels.error}</Alert>;
  const { item } = levels.data;
  return (
    <div className="space-y-5">
      <PageTitle eyebrow={<Link href="/erp/stocks" className="hover:underline">Stocks</Link>} title={`${item.sku} — ${item.name}`} subtitle={optionLabel(item.category)} actions={<StockOperations itemId={id} onDone={() => void levels.reload()} />} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="En stock" value={`${number(levels.data.on_hand, 2)} ${item.unit}`} tone="info" />
        <Stat label="Disponible" value={`${number(levels.data.available, 2)} ${item.unit}`} />
        <Stat label="Seuil d'alerte" value={number(item.min_threshold ?? 0, 2)} tone={toNumber(levels.data.on_hand) < toNumber(item.min_threshold) ? "danger" : "neutral"} />
        <Stat label="Coût moyen pondéré" value={money(item.average_cost)} />
      </div>
      <Card>
        <CardHeader title="Répartition (dépôts, emplacements, lots)" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2">Dépôt</th>
                <th className="px-4 py-2">Emplacement</th>
                <th className="px-4 py-2">Lot</th>
                <th className="px-4 py-2">Péremption</th>
                <th className="px-4 py-2 text-right">Quantité</th>
                <th className="px-4 py-2 text-right">Réservé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {levels.data.levels.map((l, i) => (
                <tr key={i}>
                  <td className="px-4 py-2">{l.warehouse}</td>
                  <td className="px-4 py-2">{l.location ?? "—"}</td>
                  <td className="px-4 py-2">{l.batch ?? "—"}</td>
                  <td className="px-4 py-2">{date(l.expiry_date)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{number(l.quantity, 2)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{number(l.reserved, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <MovementsList itemId={id} />
      <Card className="p-5">
        <DescriptionList
          columns={3}
          items={[
            { label: "Unité", value: item.unit },
            { label: "Réapprovisionnement", value: number(item.reorder_quantity ?? 0, 2) },
            { label: "Consommable", value: item.is_consumable ? "Oui" : "Non" },
            { label: "Code-barres", value: item.barcode },
            { label: "Actif", value: item.is_active ? "Oui" : "Non" },
          ]}
        />
        {item.description ? <p className="mt-3 text-sm text-muted">{item.description}</p> : null}
      </Card>
    </div>
  );
}

export function MovementsList({ itemId }: { itemId?: string }) {
  return (
    <ResourceView
      embedded
      config={{
        title: "Mouvements de stock",
        subtitle: "Entrées, sorties chantier, transferts, ajustements, inventaires — traçabilité complète.",
        path: "/stock-movements",
        query: { item_id: itemId },
        search: false,
        columns: [
          { key: "created_at", label: "Date", format: "datetime" },
          { key: "kind", label: "Mouvement", format: "option" },
          { key: "quantity", label: "Quantité", format: "number", align: "right" },
          { key: "unit_cost", label: "Coût unitaire", format: "money", align: "right" },
          { key: "reference_type", label: "Origine", format: "option", hideOnMobile: true },
          { key: "reason", label: "Motif", hideOnMobile: true },
        ],
        filters: [{ key: "kind", label: "Type", options: ["in", "out", "transfer", "adjustment", "allocation", "return"].map((v) => ({ value: v, label: optionLabel(v) })) }],
      }}
    />
  );
}

export function InventoryCounts() {
  const toast = useToast();
  const [selected, setSelected] = useState<Row | null>(null);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const open = async (row: Row) => {
    const full = await api<Row>(`/inventory-counts/${row.id}`);
    setSelected(full);
    setCounted(Object.fromEntries(((full.lines ?? []) as Row[]).map((l) => [l.item_id, l.counted !== null && l.counted !== undefined ? String(l.counted) : ""])));
  };
  return (
    <>
      <ResourceView
        embedded
        config={{
          title: "Inventaires",
          subtitle: "Comptage par dépôt, écarts calculés, validation avec ajustement automatique.",
          path: "/inventory-counts",
          columns: [
            { key: "number", label: "N°" },
            { key: "lines", label: "Articles", render: (r) => (r.lines ?? []).length },
            { key: "created_at", label: "Ouvert le", format: "date" },
            { key: "validated_at", label: "Validé le", format: "date" },
            { key: "status", label: "Statut", format: "status" },
          ],
          create: { endpoint: "POST /inventory-counts", label: "Lancer un inventaire", perms: ["inventory:write"] },
          actions: [{ key: "open", label: "Saisir / valider", run: (r) => void open(r).catch((err) => toast.error("Ouverture impossible", errorMessage(err))) }],
        }}
      />
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Inventaire ${selected?.number ?? ""}`}
        size="xl"
        footer={
          selected && selected.status !== "validated" ? (
            <>
              <Button
                variant="secondary"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await api<Row>(`/inventory-counts/${selected.id}/lines`, {
                      method: "PUT",
                      body: { lines: Object.entries(counted).filter(([, v]) => v !== "").map(([item_id, v]) => ({ item_id, counted: Number(v) })) },
                    });
                    setSelected(res);
                    toast.success("Comptage enregistré");
                  } catch (err) {
                    toast.error("Enregistrement impossible", errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Enregistrer le comptage
              </Button>
              <Button
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setSelected(await api<Row>(`/inventory-counts/${selected.id}/validate`, { method: "POST" }));
                    toast.success("Inventaire validé", "Les écarts ont été ajustés en stock.");
                  } catch (err) {
                    toast.error("Validation impossible", errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <ClipboardCheck className="h-4 w-4" /> Valider l'inventaire
              </Button>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Article</th>
                  <th className="px-3 py-2 text-right">Théorique</th>
                  <th className="px-3 py-2">Compté</th>
                  <th className="px-3 py-2 text-right">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {((selected.lines ?? []) as Row[]).map((l) => {
                  const v = counted[l.item_id] ?? "";
                  const variance = v === "" ? null : Number(v) - toNumber(l.expected);
                  return (
                    <tr key={l.id ?? l.item_id}>
                      <td className="px-3 py-2">
                        {l.sku} {l.item}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {number(l.expected, 2)} {l.unit}
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min={0} className="w-28" value={v} disabled={selected.status === "validated"} onChange={(e) => setCounted((c) => ({ ...c, [l.item_id]: e.target.value }))} />
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${variance ? (variance < 0 ? "text-red-600" : "text-emerald-700") : ""}`}>{variance === null ? "—" : number(variance, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">
              Statut : <StatusBadge status={selected.status} /> {selected.validated_at ? `· validé le ${dateTime(selected.validated_at)}` : ""}
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export function Allocations() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Affectations chantier",
        subtitle: "Réservation de stock pour un chantier / lot / tâche, sortie, retour, consommation.",
        path: "/stock-allocations",
        columns: [
          { key: "item", label: "Article" },
          { key: "quantity", label: "Réservé", format: "number", align: "right" },
          { key: "quantity_issued", label: "Sorti", format: "number", align: "right" },
          { key: "quantity_returned", label: "Retourné", format: "number", align: "right" },
          { key: "unit", label: "Unité" },
          { key: "created_at", label: "Date", format: "date" },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: ["reserved", "issued", "consumed", "returned", "cancelled"].map((v) => ({ value: v, label: optionLabel(v) })) }],
        create: { endpoint: "POST /stock-allocations", label: "Réserver pour un chantier", perms: ["inventory:write"] },
        actions: [
          { key: "issue", label: "Sortir", endpoint: "POST /stock-allocations/{allocation_id}/issue", when: (r) => r.status === "reserved", perms: ["inventory:write"], fields: { client_mutation_id: { hidden: true } } },
          { key: "return", label: "Retour", endpoint: "POST /stock-allocations/{allocation_id}/return", when: (r) => toNumber(r.quantity_issued) > toNumber(r.quantity_returned), perms: ["inventory:write"], fields: { client_mutation_id: { hidden: true } } },
          { key: "consume", label: "Consommé", path: (r) => `/stock-allocations/${r.id}/consume`, when: (r) => r.status === "issued", perms: ["inventory:write"], confirm: "Déclarer la quantité sortie comme consommée (imputation du coût au chantier) ?" },
          { key: "cancel", label: "Annuler", path: (r) => `/stock-allocations/${r.id}/cancel`, when: (r) => r.status === "reserved", perms: ["inventory:write"], tone: "danger", confirm: "Annuler la réservation ?" },
        ],
      }}
    />
  );
}

export function StockReferentials() {
  return (
    <div className="space-y-8">
      <ResourceView
        embedded
        config={{
          title: "Articles",
          path: "/stock-items",
          href: (r) => `/erp/stocks/${r.id}`,
          columns: [
            { key: "sku", label: "SKU", render: (r) => <CellLink href={`/erp/stocks/${r.id}`}>{r.sku}</CellLink> },
            { key: "name", label: "Désignation" },
            { key: "category", label: "Catégorie", format: "option" },
            { key: "unit", label: "Unité" },
            { key: "min_threshold", label: "Seuil", format: "number" },
            { key: "average_cost", label: "CMUP", format: "money", align: "right" },
            { key: "is_active", label: "Actif", format: "bool" },
          ],
          create: { endpoint: "POST /stock-items", label: "Nouvel article", perms: ["inventory:write"] },
        }}
      />
      <ResourceView
        embedded
        config={{
          title: "Dépôts",
          path: "/warehouses",
          columns: [
            { key: "code", label: "Code" },
            { key: "name", label: "Dépôt" },
            { key: "kind", label: "Type", format: "option" },
            { key: "is_active", label: "Actif", format: "bool" },
          ],
          create: { endpoint: "POST /warehouses", label: "Nouveau dépôt", perms: ["inventory:write"] },
          update: { endpoint: "PATCH /warehouses/{item_id}", perms: ["inventory:write"] },
        }}
      />
      <ResourceView
        embedded
        config={{
          title: "Emplacements",
          path: "/stock-locations",
          columns: [
            { key: "code", label: "Code" },
            { key: "label", label: "Libellé" },
            { key: "warehouse_id", label: "Dépôt", render: (r) => r.warehouse_id?.slice(0, 8) },
          ],
          create: { endpoint: "POST /stock-locations", label: "Nouvel emplacement", perms: ["inventory:write"] },
          update: { endpoint: "PATCH /stock-locations/{item_id}", perms: ["inventory:write"] },
          remove: { path: (r) => `/stock-locations/${r.id}`, perms: ["inventory:write"] },
        }}
      />
      <ResourceView
        embedded
        config={{
          title: "Lots matière",
          path: "/material-batches",
          search: false,
          columns: [
            { key: "batch_number", label: "Lot" },
            { key: "received_at", label: "Reçu le", format: "date" },
            { key: "expiry_date", label: "Péremption", format: "date" },
            { key: "quantity_initial", label: "Quantité initiale", format: "number" },
          ],
        }}
      />
    </div>
  );
}
