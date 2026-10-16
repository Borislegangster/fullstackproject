"use client";

import { Printer, ShieldCheck } from "lucide-react";

import { WithProject } from "@/components/client/client-project";
import { MilestoneTimeline } from "@/components/client/milestones";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, PageTitle, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { date, dateTime, money, number } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface Passport {
  identity: { code: string; name: string; universe?: string | null; type?: string | null; address?: string | null; city?: string | null; surface_m2?: string | null; levels?: number | null; status: string };
  contract?: { number: string; title: string; signed_at?: string | null; amount: string } | null;
  change_orders: { number: string; title: string; cost_impact: string; delay_impact_days: number; status: string }[];
  finance: { contract_amount?: string | null; approved_changes: string; called: string; paid: string; due: string; currency: string };
  payments: { number: string; amount: string; paid_at?: string | null; method?: string | null }[];
  planning: { start_planned?: string | null; end_planned?: string | null; milestones: any[] };
  plans: { title: string; versions: { label: string; status: string; published_at?: string | null; obsolete_at?: string | null }[] }[];
  decisions: { number: string; title: string; status: string; selected_option?: string | null; price_impact?: string | null; delay_impact_days?: number | null; validated_at?: string | null; validation_method?: string | null; content_hash?: string | null }[];
  deliveries_and_expenses: { label: string; category: string; amount: string; date: string }[];
  subcontractors: { name: string; trades: string[]; scope: string }[];
  warranties: { id: string; kind: string; start_date: string; end_date: string; coverage?: string | null; insurer?: string | null }[];
  after_sales: { tickets: number; open: number };
  validation_journal: { what: string; when: string; how?: string | null; hash?: string | null }[];
}

function PassportContent({ projectId }: { projectId: string }) {
  const { data, error, loading } = useApi<Passport>(`/client/projects/${projectId}/passport`);
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <Alert tone="danger">{error}</Alert>;
  const cur = data.finance.currency === "XAF" ? "FCFA" : data.finance.currency;
  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="Digital Project Passport"
        title={data.identity.name}
        subtitle="Toute l'information fiable de votre projet, en un seul lieu."
        actions={
          <Button variant="secondary" onClick={() => window.print()} className="no-print">
            <Printer className="h-4 w-4" /> Imprimer
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Identité du projet" />
          <div className="p-5">
            <DescriptionList
              items={[
                { label: "Référence", value: data.identity.code },
                { label: "Statut", value: <StatusBadge status={data.identity.status} label={optionLabel(data.identity.status)} /> },
                { label: "Univers", value: optionLabel(data.identity.universe) },
                { label: "Type", value: optionLabel(data.identity.type) },
                { label: "Adresse", value: [data.identity.address, data.identity.city].filter(Boolean).join(", ") || "—" },
                { label: "Surface / niveaux", value: `${data.identity.surface_m2 ? `${number(data.identity.surface_m2)} m²` : "—"} · ${data.identity.levels ?? "—"} niveau(x)` },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Contrat et avenants" />
          <div className="space-y-4 p-5">
            {data.contract ? (
              <DescriptionList
                items={[
                  { label: "Contrat", value: `${data.contract.number} — ${data.contract.title}` },
                  { label: "Signé le", value: date(data.contract.signed_at) },
                  { label: "Montant", value: money(data.contract.amount, cur) },
                  { label: "Avenants approuvés", value: money(data.finance.approved_changes, cur) },
                ]}
              />
            ) : (
              <p className="text-sm text-muted">Contrat non encore rattaché.</p>
            )}
            {data.change_orders.length ? (
              <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                {data.change_orders.map((c) => (
                  <li key={c.number} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {c.number} — {c.title}
                      <span className="block text-xs text-muted">
                        {money(c.cost_impact, cur)} · {c.delay_impact_days} j
                      </span>
                    </span>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Budget et paiements" />
          <div className="space-y-4 p-5">
            <DescriptionList
              items={[
                { label: "Appelé", value: money(data.finance.called, cur) },
                { label: "Payé", value: money(data.finance.paid, cur) },
                { label: "Reste dû", value: money(data.finance.due, cur) },
                { label: "Paiements", value: data.payments.length },
              ]}
            />
            <ul className="divide-y divide-line text-sm">
              {data.payments.map((p) => (
                <li key={p.number} className="flex justify-between py-1.5">
                  <span>
                    {p.number} · {optionLabel(p.method)}
                  </span>
                  <span>
                    {money(p.amount, cur)} · {date(p.paid_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card>
          <CardHeader title="Planning et jalons" subtitle={`Du ${date(data.planning.start_planned)} au ${date(data.planning.end_planned)}`} />
          <div className="p-5">
            <MilestoneTimeline items={data.planning.milestones} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Versions de plans" subtitle="Une version obsolète est remplacée dès la publication de la suivante." />
          <ul className="divide-y divide-line">
            {data.plans.map((plan) => (
              <li key={plan.title} className="px-5 py-3">
                <p className="text-sm font-medium">{plan.title}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {plan.versions.map((v) => (
                    <Badge key={v.label} tone={v.status === "published" ? "success" : "neutral"}>
                      {v.label} · {v.status === "published" ? "en vigueur" : `obsolète le ${date(v.obsolete_at)}`}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
            {!data.plans.length ? <li className="px-5 py-4 text-sm text-muted">Aucun plan publié.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Décisions client" />
          <ul className="divide-y divide-line text-sm">
            {data.decisions.map((d) => (
              <li key={d.number} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {d.number} — {d.title}
                  </span>
                  <StatusBadge status={d.status} />
                </div>
                <p className="text-xs text-muted">
                  {d.selected_option ? `Option : ${d.selected_option} · ` : ""}
                  {d.price_impact ? `${money(d.price_impact, cur)} · ` : ""}
                  {d.delay_impact_days ? `${d.delay_impact_days} j · ` : ""}
                  {d.validated_at ? `validée le ${dateTime(d.validated_at)} (${optionLabel(d.validation_method)})` : ""}
                </p>
              </li>
            ))}
            {!data.decisions.length ? <li className="px-5 py-4 text-muted">Aucune décision.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Livraisons et dépenses publiées" />
          <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">
            {data.deliveries_and_expenses.map((e, i) => (
              <li key={i} className="flex justify-between gap-2 px-5 py-2">
                <span>
                  {e.label}
                  <span className="block text-xs text-muted">
                    {optionLabel(e.category)} · {date(e.date)}
                  </span>
                </span>
                <span className="tabular-nums">{money(e.amount, cur)}</span>
              </li>
            ))}
            {!data.deliveries_and_expenses.length ? <li className="px-5 py-4 text-muted">Aucune dépense publiée.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Partenaires, garanties et SAV" />
          <div className="space-y-4 p-5 text-sm">
            {data.subcontractors.length ? (
              <ul className="space-y-1">
                {data.subcontractors.map((s) => (
                  <li key={s.name}>
                    <span className="font-medium">{s.name}</span> — {s.scope} <span className="text-muted">({s.trades.map((t) => optionLabel(t)).join(", ")})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Les intervenants sont communiqués par votre chef de projet.</p>
            )}
            <ul className="space-y-1">
              {data.warranties.map((w) => (
                <li key={w.id}>
                  <span className="font-medium">{optionLabel(w.kind)}</span> : du {date(w.start_date)} au {date(w.end_date)}
                  {w.insurer ? ` · ${w.insurer}` : ""}
                </li>
              ))}
            </ul>
            <p>
              SAV : {data.after_sales.tickets} demande(s), dont {data.after_sales.open} en cours.
            </p>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title="Journal des validations" subtitle="Décisions irrévocables : qui, quand, comment, empreinte du contenu validé." />
        <ul className="divide-y divide-line text-sm">
          {data.validation_journal.map((v, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> {v.what}
              </span>
              <span className="text-xs text-muted">
                {dateTime(v.when)} · {optionLabel(v.how)} {v.hash ? `· ${v.hash.slice(0, 20)}…` : ""}
              </span>
            </li>
          ))}
          {!data.validation_journal.length ? <li className="px-5 py-4 text-muted">Aucune validation enregistrée.</li> : null}
        </ul>
      </Card>
    </div>
  );
}

export default function PassportPage() {
  return <WithProject>{(p) => <PassportContent projectId={p.id} />}</WithProject>;
}
