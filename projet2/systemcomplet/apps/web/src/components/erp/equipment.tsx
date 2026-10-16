"use client";

import { Download, MapPin, QrCode, Upload, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { SchemaForm } from "@/components/forms/schema-form";
import { Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, PageTitle, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

const CATEGORIES = ["engin", "vehicule", "outillage", "echafaudage", "topographie", "informatique"];
const STATUSES = ["available", "assigned", "maintenance", "broken", "retired"];

export function EquipmentList() {
  return (
    <ResourceView
      config={{
        title: "Matériel",
        subtitle: "Parc, affectations chantier, utilisation, maintenance préventive/corrective, consommables, incidents, coûts.",
        path: "/equipment",
        href: (r) => `/erp/materiel/${r.id}`,
        columns: [
          { key: "code", label: "Code", render: (r) => <CellLink href={`/erp/materiel/${r.id}`}>{r.code}</CellLink> },
          { key: "name", label: "Désignation" },
          { key: "category", label: "Catégorie", format: "option" },
          { key: "ownership", label: "Propriété", format: "option", hideOnMobile: true },
          { key: "condition", label: "État", format: "option", hideOnMobile: true },
          { key: "meter_hours", label: "Heures", format: "number", hideOnMobile: true },
          { key: "inspection_until", label: "Contrôle jusqu'au", format: "date", hideOnMobile: true },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [
          { key: "status", label: "Statut", options: STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) },
          { key: "category", label: "Catégorie", options: CATEGORIES.map((v) => ({ value: v, label: optionLabel(v) })) },
        ],
        create: { endpoint: "POST /equipment", label: "Nouveau matériel", perms: ["equipment:write"] },
      }}
    />
  );
}

export function EquipmentDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("fiche");
  const eq = useApi<Row>(`/equipment/${id}`);
  const usage = useApi<{ items: Row[] }>(tab === "utilisation" ? `/equipment/${id}/usage` : null, { page_size: 50 });
  const costs = useApi<Row>(tab === "couts" ? `/equipment/${id}/costs` : null);
  const [dialog, setDialog] = useState<null | "edit" | "assign" | "return" | "usage" | "location" | "doc" | "order" | "incident">(null);
  if (eq.loading && !eq.data) return <Skeleton className="h-96 w-full" />;
  if (!eq.data) return <Alert tone="danger">{eq.error}</Alert>;
  const e = eq.data;
  const done = (msg: string) => {
    setDialog(null);
    toast.success(msg);
    void eq.reload();
    void usage.reload();
  };
  const write = can("equipment:write");
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/materiel" className="hover:underline">Matériel</Link>}
        title={`${e.code} — ${e.name}`}
        subtitle={[optionLabel(e.category), e.brand, e.model, e.registration].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={e.status} />
            <a href={apiUrl(`/equipment/${id}/qr`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
              <QrCode className="h-3.5 w-3.5" /> Étiquette QR
            </a>
            {write ? (
              <>
                {e.status === "available" ? <Button size="sm" onClick={() => setDialog("assign")}>Affecter à un chantier</Button> : null}
                {e.status === "assigned" ? <Button size="sm" variant="secondary" onClick={() => setDialog("return")}>Retour au dépôt</Button> : null}
                <Button size="sm" variant="secondary" onClick={() => setDialog("edit")}>
                  Modifier
                </Button>
              </>
            ) : null}
          </div>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "fiche", label: "Fiche" },
          { key: "utilisation", label: "Utilisation" },
          { key: "maintenance", label: "Maintenance" },
          { key: "incidents", label: "Incidents", count: (e.incidents ?? []).filter((i: Row) => i.status !== "resolved").length },
          { key: "consommables", label: "Consommables" },
          { key: "couts", label: "Coûts" },
        ]}
      />
      {tab === "fiche" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <DescriptionList
              columns={3}
              items={[
                { label: "N° de série", value: e.serial_number },
                { label: "Acquisition", value: `${date(e.acquisition_date)} · ${money(e.acquisition_cost)}` },
                { label: "Propriété", value: optionLabel(e.ownership) },
                { label: "État", value: optionLabel(e.condition) },
                { label: "Coût horaire / journalier", value: `${money(e.hourly_cost)} / ${money(e.daily_cost)}` },
                { label: "Compteurs", value: `${number(e.meter_hours ?? 0)} h · ${number(e.meter_km ?? 0)} km` },
                { label: "Assurance jusqu'au", value: date(e.insurance_until) },
                { label: "Contrôle technique jusqu'au", value: date(e.inspection_until) },
                { label: "Géolocalisation", value: e.location_tracking ? `${e.tracker_id ?? "active"}` : "Non" },
                { label: "Dernière position", value: e.last_latitude ? `${number(e.last_latitude, 5)}, ${number(e.last_longitude, 5)} · ${dateTime(e.last_located_at)}` : "—" },
              ]}
            />
            {e.notes ? <p className="mt-4 whitespace-pre-line text-sm text-muted">{e.notes}</p> : null}
            {write ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setDialog("location")}>
                  <MapPin className="h-4 w-4" /> Mettre à jour la position
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("doc")}>
                  <Upload className="h-4 w-4" /> Ajouter un document
                </Button>
              </div>
            ) : null}
          </Card>
          <Card>
            <CardHeader title="Affectations" />
            <ul className="divide-y divide-line text-sm">
              {((e.assignments ?? []) as Row[]).map((a) => (
                <li key={a.id} className="px-5 py-2.5">
                  <span className="font-medium">
                    <CellLink href={`/erp/chantiers/${a.project_id}`}>Chantier</CellLink> · {date(a.start_date)} → {date(a.end_date ?? a.returned_at)}
                  </span>
                  <span className="block text-xs text-muted">{optionLabel(a.status)}</span>
                </li>
              ))}
              {!(e.assignments ?? []).length ? <li className="px-5 py-3 text-muted">Jamais affecté.</li> : null}
            </ul>
            {((e.document_ids ?? []) as string[]).length ? (
              <div className="border-t border-line p-4">
                <p className="mb-2 text-sm font-semibold">Documents</p>
                <ul className="space-y-1 text-sm">
                  {(e.document_ids as string[]).map((fid, i) => (
                    <li key={fid}>
                      <a href={apiUrl(`/equipment/${id}/documents/${fid}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                        <Download className="h-3.5 w-3.5" /> Document {i + 1}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
      {tab === "utilisation" ? (
        <Card>
          <CardHeader title="Relevés d'utilisation" actions={write ? <Button size="sm" onClick={() => setDialog("usage")}>Saisir un relevé</Button> : null} />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2 text-right">Heures</th>
                  <th className="px-4 py-2 text-right">Km</th>
                  <th className="px-4 py-2 text-right">Carburant</th>
                  <th className="px-4 py-2 text-right">Coût</th>
                  <th className="px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(usage.data?.items ?? []).map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2">{date(u.usage_date)}</td>
                    <td className="px-4 py-2 text-right">{number(u.hours, 1)}</td>
                    <td className="px-4 py-2 text-right">{number(u.km)}</td>
                    <td className="px-4 py-2 text-right">
                      {number(u.fuel_liters, 1)} L · {money(u.fuel_cost)}
                    </td>
                    <td className="px-4 py-2 text-right">{money(u.cost)}</td>
                    <td className="px-4 py-2">{u.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      {tab === "maintenance" ? (
        <div className="space-y-6">
          <ResourceView
            embedded
            config={{
              title: "Plans de maintenance préventive",
              path: "/maintenance-plans",
              query: { equipment_id: id },
              columns: [
                { key: "title", label: "Plan" },
                { key: "interval_days", label: "Tous les (jours)", format: "number" },
                { key: "interval_hours", label: "Toutes les (heures)", format: "number" },
                { key: "last_done_at", label: "Dernière", format: "date" },
                { key: "next_due_date", label: "Prochaine", format: "date" },
                { key: "is_active", label: "Actif", format: "bool" },
              ],
              create: { endpoint: "POST /maintenance-plans", label: "Nouveau plan", fixed: { equipment_id: id }, perms: ["maintenance:manage", "equipment:write"] },
              update: { endpoint: "PATCH /maintenance-plans/{item_id}", exclude: ["equipment_id"], perms: ["maintenance:manage", "equipment:write"] },
              remove: { path: (r) => `/maintenance-plans/${r.id}`, perms: ["maintenance:manage"] },
            }}
          />
          <ResourceView
            embedded
            config={{
              title: "Ordres de maintenance",
              path: "/maintenance-orders",
              query: { equipment_id: id },
              columns: [
                { key: "number", label: "N°" },
                { key: "kind", label: "Type", format: "option" },
                { key: "scheduled_date", label: "Prévu le", format: "date" },
                { key: "done_at", label: "Réalisé le", format: "datetime" },
                { key: "cost", label: "Coût", format: "money", align: "right" },
                { key: "downtime_hours", label: "Immobilisation (h)", format: "number" },
                { key: "status", label: "Statut", format: "status" },
              ],
              toolbar: can("maintenance:manage") || write ? (
                <Button size="sm" onClick={() => setDialog("order")}>
                  <Wrench className="h-4 w-4" /> Nouvel ordre
                </Button>
              ) : undefined,
              actions: [
                { key: "start", label: "Démarrer", path: (r) => `/maintenance-orders/${r.id}/start`, when: (r) => r.status === "scheduled", perms: ["maintenance:manage", "equipment:write"], confirm: "Démarrer l'intervention (matériel indisponible) ?" },
                { key: "complete", label: "Terminer", endpoint: "POST /maintenance-orders/{order_id}/complete", when: (r) => r.status === "in_progress", perms: ["maintenance:manage", "equipment:write"] },
              ],
            }}
          />
        </div>
      ) : null}
      {tab === "incidents" ? (
        <Card>
          <CardHeader title="Incidents (panne, dommage, vol, accident)" actions={<Button size="sm" onClick={() => setDialog("incident")}>Déclarer un incident</Button>} />
          <ul className="divide-y divide-line text-sm">
            {((e.incidents ?? []) as Row[]).map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span>
                  <span className="font-medium">{optionLabel(i.kind)}</span> <Badge tone={["high", "critical"].includes(i.severity) ? "danger" : "warning"}>{optionLabel(i.severity)}</Badge>
                  <span className="block text-xs text-muted">
                    {dateTime(i.occurred_at)} · {money(i.cost)} {i.description ? `· ${i.description}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={i.status} />
                  {i.status !== "resolved" && write ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await api(`/equipment-incidents/${i.id}/resolve`, { method: "POST" });
                          void eq.reload();
                        } catch (err) {
                          toast.error("Action impossible", errorMessage(err));
                        }
                      }}
                    >
                      Résolu
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
            {!(e.incidents ?? []).length ? <li className="px-5 py-4 text-muted">Aucun incident.</li> : null}
          </ul>
        </Card>
      ) : null}
      {tab === "consommables" ? (
        <ResourceView
          embedded
          config={{
            title: "Consommables",
            path: "/equipment-consumables",
            query: { equipment_id: id },
            columns: [
              { key: "name", label: "Consommable" },
              { key: "replacement_interval_hours", label: "Remplacement (h)", format: "number" },
              { key: "last_replaced_at", label: "Dernier remplacement", format: "date" },
              { key: "quantity_per_replacement", label: "Quantité", format: "number" },
              { key: "unit", label: "Unité" },
            ],
            create: { endpoint: "POST /equipment-consumables", label: "Nouveau consommable", fixed: { equipment_id: id }, perms: ["equipment:write"] },
            update: { endpoint: "PATCH /equipment-consumables/{item_id}", exclude: ["equipment_id"], perms: ["equipment:write"] },
            remove: { path: (r) => `/equipment-consumables/${r.id}`, perms: ["equipment:write"] },
          }}
        />
      ) : null}
      {tab === "couts" ? (
        costs.data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Coût total (période)" value={money(costs.data.total_cost)} tone="info" />
            <Stat label="Utilisation" value={`${money(costs.data.usage_cost)}`} hint={`${number(costs.data.hours, 1)} h · ${number(costs.data.fuel_liters, 1)} L`} />
            <Stat label="Maintenance" value={money(costs.data.maintenance_cost)} hint={`${number(costs.data.downtime_hours, 1)} h d'immobilisation`} />
            <Stat label="Taux d'utilisation" value={costs.data.utilization_rate !== null ? `${number(costs.data.utilization_rate, 1)} %` : "—"} hint={`${costs.data.incidents} incident(s) · ${money(costs.data.incident_cost)}`} />
          </div>
        ) : (
          <Skeleton className="h-32 w-full" />
        )
      ) : null}

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Modifier le matériel" size="xl">
        <SchemaForm endpoint="PATCH /equipment/{equipment_id}" params={{ equipment_id: id }} initial={e} partial fields={{ rental_supplier_id: { ref: "suppliers" } }} onCancel={() => setDialog(null)} onSuccess={() => done("Matériel mis à jour")} />
      </Modal>
      <Modal open={dialog === "assign"} onClose={() => setDialog(null)} title="Affecter à un chantier">
        <SchemaForm endpoint="POST /equipment/{equipment_id}/assign" params={{ equipment_id: id }} onCancel={() => setDialog(null)} onSuccess={() => done("Matériel affecté")} />
      </Modal>
      <Modal open={dialog === "return"} onClose={() => setDialog(null)} title="Retour au dépôt">
        <SchemaForm endpoint="POST /equipment/{equipment_id}/return" params={{ equipment_id: id }} onCancel={() => setDialog(null)} onSuccess={() => done("Retour enregistré")} />
      </Modal>
      <Modal open={dialog === "usage"} onClose={() => setDialog(null)} title="Relevé d'utilisation">
        <SchemaForm endpoint="POST /equipment/{equipment_id}/usage" params={{ equipment_id: id }} onCancel={() => setDialog(null)} onSuccess={() => done("Relevé enregistré")} />
      </Modal>
      <Modal open={dialog === "location"} onClose={() => setDialog(null)} title="Position du matériel">
        <SchemaForm endpoint="POST /equipment/{equipment_id}/location" params={{ equipment_id: id }} onCancel={() => setDialog(null)} onSuccess={() => done("Position enregistrée")} />
      </Modal>
      <Modal open={dialog === "doc"} onClose={() => setDialog(null)} title="Ajouter un document">
        <SchemaForm endpoint="POST /equipment/{equipment_id}/documents" params={{ equipment_id: id }} onCancel={() => setDialog(null)} onSuccess={() => done("Document ajouté")} columns={1} />
      </Modal>
      <Modal open={dialog === "order"} onClose={() => setDialog(null)} title="Ordre de maintenance">
        <SchemaForm endpoint="POST /equipment/{equipment_id}/maintenance-orders" params={{ equipment_id: id }} fields={{ plan_id: { ref: { path: "/maintenance-plans", query: { equipment_id: id }, label: (r: Row) => r.title, paginated: true } } }} onCancel={() => setDialog(null)} onSuccess={() => done("Ordre créé")} />
      </Modal>
      <Modal open={dialog === "incident"} onClose={() => setDialog(null)} title="Déclarer un incident">
        <SchemaForm endpoint="POST /equipment/{equipment_id}/incidents" params={{ equipment_id: id }} fields={{ photo_file_ids: { hidden: true } }} onCancel={() => setDialog(null)} onSuccess={() => done("Incident déclaré")} />
      </Modal>
    </div>
  );
}
