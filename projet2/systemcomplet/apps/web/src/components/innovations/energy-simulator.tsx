"use client";

import { BatteryCharging, Leaf, Lightbulb, Snowflake, Sun, ThermometerSun, Umbrella, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Field, Input, Select } from "@/components/ui/form";
import { Alert, Skeleton } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import { money, number } from "@/lib/format";

export interface EnergyInputs {
  surface_m2: number;
  levels: number;
  standing: "standard" | "confort" | "premium";
  occupants: number;
  ac_units: number;
  ac_hours_per_day: number;
  region: "littoral" | "ouest" | "centre" | "nord";
  measures: string[];
  solar_kwp?: number | null;
  battery_kwh?: number | null;
}

export interface EnergyResult {
  before: { kwh_year: number; bill_year: number; bill_month: number };
  after: { kwh_year: number; grid_kwh_year: number; bill_year: number; bill_month: number };
  solar: { kwp: number; production_kwh_year: number; self_used_kwh_year: number };
  battery_kwh: number;
  autonomy_hours: number;
  measures: { key: string; label: string; cost: number; kwh_saved: number; saving_year: number; payback_years: number | null; detail: string }[];
  investment: number;
  savings_year: number;
  payback_years: number | null;
  savings_20_years: number;
  co2_avoided_kg_year: number;
  comfort_gain_degrees: number;
  disclaimer: string;
}

const MEASURES: { key: string; label: string; icon: React.ReactNode; hint: string }[] = [
  { key: "roof_insulation", label: "Isolation de la toiture", icon: <ThermometerSun className="h-5 w-5" />, hint: "Moins de chaleur sous le toit" },
  { key: "shading", label: "Protections solaires", icon: <Umbrella className="h-5 w-5" />, hint: "Brise-soleil, débords de toiture" },
  { key: "double_glazing", label: "Double vitrage", icon: <Wind className="h-5 w-5" />, hint: "Fraîcheur et silence" },
  { key: "inverter_ac", label: "Climatisation inverter", icon: <Snowflake className="h-5 w-5" />, hint: "Jusqu'à 30 % de moins" },
  { key: "led", label: "Éclairage LED", icon: <Lightbulb className="h-5 w-5" />, hint: "Rentabilisé en quelques mois" },
  { key: "solar", label: "Panneaux solaires", icon: <Sun className="h-5 w-5" />, hint: "Produisez votre électricité" },
  { key: "battery", label: "Batterie", icon: <BatteryCharging className="h-5 w-5" />, hint: "Autonomie pendant les délestages" },
];

export const DEFAULT_ENERGY: EnergyInputs = {
  surface_m2: 150,
  levels: 1,
  standing: "standard",
  occupants: 4,
  ac_units: 3,
  ac_hours_per_day: 8,
  region: "littoral",
  measures: ["roof_insulation", "solar"],
};

/** Simulateur énergie & confort (I3) : calcul serveur (ratios GLOBUS paramétrés), résultat instantané. */
export function EnergySimulator({ initial, onResult, children }: { initial?: Partial<EnergyInputs>; onResult?: (inputs: EnergyInputs, result: EnergyResult) => void; children?: React.ReactNode }) {
  const [inputs, setInputs] = useState<EnergyInputs>({ ...DEFAULT_ENERGY, ...initial });
  const [result, setResult] = useState<EnergyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = useMemo(() => JSON.stringify(inputs), [inputs]);

  useEffect(() => {
    const timer = setTimeout(() => {
      api<EnergyResult>("/public/energy/simulate", { body: inputs })
        .then((r) => {
          setResult(r);
          setError(null);
          onResult?.(inputs, r);
        })
        .catch((err) => setError(errorMessage(err)));
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = <K extends keyof EnergyInputs>(k: K, v: EnergyInputs[K]) => setInputs((cur) => ({ ...cur, [k]: v }));
  const toggle = (m: string) => set("measures", inputs.measures.includes(m) ? inputs.measures.filter((x) => x !== m) : [...inputs.measures, m]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Surface (m²)">
            <Input type="number" min={20} value={inputs.surface_m2} onChange={(e) => set("surface_m2", Number(e.target.value) || 20)} />
          </Field>
          <Field label="Niveaux">
            <Input type="number" min={1} max={30} value={inputs.levels} onChange={(e) => set("levels", Number(e.target.value) || 1)} />
          </Field>
          <Field label="Occupants">
            <Input type="number" min={1} value={inputs.occupants} onChange={(e) => set("occupants", Number(e.target.value) || 1)} />
          </Field>
          <Field label="Climatiseurs">
            <Input type="number" min={0} value={inputs.ac_units} onChange={(e) => set("ac_units", Math.max(0, Number(e.target.value)))} />
          </Field>
          <Field label="Heures de clim / jour">
            <Input type="number" min={0} max={24} value={inputs.ac_hours_per_day} onChange={(e) => set("ac_hours_per_day", Math.max(0, Number(e.target.value)))} />
          </Field>
          <Field label="Région">
            <Select value={inputs.region} onChange={(e) => set("region", e.target.value as EnergyInputs["region"])} options={[{ value: "littoral", label: "Littoral (Douala, Kribi…)" }, { value: "centre", label: "Centre / Sud / Est" }, { value: "ouest", label: "Ouest / Nord-Ouest" }, { value: "nord", label: "Grand Nord" }]} />
          </Field>
        </div>
        <Field label="Standing">
          <Select value={inputs.standing} onChange={(e) => set("standing", e.target.value as EnergyInputs["standing"])} options={[{ value: "standard", label: "Standard" }, { value: "confort", label: "Confort" }, { value: "premium", label: "Premium" }]} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Mesures à étudier</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {MEASURES.map((m) => {
              const on = inputs.measures.includes(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => toggle(m.key)}
                  aria-pressed={on}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${on ? "border-accent-400 bg-accent-50 shadow-sm" : "border-line bg-white hover:border-brand-200"}`}
                >
                  <span className={`rounded-xl p-2 ${on ? "bg-accent-500 text-white" : "bg-slate-100 text-brand-600"}`}>{m.icon}</span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{m.label}</span>
                    <span className="block text-xs text-muted">{m.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {inputs.measures.includes("solar") ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Puissance solaire (kWc)" help="Vide = dimensionnement automatique">
              <Input type="number" min={0.5} step={0.5} value={inputs.solar_kwp ?? ""} onChange={(e) => set("solar_kwp", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            {inputs.measures.includes("battery") ? (
              <Field label="Batterie (kWh)">
                <Input type="number" min={1} step={1} value={inputs.battery_kwh ?? ""} placeholder="5" onChange={(e) => set("battery_kwh", e.target.value ? Number(e.target.value) : null)} />
              </Field>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
      <div className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {!result ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <div className="relative overflow-hidden rounded-[2rem] bg-night p-6 text-white">
              <div className="aurora-blob -right-16 -top-16 h-48 w-48 bg-accent-500/40" />
              <p className="relative text-sm text-brand-100">Facture d&apos;électricité estimée</p>
              <div className="relative mt-2 flex flex-wrap items-end gap-4">
                <p className="font-title text-2xl font-bold text-white/60 line-through">{money(result.before.bill_month)}</p>
                <p className="font-title text-4xl font-extrabold xl:text-5xl">
                  <span className="text-gradient-light">{money(result.after.bill_month)}</span>
                  <span className="ml-2 whitespace-nowrap font-sans text-sm font-normal text-brand-100">/ mois</span>
                </p>
              </div>
              <div className="relative mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="glass-dark rounded-xl p-3">
                  <p className="text-xs text-brand-200">Économie / an</p>
                  <p className="font-semibold">{money(result.savings_year)}</p>
                </div>
                <div className="glass-dark rounded-xl p-3">
                  <p className="text-xs text-brand-200">Investissement</p>
                  <p className="font-semibold">{money(result.investment)}</p>
                </div>
                <div className="glass-dark rounded-xl p-3">
                  <p className="text-xs text-brand-200">Retour</p>
                  <p className="font-semibold">{result.payback_years ? `${number(result.payback_years, 1)} ans` : "—"}</p>
                </div>
                <div className="glass-dark rounded-xl p-3">
                  <p className="text-xs text-brand-200">Gain sur 20 ans</p>
                  <p className="font-semibold">{money(result.savings_20_years)}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
                <Leaf className="mx-auto h-5 w-5 text-emerald-600" />
                <p className="mt-1 font-semibold">{number(result.co2_avoided_kg_year / 1000, 1)} t CO₂</p>
                <p className="text-xs text-muted">évitées / an</p>
              </div>
              <div className="rounded-2xl bg-sky-50 p-3 ring-1 ring-sky-100">
                <ThermometerSun className="mx-auto h-5 w-5 text-sky-600" />
                <p className="mt-1 font-semibold">−{number(result.comfort_gain_degrees, 1)} °C</p>
                <p className="text-xs text-muted">ressentis à l&apos;intérieur</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100">
                <BatteryCharging className="mx-auto h-5 w-5 text-amber-600" />
                <p className="mt-1 font-semibold">{result.autonomy_hours ? `${number(result.autonomy_hours, 1)} h` : "—"}</p>
                <p className="text-xs text-muted">d&apos;autonomie en délestage</p>
              </div>
            </div>
            {result.measures.length ? (
              <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
                {result.measures.map((m) => (
                  <li key={m.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span>
                      <span className="font-medium text-ink">{m.label}</span>
                      <span className="block text-xs text-muted">{m.detail}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold text-emerald-700">−{money(m.saving_year)} / an</span>
                      <span className="block text-xs text-muted">
                        {money(m.cost)} · retour {m.payback_years ? `${number(m.payback_years, 1)} ans` : "—"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-muted">{result.disclaimer}</p>
          </>
        )}
      </div>
    </div>
  );
}
