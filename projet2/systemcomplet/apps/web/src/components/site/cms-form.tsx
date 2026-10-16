"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Button, Skeleton } from "@/components/ui/primitives";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import type { FormDefinitionPayload } from "@/lib/cms-types";
import { readReferral } from "@/lib/referral";
import { sessionId, track, utmParams } from "@/lib/tracker";

import { DescribeProjectWizard } from "./describe-wizard";

/** Formulaire public administré depuis le CMS (FormDefinition) : consentements, anti-robot, UTM, création de lead. */
export function CmsForm({
  formKey,
  initial,
  title,
  text,
  context,
  preview = false,
}: {
  formKey: string;
  initial?: FormDefinitionPayload | null;
  title?: string | null;
  text?: string | null;
  context?: Record<string, string>;
  /** Aperçu dans l'administration : rendu de la définition en cours d'édition, envoi désactivé. */
  preview?: boolean;
}) {
  const [loaded, setForm] = useState<FormDefinitionPayload | null>(initial ?? null);
  const form = preview ? (initial ?? null) : loaded;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...(context ?? {}) }));
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message?: string; reference?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preview || formKey === "describe_project") return;
    api<FormDefinitionPayload>(`/public/forms/${encodeURIComponent(formKey)}`)
      .then(setForm)
      .catch((err) => setLoadError(errorMessage(err)));
  }, [formKey, preview]);

  if (formKey === "describe_project" && !preview) return <DescribeProjectWizard title={title} context={context} />;

  if (loadError && !form) return <Alert tone="warning">Ce formulaire est momentanément indisponible.</Alert>;
  if (!form) return <Skeleton className="h-64 w-full" />;

  if (result)
    return (
      <div className="rounded-2xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <p className="mt-3 font-semibold text-emerald-900">{result.message ?? "Merci, votre demande est bien reçue."}</p>
        {result.reference ? <p className="mt-1 text-sm text-emerald-800">Référence : {result.reference}</p> : null}
      </div>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return;
    const errs: Record<string, string> = {};
    form.fields.forEach((f) => {
      const v = (values[f.name] ?? "").trim();
      if (f.required && !v) errs[f.name] = "Champ obligatoire";
      else if (v && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errs[f.name] = "E-mail invalide";
    });
    form.consents.forEach((c) => {
      if (c.required && !consents[c.key]) errs[`consent:${c.key}`] = "Consentement requis";
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ message?: string; reference?: string }>(`/public/forms/${encodeURIComponent(form.key)}/submit`, {
        method: "POST",
        body: {
          data: { ...(context ?? {}), ...values },
          consents,
          utm: utmParams(),
          landing_page: location.pathname,
          referrer: document.referrer || null,
          session_id: sessionId(),
          rendered_at: form.rendered_at,
          website: honeypot || null,
          referral_code: readReferral(),
        },
      });
      track({ type: "form_submit", target: `form:${form.key}` });
      if (form.key === "contact") track({ type: "contact_submit", target: "contact" });
      setResult(res ?? {});
    } catch (err) {
      const fe = fieldErrors(err);
      if (fe.length) setErrors(Object.fromEntries(fe.map((f) => [f.field.replace(/^data\./, ""), f.message])));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {title !== null && (title ?? form.title) ? <h3 className="text-xl font-bold text-brand-800">{title ?? form.title}</h3> : null}
      {text ?? form.description ? <p className="text-sm text-muted">{text ?? form.description}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {form.fields.map((f) => {
          const wide = f.type === "textarea";
          const value = values[f.name] ?? "";
          const set = (v: string) => setValues((s) => ({ ...s, [f.name]: v }));
          const id = `${form.key}-${f.name}`;
          return (
            <Field key={f.name} label={f.label} required={f.required} error={errors[f.name]} help={f.help} htmlFor={id} className={wide ? "sm:col-span-2" : undefined}>
              {f.type === "textarea" ? (
                <Textarea id={id} value={value} onChange={(e) => set(e.target.value)} rows={5} placeholder={f.placeholder} invalid={!!errors[f.name]} />
              ) : f.type === "select" ? (
                <Select
                  id={id}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="Choisir…"
                  options={(f.options ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : o))}
                  invalid={!!errors[f.name]}
                />
              ) : (
                <Input
                  id={id}
                  type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  autoComplete={f.name === "email" ? "email" : f.name === "phone" ? "tel" : f.name === "first_name" ? "given-name" : f.name === "last_name" ? "family-name" : undefined}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={f.placeholder}
                  invalid={!!errors[f.name]}
                />
              )}
            </Field>
          );
        })}
      </div>
      <div className="hidden" aria-hidden="true">
        <label>
          Site web
          <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </label>
      </div>
      <div className="space-y-2">
        {form.consents.map((c) => (
          <div key={c.key}>
            <Checkbox label={c.label} checked={!!consents[c.key]} onChange={(v) => setConsents((s) => ({ ...s, [c.key]: v }))} />
            {errors[`consent:${c.key}`] ? <p className="ml-6 text-xs text-red-600">{errors[`consent:${c.key}`]}</p> : null}
          </div>
        ))}
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button type="submit" variant="accent" size="lg" loading={busy} disabled={preview} className="w-full sm:w-auto">
        Envoyer
      </Button>
      {preview ? <p className="text-xs text-muted">Aperçu : l'envoi est désactivé.</p> : null}
    </form>
  );
}
