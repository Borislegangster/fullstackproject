"use client";

import { ResourceView, CellLink } from "@/components/erp/resource";
import { Progress } from "@/components/ui/primitives";
import { toNumber } from "@/lib/format";
import { optionLabel } from "@/lib/labels";

const STATUSES = ["prospect", "etude", "conception", "permis", "preparation", "execution", "reception", "garantie", "clos", "suspendu", "annule"];

export default function ProjectsPage() {
  return (
    <ResourceView
      config={{
        title: "Chantiers",
        subtitle: "Projets, sites, phases, lots, planning, équipes et avancement.",
        path: "/projects",
        href: (r) => `/erp/chantiers/${r.id}`,
        exportDataset: "projects",
        columns: [
          { key: "code", label: "Code", sortable: true, render: (r) => <CellLink href={`/erp/chantiers/${r.id}`}>{r.code}</CellLink> },
          { key: "name", label: "Projet", sortable: true },
          { key: "city", label: "Ville", hideOnMobile: true },
          { key: "universe", label: "Univers", format: "option", hideOnMobile: true },
          { key: "status", label: "Statut", render: (r) => optionLabel(r.status) },
          { key: "health", label: "Santé", format: "status" },
          { key: "progress_pct", label: "Avancement", sortable: true, render: (r) => <Progress value={toNumber(r.progress_pct)} className="w-28" label={`${Math.round(toNumber(r.progress_pct))} %`} /> },
          { key: "end_planned", label: "Fin prévue", format: "date", hideOnMobile: true },
        ],
        filters: [
          { key: "status", label: "Statut", options: STATUSES.map((v) => ({ value: v, label: optionLabel(v) })) },
          { key: "health", label: "Santé", options: ["on_track", "at_risk", "critical"].map((v) => ({ value: v, label: optionLabel(v) })) },
          { key: "universe", label: "Univers", options: ["HOME", "BUSINESS", "PREMIUM", "DIASPORA", "ENGINEERING"].map((v) => ({ value: v, label: optionLabel(v) })) },
        ],
        create: {
          endpoint: "POST /projects",
          label: "Nouveau projet",
          perms: ["projects:write"],
          fields: { client_organization_id: { ref: "clientOrganizations" }, settings: { hidden: true }, tags: { span: 2 } },
        },
      }}
    />
  );
}
