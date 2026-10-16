"use client";

import { HandCoins, Landmark, Lock, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ESCROW_STATUS, type EscrowItemRow, type EscrowOverview } from "@/components/client/escrow-panel";
import { ClientModuleCard } from "@/components/erp/client-module-card";
import { SchemaForm } from "@/components/forms/schema-form";
import { Modal, Tabs } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, EmptyState, PageTitle, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, money, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

// ============================================================================ I5 — financement intégré
interface PartnerRow {
  id: string;
  name: string;
  kind: string;
  description?: string | null;
  rate_min: string;
  rate_max: string;
  max_years: number;
  min_down_payment_pct: string;
  max_debt_ratio_pct: string;
  fees_pct: string;
  requirements: string[];
  contact_name?: string | null;
  contact_email?: string | null;
  active: boolean;
  sort_order: number;
}

interface ApplicationRow {
  id: string;
  number: string;
  project_id?: string | null;
  applicant_name: string;
  amount: string;
  down_payment: string;
  duration_months: number;
  status: string;
  submitted_at?: string | null;
  documents: { kind: string; label?: string | null; name: string }[];
  partners: { share_id: string; partner: string; status: string; viewed_at?: string | null; offer?: Record<string, string> | null; responded_at?: string | null; revoked: boolean }[];
  accepted_offer?: Record<string, string> | null;
}

const APP_FILTERS = [
  { key: "", label: "Tous" },
  { key: "submitted", label: "Transmis" },
  { key: "offer", label: "Offre reçue" },
  { key: "accepted", label: "Acceptés" },
  { key: "draft", label: "Brouillons" },
  { key: "withdrawn", label: "Retirés" },
];

export function FinancingAdminPage() {
  const toast = useToast();
  const { can } = useAuth();
  const partners = useApi<PartnerRow[]>("/financing/partners");
  const [filter, setFilter] = useState("submitted");
  const apps = useApi<ApplicationRow[]>("/financing/applications", filter ? { status: filter } : undefined, [filter]);
  const [editing, setEditing] = useState<PartnerRow | "new" | null>(null);
  const program = useApi<{ client_portal: boolean; reference_rate: string }>("/financing/program");
  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <HandCoins className="h-7 w-7 text-brand-600" /> Financement des clients
          </span>
        }
        subtitle="Établissements partenaires (critères affichés au simulateur public) et dossiers transmis avec l'accord des clients."
      />
      {program.data ? (
        <ClientModuleCard
          name="Financement"
          enabled={program.data.client_portal}
          endpoint="/financing/program"
          field="client_portal"
          onChange={() => void program.reload()}
          openText="Les clients voient le menu « Financement » : simulation, constitution du dossier et transmission aux établissements partenaires."
          closedText="Fermé par défaut : le menu « Financement » est masqué dans l'espace client et aucun dossier ne peut être créé. Le simulateur public du site reste disponible."
        >
          <p className="text-xs text-muted">Taux de référence du simulateur : {program.data.reference_rate} %</p>
        </ClientModuleCard>
      ) : (
        <Skeleton className="h-24 w-full" />
      )}
      <Card>
        <CardHeader
          title="Établissements partenaires"
          subtitle="Taux, durée, apport minimal et taux d'endettement maximal alimentent l'éligibilité indicative du simulateur."
          actions={
            can("finance:write") ? (
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" /> Nouveau partenaire
              </Button>
            ) : null
          }
        />
        {partners.loading && !partners.data ? <Skeleton className="m-5 h-24" /> : null}
        <ul className="divide-y divide-line">
          {(partners.data ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <Landmark className="h-4 w-4 text-brand-600" /> {p.name} <span className="text-xs font-normal text-muted">· {optionLabel(p.kind)}</span>
                  {!p.active ? <Badge tone="neutral">Inactif</Badge> : null}
                </p>
                <p className="text-xs text-muted">
                  {number(toNumber(p.rate_min), 1)} à {number(toNumber(p.rate_max), 1)} % · jusqu&apos;à {p.max_years} ans · apport ≥ {number(toNumber(p.min_down_payment_pct), 0)} % · endettement ≤{" "}
                  {number(toNumber(p.max_debt_ratio_pct), 0)} % · frais {number(toNumber(p.fees_pct), 1)} %
                </p>
                <p className="text-xs text-muted">Contact instruction : {[p.contact_name, p.contact_email].filter(Boolean).join(" · ") || "à renseigner (requis pour la transmission)"}</p>
              </div>
              {can("finance:write") ? (
                <Button size="sm" variant="ghost" aria-label="Modifier" onClick={() => setEditing(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
          {partners.data && !partners.data.length ? <li className="px-5 py-4 text-sm text-muted">Aucun partenaire : le simulateur public reste disponible sans offre d&apos;établissement.</li> : null}
        </ul>
      </Card>
      <div className="space-y-3">
        <Tabs value={filter} onChange={setFilter} tabs={APP_FILTERS} />
        {apps.loading && !apps.data ? <Skeleton className="h-40 w-full" /> : null}
        {(apps.data ?? []).map((a) => (
          <Card key={a.id} className="p-5 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {a.number} — {a.applicant_name}
                </p>
                <p className="text-xs text-muted">
                  {money(a.amount)} · apport {money(a.down_payment)} · {number(a.duration_months / 12, 0)} ans · {a.documents.length} pièce(s)
                  {a.submitted_at ? ` · transmis le ${date(a.submitted_at)}` : ""}
                  {a.project_id ? (
                    <>
                      {" · "}
                      <Link href={`/erp/chantiers/${a.project_id}`} className="text-brand-600 hover:underline">
                        projet
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            {a.partners.length ? (
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {a.partners.map((s) => (
                  <li key={s.share_id} className="rounded-xl bg-surface p-3 text-xs ring-1 ring-line">
                    <p className="flex items-center justify-between gap-2 font-semibold">
                      {s.partner} <StatusBadge status={s.revoked ? "withdrawn" : s.status} />
                    </p>
                    {s.viewed_at ? <p className="text-muted">Consulté le {date(s.viewed_at)}</p> : null}
                    {s.offer ? (
                      <p className="mt-1">
                        Offre : {money(s.offer.amount)} à {s.offer.rate} % sur {s.offer.duration_months} mois{s.offer.monthly_payment ? ` · ${money(s.offer.monthly_payment)} / mois` : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {a.accepted_offer ? (
              <p className="mt-2 text-xs font-semibold text-emerald-700">
                Offre acceptée ({a.accepted_offer.partner}) le {date(a.accepted_offer.accepted_at)} : accompagner la signature du prêt et caler les appels de fonds sur les déblocages.
              </p>
            ) : null}
          </Card>
        ))}
        {apps.data && !apps.data.length ? <EmptyState icon={<HandCoins className="h-8 w-8" />} title="Aucun dossier" text="Les dossiers constitués par les clients dans leur espace apparaissent ici." /> : null}
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nouveau partenaire" : "Modifier le partenaire"} size="xl">
        {editing ? (
          <SchemaForm
            schema="PartnerIn"
            initial={editing === "new" ? { kind: "bank", rate_min: 9, rate_max: 13, max_years: 15, min_down_payment_pct: 20, max_debt_ratio_pct: 33, fees_pct: 1, active: true } : { ...editing }}
            fields={{ kind: { options: ["bank", "microfinance", "diaspora"].map((k) => ({ value: k, label: optionLabel(k) })) }, description: { span: 2 }, requirements: { span: 2, help: "Pièces exigées par l'établissement" } }}
            onSubmit={(payload) => (editing === "new" ? api("/financing/partners", { method: "POST", body: payload }) : api(`/financing/partners/${editing.id}`, { method: "PATCH", body: payload }))}
            onCancel={() => setEditing(null)}
            onSuccess={() => {
              toast.success("Partenaire enregistré");
              setEditing(null);
              void partners.reload();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

// ============================================================================ R1 — portefeuille séquestre
interface PortfolioRow {
  project: { id: string; code: string; name: string };
  account: NonNullable<EscrowOverview["account"]>;
  items_count: number;
  waiting: EscrowItemRow[];
}

const WAITING_HINT: Record<string, string> = {
  release_requested: "en attente de la réponse du client",
  approved: "validé par le client : double validation interne puis ordre au partenaire",
  disputed: "contestation : médiation Direction",
};

export function EscrowPortfolioPage() {
  const rows = useApi<PortfolioRow[]>("/escrow/portfolio");
  const total = (key: "balance_held" | "balance_released" | "balance_refunded") => (rows.data ?? []).reduce((sum, r) => sum + toNumber(r.account[key]), 0);
  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <Lock className="h-7 w-7 text-brand-600" /> Séquestre par jalon
          </span>
        }
        subtitle="Fonds des clients détenus par les partenaires, libérés sur preuve (PV et photos certifiées), accord du client et double validation interne."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Sous séquestre" value={money(total("balance_held"))} />
        <Stat label="Libéré" value={money(total("balance_released"))} tone="success" />
        <Stat label="Restitué" value={money(total("balance_refunded"))} />
      </div>
      {rows.loading && !rows.data ? <Skeleton className="h-48 w-full" /> : null}
      {(rows.data ?? []).map((r) => (
        <Card key={r.project.id}>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                {r.project.code} — {r.project.name} <StatusBadge status={r.account.status} />
              </span>
            }
            subtitle={`${r.account.partner_name} · ${r.items_count} appel(s) sous séquestre · détenu ${money(r.account.balance_held)}`}
            actions={
              <Link href={`/erp/chantiers/${r.project.id}?onglet=sequestre`} className="text-sm font-semibold text-brand-600 hover:underline">
                Ouvrir
              </Link>
            }
          />
          {r.waiting.length ? (
            <ul className="divide-y divide-line">
              {r.waiting.map((i) => {
                const s = ESCROW_STATUS[i.status] ?? { label: i.status, tone: "neutral" as const };
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span>
                      <span className="font-medium">{i.number}</span> · {i.milestone?.name} · {money(i.held_amount)}
                      <span className="block text-xs text-muted">{WAITING_HINT[i.status]}</span>
                    </span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 pb-4 text-sm text-muted">Aucune action en attente.</p>
          )}
        </Card>
      ))}
      {rows.data && !rows.data.length ? <EmptyState icon={<Lock className="h-8 w-8" />} title="Aucun séquestre configuré" text="Configurez un séquestre depuis l'onglet « Séquestre » d'un chantier." /> : null}
    </div>
  );
}
