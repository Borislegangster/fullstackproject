"use client";

import { CheckCircle2, FileText, Landmark, Lock, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Button } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import { date, dateTime, money } from "@/lib/format";

interface Dossier {
  partner: string;
  number: string;
  status: string;
  applicant: { name: string; email?: string | null; phone?: string | null };
  project?: { name: string; city?: string | null; contract_amount?: string | null } | null;
  amount: string;
  down_payment: string;
  duration_months: number;
  monthly_income: string;
  other_monthly_debts: string;
  documents: { kind: string; name: string; url: string }[];
  offer?: Record<string, string> | null;
  expires_at: string;
  consent_at?: string | null;
}

export function PartnerDossier({ token }: { token: string }) {
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [status, setStatus] = useState("offer");
  const [form, setForm] = useState({ responder_name: "", rate: "", amount: "", duration_months: "", monthly_payment: "", conditions: "", valid_until: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => {
    api<Dossier>(`/public/financing/dossiers/${encodeURIComponent(token)}`)
      .then((d) => {
        setDossier(d);
        setForm((f) => ({ ...f, amount: String(Number(d.amount) - Number(d.down_payment)), duration_months: String(d.duration_months) }));
      })
      .catch((err) => setFailure(errorMessage(err)));
  }, [token]);
  if (failure) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-line">
        <XCircle className="mx-auto h-12 w-12 text-red-500" />
        <h1 className="mt-3 text-xl font-bold text-brand-800">Dossier indisponible</h1>
        <p className="mt-2 text-muted">{failure}</p>
      </div>
    );
  }
  if (!dossier) return <div className="h-96 animate-pulse rounded-3xl bg-white ring-1 ring-line" />;
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const respond = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { status, responder_name: form.responder_name };
      if (status === "offer") {
        Object.assign(body, {
          rate: form.rate,
          amount: form.amount,
          duration_months: Number(form.duration_months),
          monthly_payment: form.monthly_payment || null,
          conditions: form.conditions || null,
          valid_until: form.valid_until || null,
        });
      }
      await api(`/public/financing/dossiers/${encodeURIComponent(token)}/respond`, { body });
      setSent(status);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-brand-800 to-brand-600 p-6 text-white sm:p-8">
        <p className="flex items-center gap-2 text-sm text-white/80">
          <Landmark className="h-4 w-4" /> Dossier transmis à {dossier.partner} par GLOBUS ENGINEERING
        </p>
        <h1 className="mt-2 font-title text-3xl font-bold text-white">
          {dossier.applicant.name} — {dossier.number}
        </h1>
        <p className="mt-1 text-sm text-white/80">
          Accord du client le {dateTime(dossier.consent_at)} · lien valable jusqu&apos;au {date(dossier.expires_at)}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-3xl bg-white p-6 ring-1 ring-line">
          <p className="font-semibold text-ink">Demande</p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Coût du projet</dt>
              <dd className="font-semibold">{money(dossier.amount)}</dd>
            </div>
            <div>
              <dt className="text-muted">Apport</dt>
              <dd className="font-semibold">{money(dossier.down_payment)}</dd>
            </div>
            <div>
              <dt className="text-muted">Durée souhaitée</dt>
              <dd className="font-semibold">{dossier.duration_months / 12} ans</dd>
            </div>
            <div>
              <dt className="text-muted">Revenus mensuels</dt>
              <dd className="font-semibold">{money(dossier.monthly_income)}</dd>
            </div>
            <div>
              <dt className="text-muted">Charges en cours</dt>
              <dd className="font-semibold">{money(dossier.other_monthly_debts)}</dd>
            </div>
            <div>
              <dt className="text-muted">Contact</dt>
              <dd className="font-semibold">{[dossier.applicant.phone, dossier.applicant.email].filter(Boolean).join(" · ")}</dd>
            </div>
          </dl>
          {dossier.project ? (
            <p className="rounded-xl bg-surface p-3 text-sm">
              Projet : <strong>{dossier.project.name}</strong>
              {dossier.project.city ? ` (${dossier.project.city})` : ""}
              {dossier.project.contract_amount ? ` · contrat ${money(dossier.project.contract_amount)}` : ""}
            </p>
          ) : null}
          <p className="pt-2 font-semibold text-ink">Pièces (filigranées)</p>
          <ul className="space-y-1 text-sm">
            {dossier.documents.map((d, i) => (
              <li key={i}>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brand-600 hover:underline">
                  <FileText className="h-4 w-4" /> {d.kind} — {d.name}
                </a>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-1.5 pt-2 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" /> Usage limité à l&apos;instruction de ce crédit. Ne pas transférer ce lien.
          </p>
        </div>
        <div className="space-y-3 rounded-3xl bg-white p-6 ring-1 ring-line">
          {sent ? (
            <p className="flex items-center gap-2 font-medium text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Réponse transmise au client. Merci !
            </p>
          ) : (
            <>
              <p className="font-semibold text-ink">Votre réponse</p>
              <Field label="Décision">
                <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "offer", label: "Offre de financement" }, { value: "in_review", label: "Dossier à l'étude" }, { value: "declined", label: "Refus" }]} />
              </Field>
              <Field label="Votre nom" required>
                <Input value={form.responder_name} onChange={(e) => set("responder_name", e.target.value)} />
              </Field>
              {status === "offer" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Taux annuel (%)" required>
                    <Input type="number" step="0.01" value={form.rate} onChange={(e) => set("rate", e.target.value)} />
                  </Field>
                  <Field label="Montant (FCFA)" required>
                    <Input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
                  </Field>
                  <Field label="Durée (mois)" required>
                    <Input type="number" value={form.duration_months} onChange={(e) => set("duration_months", e.target.value)} />
                  </Field>
                  <Field label="Mensualité (FCFA)">
                    <Input type="number" value={form.monthly_payment} onChange={(e) => set("monthly_payment", e.target.value)} />
                  </Field>
                  <Field label="Valable jusqu'au">
                    <Input type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} />
                  </Field>
                  <Field label="Conditions" className="sm:col-span-2">
                    <Textarea rows={3} value={form.conditions} onChange={(e) => set("conditions", e.target.value)} />
                  </Field>
                </div>
              ) : null}
              {dossier.offer ? <Alert tone="info">Offre déjà émise : la nouvelle réponse la remplace.</Alert> : null}
              {error ? <Alert tone="danger">{error}</Alert> : null}
              <Button loading={busy} disabled={form.responder_name.trim().length < 2} onClick={() => void respond()}>
                Envoyer la réponse
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
