"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";

import { AnomaliesList, PredictionsView } from "@/components/erp/ai";
import { Tabs } from "@/components/ui/overlay";
import { Alert, Button, Card, CardHeader, PageTitle, Skeleton, Stat } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { download, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, money, number } from "@/lib/format";
import { useApi } from "@/lib/hooks";

const DATASET_LABELS: Record<string, string> = {
  projects: "Projets (avancement, santé, budget)",
  leads: "Leads CRM (source, statut, SLA)",
  purchase_orders: "Bons de commande",
  supplier_invoices: "Factures fournisseurs (3 pièces)",
  client_invoices: "Factures clients",
  payments: "Paiements",
  stock: "Stocks (quantités, valeur CMUP)",
  attendance: "Pointages",
  incidents: "Incidents QHSE",
  tickets: "Tickets SAV",
  situations: "Situations de travaux",
};

export function WeeklySynthesis() {
  const weekly = useApi<Record<string, any>>("/reports/weekly");
  if (weekly.loading && !weekly.data) return <Skeleton className="h-32" />;
  if (!weekly.data) return <Alert tone="danger">{weekly.error}</Alert>;
  const w = weekly.data;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Depuis le {dateTime(w.since)} (7 derniers jours).</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Nouveaux leads" value={w.leads === null || w.leads === undefined ? "—" : number(w.leads)} tone="info" />
        <Stat label="Bons de commande émis" value={number(w.purchase_orders ?? 0)} />
        <Stat label="Encaissements" value={w.collected === null || w.collected === undefined ? "—" : money(w.collected)} tone="success" />
        <Stat label="Incidents QHSE" value={number(w.incidents ?? 0)} tone={w.incidents ? "warning" : "neutral"} />
      </div>
    </div>
  );
}

export function ExportsView() {
  const { can } = useAuth();
  const toast = useToast();
  const datasets = useApi<string[]>("/reports/datasets");
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (dataset: string, format: "xlsx" | "csv") => {
    setBusy(`${dataset}-${format}`);
    try {
      await download(`/reports/export/${dataset}`, `${dataset}-${new Date().toISOString().slice(0, 10)}.${format}`, { format });
    } catch (err) {
      toast.error("Export impossible", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  if (!can("reports:export")) return <Alert tone="info">Exports réservés aux profils autorisés (permission « reports:export »).</Alert>;
  return (
    <Card>
      <CardHeader title="Exports" subtitle="Données limitées à votre périmètre (projets, confidentialité) ; chaque export est tracé dans le journal d'audit." />
      <ul className="divide-y divide-line">
        {(datasets.data ?? []).map((d) => (
          <li key={d} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              {DATASET_LABELS[d] ?? d}
            </span>
            <span className="flex gap-2">
              <Button size="sm" variant="secondary" loading={busy === `${d}-xlsx`} onClick={() => void run(d, "xlsx")}>
                <Download className="h-4 w-4" /> Excel
              </Button>
              <Button size="sm" variant="ghost" loading={busy === `${d}-csv`} onClick={() => void run(d, "csv")}>
                CSV
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ReportsHub({ initialTab = "synthese" }: { initialTab?: string }) {
  const { can, canAny } = useAuth();
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="space-y-5">
      <PageTitle title="Rapports" subtitle="Synthèse hebdomadaire, exports, anomalies détectées et prévisions coût / délai." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "synthese", label: "Synthèse hebdomadaire" },
          { key: "exports", label: "Exports", hidden: !can("reports:export") },
          { key: "anomalies", label: "Anomalies", hidden: !canAny("reports:read", "finance:read") },
          { key: "previsions", label: "Prévisions" },
        ]}
      />
      {tab === "synthese" ? <WeeklySynthesis /> : null}
      {tab === "exports" ? <ExportsView /> : null}
      {tab === "anomalies" ? <AnomaliesList /> : null}
      {tab === "previsions" ? <PredictionsView /> : null}
    </div>
  );
}
