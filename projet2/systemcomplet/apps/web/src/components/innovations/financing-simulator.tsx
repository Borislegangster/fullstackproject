"use client";

import { BadgeCheck, Landmark, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Field, Input, Select } from "@/components/ui/form";
import { Alert, Badge, Skeleton } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import { money, number } from "@/lib/format";

export interface FinancingInputs {
  amount: number;
  down_payment: number;
  duration_months: number;
  monthly_income: number | null;
  other_monthly_debts: number;
  /** Taux annuel hypothétique (%) ; vide : hypothèse paramétrée par GLOBUS. */
  rate: number | null;
}

interface Reference {
  rate: string;
  monthly: string;
  total_interest: string;
  debt_ratio_pct: string | null;
}

export interface PartnerOffer {
  partner_id: string;
  name: string;
  kind: string;
  rate_min: string;
  rate_max: string;
  monthly_min: string;
  monthly_max: string;
  total_cost_max: string;
  debt_ratio_pct: string | null;
  eligible: boolean;
  reasons: string[];
  requirements: string[];
}

/** Simulateur de financement (I5) : mensualités, endettement, établissements partenaires éligibles. */
export function FinancingSimulator({ initial, onChange }: { initial?: Partial<FinancingInputs>; onChange?: (inputs: FinancingInputs, offers: PartnerOffer[]) => void }) {
  const [inputs, setInputs] = useState<FinancingInputs>({ amount: 40000000, down_payment: 10000000, duration_months: 180, monthly_income: 1200000, other_monthly_debts: 0, rate: null, ...initial });
  const [offers, setOffers] = useState<PartnerOffer[] | null>(null);
  const [reference, setReference] = useState<Reference | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      api<{ offers: PartnerOffer[]; reference: Reference }>("/public/financing/simulate", { body: inputs })
        .then((r) => {
          setOffers(r.offers);
          setReference(r.reference);
          setError(null);
          onChange?.(inputs, r.offers);
        })
        .catch((err) => setError(errorMessage(err)));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(inputs)]);
  const set = <K extends keyof FinancingInputs>(k: K, v: FinancingInputs[K]) => setInputs((cur) => ({ ...cur, [k]: v }));
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="grid content-start gap-3 sm:grid-cols-2">
        <Field label="Coût du projet (FCFA)">
          <Input type="number" min={1} value={inputs.amount} onChange={(e) => set("amount", Number(e.target.value) || 0)} />
        </Field>
        <Field label="Apport personnel (FCFA)">
          <Input type="number" min={0} value={inputs.down_payment} onChange={(e) => set("down_payment", Number(e.target.value) || 0)} />
        </Field>
        <Field label="Durée">
          <Select
            value={String(inputs.duration_months)}
            onChange={(e) => set("duration_months", Number(e.target.value))}
            options={[36, 60, 84, 120, 180, 240].map((m) => ({ value: String(m), label: `${m / 12} ans` }))}
          />
        </Field>
        <Field label="Revenus nets mensuels (FCFA)">
          <Input type="number" min={0} value={inputs.monthly_income ?? ""} onChange={(e) => set("monthly_income", e.target.value ? Number(e.target.value) : null)} />
        </Field>
        <Field label="Autres mensualités en cours (FCFA)">
          <Input type="number" min={0} value={inputs.other_monthly_debts} onChange={(e) => set("other_monthly_debts", Number(e.target.value) || 0)} />
        </Field>
        <Field label="Taux annuel hypothétique (%)" help="Modifiable : comparez avec les taux proposés par votre banque.">
          <Input
            type="number"
            min={0}
            max={30}
            step={0.1}
            placeholder={reference ? String(reference.rate) : ""}
            value={inputs.rate ?? ""}
            onChange={(e) => set("rate", e.target.value === "" ? null : Math.min(30, Math.max(0, Number(e.target.value))))}
          />
        </Field>
        <p className="text-xs text-muted sm:col-span-2">Montant à financer : {money(Math.max(0, inputs.amount - inputs.down_payment))}. Simulation indicative ; chaque établissement fixe ses conditions.</p>
      </div>
      <div className="space-y-3">
        {error ? <Alert tone="warning">{error}</Alert> : null}
        {reference ? (
          <div className="rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 p-5 text-white">
            <p className="text-sm text-white/80">Mensualité estimée à {number(reference.rate, 1)} % sur {number(inputs.duration_months / 12, 0)} ans</p>
            <p className="mt-1 font-title text-3xl font-bold">
              {money(reference.monthly)} <span className="text-base font-normal text-white/80">/ mois</span>
            </p>
            <p className="mt-1 text-xs text-white/80">
              Intérêts sur la durée : {money(reference.total_interest)}
              {reference.debt_ratio_pct ? ` · taux d'endettement ${number(reference.debt_ratio_pct, 1)} %` : ""}
            </p>
            {reference.debt_ratio_pct && Number(reference.debt_ratio_pct) > 33 ? (
              <p className="mt-2 rounded-lg bg-white/15 px-3 py-1.5 text-xs">
                Au-delà d&apos;environ 33 % d&apos;endettement, les banques demandent souvent plus d&apos;apport ou une durée plus longue.
              </p>
            ) : null}
          </div>
        ) : null}
        {!offers ? (
          <Skeleton className="h-64 w-full" />
        ) : offers.length ? (
          offers.map((o) => (
            <div key={o.partner_id} className={`rounded-2xl p-4 ring-1 ${o.eligible ? "bg-white ring-emerald-200" : "bg-slate-50 ring-line"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <Landmark className="h-4 w-4 text-brand-600" /> {o.name}
                  <Badge tone={o.eligible ? "success" : "neutral"}>
                    {o.eligible ? (
                      <>
                        <BadgeCheck className="mr-1 inline h-3 w-3" />
                        Éligible
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-1 inline h-3 w-3" />
                        Hors critères
                      </>
                    )}
                  </Badge>
                </p>
                <p className="text-sm text-muted">
                  Taux {number(o.rate_min, 1)} – {number(o.rate_max, 1)} %
                </p>
              </div>
              <p className="mt-2 font-title text-2xl font-bold text-brand-800">
                {money(o.monthly_min)} – {money(o.monthly_max)} <span className="text-sm font-normal text-muted">/ mois</span>
              </p>
              <p className="text-xs text-muted">
                {o.debt_ratio_pct ? `Taux d'endettement estimé ${number(o.debt_ratio_pct, 1)} % · ` : ""}Coût total max. {money(o.total_cost_max)}
              </p>
              {o.reasons.length ? <p className="mt-1 text-xs text-amber-700">Critères : {o.reasons.join(" · ")}</p> : null}
            </div>
          ))
        ) : (
          <Alert tone="info">Nos établissements partenaires seront bientôt proposés ici.</Alert>
        )}
      </div>
    </div>
  );
}
