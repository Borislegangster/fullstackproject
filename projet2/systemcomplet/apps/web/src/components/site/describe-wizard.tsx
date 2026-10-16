"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Button } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import type { FormDefinitionPayload, UniverseCard } from "@/lib/cms-types";
import { money } from "@/lib/format";
import { optionLabel } from "@/lib/labels";
import { readReferral } from "@/lib/referral";
import { sessionId, track, utmParams } from "@/lib/tracker";

const UNIVERSE_KEYS = ["HOME", "BUSINESS", "PREMIUM", "DIASPORA", "ENGINEERING"];
const PROJECT_TYPES = [
  ["maison_individuelle", "Maison individuelle / villa"],
  ["immeuble", "Immeuble (R+1 et plus)"],
  ["commerce", "Commerce / local d'activité"],
  ["bureaux", "Bureaux"],
  ["industriel", "Bâtiment industriel / entrepôt"],
  ["renovation", "Rénovation / réhabilitation"],
  ["extension", "Extension / surélévation"],
  ["etudes", "Études, plans et calculs uniquement"],
  ["suivi", "Suivi / contrôle de chantier"],
  ["autre", "Autre"],
] as const;
const LAND_STATUS = [
  ["titre_foncier", "Titre foncier"],
  ["en_cours", "Titre en cours d'obtention"],
  ["acte_vente", "Acte de vente / attestation"],
  ["coutumier", "Terrain coutumier"],
  ["a_verifier", "À vérifier"],
] as const;
const PRIORITIES = [
  ["budget", "Respect du budget"],
  ["delai", "Respect des délais"],
  ["qualite", "Qualité des finitions"],
  ["transparence", "Suivi et transparence"],
  ["design", "Architecture et design"],
  ["rentabilite", "Rentabilité de l'investissement"],
] as const;
const SERVICES = [
  ["architecture", "Architecture / plans"],
  ["structure", "Calcul de structure"],
  ["bim", "Maquette BIM / 3D"],
  ["permis", "Dossier de permis de construire"],
  ["construction", "Construction clé en main"],
  ["suivi", "Suivi de chantier à distance"],
  ["etude_faisabilite", "Étude de faisabilité / rentabilité"],
  ["foncier", "Sécurisation foncière"],
] as const;

type Values = Record<string, any>;

export function DescribeProjectWizard({ title, context }: { title?: string | null; context?: Record<string, string> }) {
  const [step, setStep] = useState(0);
  const [universes, setUniverses] = useState<UniverseCard[]>([]);
  const [renderedAt, setRenderedAt] = useState<number | null>(null);
  const [consents, setConsents] = useState<FormDefinitionPayload["consents"]>([]);
  const [values, setValues] = useState<Values>({
    universe: context?.universe ?? "",
    offer_slug: context?.offer_slug ?? "",
    project_type: "",
    budget_currency: "XAF",
    preferred_channel: "whatsapp",
    priorities: [] as string[],
    services_needed: [] as string[],
    has_land: "",
  });
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<{ min: string; max: string; currency: string; disclaimer?: string } | null>(null);
  const [result, setResult] = useState<{ reference?: string; estimate?: { min: string; max: string } | null; next_steps?: string[] } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const universe = params.get("univers")?.toUpperCase();
    const offer = params.get("offre");
    if (universe && UNIVERSE_KEYS.includes(universe)) setValues((v) => ({ ...v, universe }));
    if (offer) setValues((v) => ({ ...v, offer_slug: offer.slice(0, 120) }));
    api<UniverseCard[]>("/public/universes").then(setUniverses).catch(() => setUniverses([]));
    api<FormDefinitionPayload>("/public/forms/describe_project")
      .then((f) => {
        setRenderedAt(f.rendered_at ?? null);
        setConsents(f.consents ?? []);
      })
      .catch(() => {
        setConsents([{ key: "contact", label: "J'accepte que GLOBUS ENGINEERING traite mes données pour répondre à ma demande.", required: true }]);
      });
  }, []);

  const set = (key: string, value: any) => setValues((v) => ({ ...v, [key]: value }));
  const toggle = (key: string, item: string) =>
    setValues((v) => ({ ...v, [key]: v[key].includes(item) ? v[key].filter((x: string) => x !== item) : [...v[key], item] }));

  useEffect(() => {
    if (step < 2 || !values.surface_m2) return;
    const t = setTimeout(() => {
      api<{ available: boolean; min?: string; max?: string; currency?: string; disclaimer?: string }>("/public/estimate", {
        method: "POST",
        body: { universe: values.universe || null, surface_m2: values.surface_m2, levels: values.levels, standing: values.standing },
      })
        .then((res) => setEstimate(res.available && res.min && res.max ? { min: res.min, max: res.max, currency: res.currency ?? "XAF", disclaimer: res.disclaimer } : null))
        .catch(() => setEstimate(null));
    }, 400);
    return () => clearTimeout(t);
  }, [step, values.universe, values.surface_m2, values.levels, values.standing]);

  const steps = useMemo(() => ["Votre univers", "Votre projet", "Budget et délai", "Vos coordonnées"], []);

  const validateStep = (index: number): boolean => {
    const errs: Record<string, string> = {};
    if (index === 1 && !values.project_type) errs.project_type = "Choisissez un type de projet";
    if (index === 2 && values.budget_min && values.budget_max && Number(values.budget_min) > Number(values.budget_max))
      errs.budget_max = "Le maximum doit être supérieur au minimum";
    if (index === 3) {
      if (!values.first_name?.trim()) errs.first_name = "Champ obligatoire";
      if (!values.email?.trim() && !values.phone?.trim() && !values.whatsapp?.trim()) errs.phone = "Indiquez au moins un moyen de vous joindre";
      if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errs.email = "E-mail invalide";
      consents.forEach((c) => {
        if (c.required && !accepted[c.key]) errs[`consent:${c.key}`] = "Consentement requis";
      });
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validateStep(step)) return;
    if (step === 0) track({ type: "describe_project_start", target: values.universe || "none" });
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const submit = async () => {
    if (!validateStep(3)) return;
    setBusy(true);
    setError(null);
    const num = (v: any) => (v === "" || v === undefined || v === null ? null : Number(v));
    try {
      const res = await api<typeof result>("/public/describe-project", {
        method: "POST",
        body: {
          universe: values.universe || null,
          offer_slug: values.offer_slug || null,
          project_type: values.project_type || null,
          project_location: values.project_location || null,
          has_land: values.has_land === "" ? null : values.has_land === "yes",
          land_status: values.land_status || null,
          land_surface_m2: num(values.land_surface_m2),
          surface_m2: num(values.surface_m2),
          levels: num(values.levels),
          rooms: num(values.rooms),
          style: values.style || null,
          standing: values.standing || null,
          budget_min: num(values.budget_min),
          budget_max: num(values.budget_max),
          budget_currency: values.budget_currency,
          timeline: values.timeline || null,
          financing: values.financing || null,
          priorities: values.priorities,
          services_needed: values.services_needed,
          description: values.description || null,
          first_name: values.first_name.trim(),
          last_name: values.last_name || null,
          company: values.company || null,
          email: values.email || null,
          phone: values.phone || null,
          whatsapp: values.whatsapp || null,
          country: values.country || null,
          city: values.city || null,
          preferred_channel: values.preferred_channel,
          consents: accepted,
          utm: utmParams(),
          landing_page: location.pathname,
          referrer: document.referrer || null,
          session_id: sessionId(),
          rendered_at: renderedAt,
          website: honeypot || null,
          referral_code: readReferral(),
        },
      });
      track({ type: "describe_project_submit", target: values.universe || "none" });
      setResult(res ?? {});
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (result)
    return (
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        <h3 className="mt-3 text-2xl font-bold text-brand-800">Votre projet est enregistré</h3>
        {result.reference ? (
          <p className="mt-1 text-muted">
            Numéro de demande : <strong className="text-ink">{result.reference}</strong>
          </p>
        ) : null}
        {result.estimate ? (
          <p className="mt-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
            Estimation indicative : <strong>{money(result.estimate.min)}</strong> à <strong>{money(result.estimate.max)}</strong> (non contractuelle).
          </p>
        ) : null}
        {result.next_steps?.length ? (
          <ol className="mt-5 space-y-2">
            {result.next_steps.map((s, i) => (
              <li key={s} className="flex items-start gap-3 text-sm text-ink">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    );

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
      {title ? <h3 className="mb-4 text-xl font-bold text-brand-800">{title}</h3> : null}
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Étapes">
        {steps.map((label, i) => (
          <li key={label} className="min-w-0">
            <div className={clsx("h-1.5 rounded-full", i <= step ? "bg-accent-500" : "bg-slate-200")} />
            <p className={clsx("mt-1.5 hidden truncate text-xs sm:block", i === step ? "font-semibold text-brand-700" : "text-muted")}>{label}</p>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div>
          <p className="mb-3 text-sm text-muted">Quel accompagnement correspond le mieux à votre projet ?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(universes.length ? universes.map((u) => ({ key: u.key, name: u.name, text: u.tagline })) : UNIVERSE_KEYS.map((k) => ({ key: k, name: optionLabel(k), text: null }))).map((u) => (
              <button
                key={u.key}
                type="button"
                onClick={() => set("universe", u.key)}
                className={clsx(
                  "rounded-xl border-2 p-4 text-left transition",
                  values.universe === u.key ? "border-accent-500 bg-accent-50" : "border-line hover:border-brand-300",
                )}
                aria-pressed={values.universe === u.key}
              >
                <span className="block font-title font-semibold text-brand-800">{u.name}</span>
                {u.text ? <span className="mt-1 block text-sm text-muted">{u.text}</span> : null}
              </button>
            ))}
            <button
              type="button"
              onClick={() => set("universe", "")}
              className={clsx("rounded-xl border-2 p-4 text-left transition", !values.universe ? "border-accent-500 bg-accent-50" : "border-line hover:border-brand-300")}
            >
              <span className="block font-title font-semibold text-brand-800">Je ne sais pas encore</span>
              <span className="mt-1 block text-sm text-muted">Un conseiller vous orientera.</span>
            </button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type de projet" required error={errors.project_type} className="sm:col-span-2">
            <Select value={values.project_type} onChange={(e) => set("project_type", e.target.value)} placeholder="Choisir…" options={PROJECT_TYPES.map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Localisation du projet (ville, quartier)">
            <Input value={values.project_location ?? ""} onChange={(e) => set("project_location", e.target.value)} />
          </Field>
          <Field label="Disposez-vous d'un terrain ?">
            <Select
              value={values.has_land}
              onChange={(e) => set("has_land", e.target.value)}
              placeholder="Choisir…"
              options={[
                { value: "yes", label: "Oui" },
                { value: "no", label: "Non, pas encore" },
              ]}
            />
          </Field>
          {values.has_land === "yes" ? (
            <>
              <Field label="Statut du terrain">
                <Select value={values.land_status ?? ""} onChange={(e) => set("land_status", e.target.value)} placeholder="Choisir…" options={LAND_STATUS.map(([value, label]) => ({ value, label }))} />
              </Field>
              <Field label="Surface du terrain (m²)">
                <Input type="number" min={0} value={values.land_surface_m2 ?? ""} onChange={(e) => set("land_surface_m2", e.target.value)} />
              </Field>
            </>
          ) : null}
          <Field label="Surface à construire (m²)">
            <Input type="number" min={0} value={values.surface_m2 ?? ""} onChange={(e) => set("surface_m2", e.target.value)} />
          </Field>
          <Field label="Nombre de niveaux">
            <Input type="number" min={0} max={100} value={values.levels ?? ""} onChange={(e) => set("levels", e.target.value)} />
          </Field>
          <Field label="Nombre de pièces">
            <Input type="number" min={0} value={values.rooms ?? ""} onChange={(e) => set("rooms", e.target.value)} />
          </Field>
          <Field label="Standing">
            <Select
              value={values.standing ?? ""}
              onChange={(e) => set("standing", e.target.value)}
              placeholder="Choisir…"
              options={["standard", "confort", "premium"].map((v) => ({ value: v, label: optionLabel(v) }))}
            />
          </Field>
          <Field label="Style souhaité" className="sm:col-span-2">
            <Input value={values.style ?? ""} onChange={(e) => set("style", e.target.value)} placeholder="Contemporain, tropical, classique…" />
          </Field>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Budget minimum">
              <Input type="number" min={0} value={values.budget_min ?? ""} onChange={(e) => set("budget_min", e.target.value)} />
            </Field>
            <Field label="Budget maximum" error={errors.budget_max}>
              <Input type="number" min={0} value={values.budget_max ?? ""} onChange={(e) => set("budget_max", e.target.value)} />
            </Field>
            <Field label="Devise">
              <Select value={values.budget_currency} onChange={(e) => set("budget_currency", e.target.value)} options={["XAF", "EUR", "USD"].map((v) => ({ value: v, label: optionLabel(v) }))} />
            </Field>
            <Field label="Délai souhaité">
              <Select
                value={values.timeline ?? ""}
                onChange={(e) => set("timeline", e.target.value)}
                placeholder="Choisir…"
                options={["immediate", "3_months", "6_months", "12_months", "undetermined"].map((v) => ({ value: v, label: optionLabel(v) }))}
              />
            </Field>
            <Field label="Financement" className="sm:col-span-2">
              <Select
                value={values.financing ?? ""}
                onChange={(e) => set("financing", e.target.value)}
                placeholder="Choisir…"
                options={[
                  { value: "fonds_propres", label: "Fonds propres" },
                  { value: "credit", label: "Crédit bancaire" },
                  { value: "mixte", label: "Mixte" },
                  { value: "investisseurs", label: "Investisseurs / associés" },
                  { value: "a_definir", label: "À définir" },
                ]}
              />
            </Field>
          </div>
          {estimate ? (
            <Alert tone="info" title="Estimation indicative">
              Entre {money(estimate.min, estimate.currency === "XAF" ? "FCFA" : estimate.currency)} et {money(estimate.max, estimate.currency === "XAF" ? "FCFA" : estimate.currency)}. {estimate.disclaimer}
            </Alert>
          ) : null}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Vos priorités</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRIORITIES.map(([value, label]) => (
                <Checkbox key={value} label={label} checked={values.priorities.includes(value)} onChange={() => toggle("priorities", value)} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Services souhaités</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SERVICES.map(([value, label]) => (
                <Checkbox key={value} label={label} checked={values.services_needed.includes(value)} onChange={() => toggle("services_needed", value)} />
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <Field label="Décrivez votre projet en quelques mots">
            <Textarea value={values.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={5000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" required error={errors.first_name}>
              <Input autoComplete="given-name" value={values.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} />
            </Field>
            <Field label="Nom">
              <Input autoComplete="family-name" value={values.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} />
            </Field>
            <Field label="E-mail" error={errors.email}>
              <Input type="email" autoComplete="email" value={values.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Téléphone" error={errors.phone}>
              <Input type="tel" autoComplete="tel" value={values.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="WhatsApp">
              <Input type="tel" value={values.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} />
            </Field>
            <Field label="Société (facultatif)">
              <Input autoComplete="organization" value={values.company ?? ""} onChange={(e) => set("company", e.target.value)} />
            </Field>
            <Field label="Pays de résidence">
              <Input autoComplete="country-name" value={values.country ?? ""} onChange={(e) => set("country", e.target.value)} />
            </Field>
            <Field label="Ville">
              <Input value={values.city ?? ""} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Canal de contact préféré">
              <Select
                value={values.preferred_channel}
                onChange={(e) => set("preferred_channel", e.target.value)}
                options={["whatsapp", "phone", "email"].map((v) => ({ value: v, label: optionLabel(v) }))}
              />
            </Field>
          </div>
          <div className="hidden" aria-hidden="true">
            <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </div>
          <div className="space-y-2">
            {consents.map((c) => (
              <div key={c.key}>
                <Checkbox label={c.label} checked={!!accepted[c.key]} onChange={(v) => setAccepted((s) => ({ ...s, [c.key]: v }))} />
                {errors[`consent:${c.key}`] ? <p className="ml-6 text-xs text-red-600">{errors[`consent:${c.key}`]}</p> : null}
              </div>
            ))}
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={next}>
            Continuer <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="accent" size="lg" onClick={submit} loading={busy}>
            Envoyer ma demande
          </Button>
        )}
      </div>
    </div>
  );
}
