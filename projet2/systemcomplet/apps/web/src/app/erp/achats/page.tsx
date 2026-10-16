"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { OrdersList, PendingApprovals, ProcurementKpis, RequestsList } from "@/components/erp/procurement";
import { Tabs } from "@/components/ui/overlay";
import { PageTitle } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const { can } = useAuth();
  const tab = params.get("onglet") ?? "demandes";
  const projectId = params.get("projet") ?? undefined;
  return (
    <div className="space-y-5">
      <PageTitle title="Achats" subtitle="Besoin → demande → approbation → bon de commande → WhatsApp → confirmation → livraison → réception → facture → paiement." />
      <Tabs
        value={tab}
        onChange={(t) => router.replace(`/erp/achats?onglet=${t}${projectId ? `&projet=${projectId}` : ""}`, { scroll: false })}
        tabs={[
          { key: "demandes", label: "Demandes d'achat" },
          { key: "approbations", label: "Mes approbations", hidden: !can("procurement:approve") },
          { key: "commandes", label: "Bons de commande" },
          { key: "indicateurs", label: "Indicateurs" },
        ]}
      />
      {tab === "demandes" ? <RequestsList projectId={projectId} /> : null}
      {tab === "approbations" ? <PendingApprovals /> : null}
      {tab === "commandes" ? <OrdersList projectId={projectId} /> : null}
      {tab === "indicateurs" ? <ProcurementKpis projectId={projectId} /> : null}
    </div>
  );
}

export default function ProcurementPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
