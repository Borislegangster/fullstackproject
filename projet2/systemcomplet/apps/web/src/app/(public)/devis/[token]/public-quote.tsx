"use client";

import { CheckCircle2, Download, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Checkbox, CodeInput, Field, Input } from "@/components/ui/form";
import { Alert, Button, Card, CardHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { date, money, number, percent } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface QuoteLine {
  section?: string | null;
  designation: string;
  description?: string | null;
  unit: string;
  quantity: string;
  unit_price: string;
  total: string;
}

interface PublicQuoteData {
  number: string;
  revision: number;
  title: string;
  introduction?: string | null;
  terms?: string | null;
  status: string;
  currency: string;
  valid_until?: string | null;
  subtotal: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  payment_schedule?: { label: string; pct?: number | string; amount?: string; due?: string }[] | null;
  accepted_at?: string | null;
  lines: QuoteLine[];
}

/** Devis en ligne : consultation, téléchargement PDF et acceptation par code OTP (preuve horodatée). */
export function PublicQuote({ token }: { token: string }) {
  const { data: quote, error, loading, reload } = useApi<PublicQuoteData>(`/public/quotes/${encodeURIComponent(token)}`);
  const [otp, setOtp] = useState<{ otp_token: string; sent_to: string } | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !quote) return <Alert tone="danger" title="Devis indisponible">{error ?? "Ce lien est invalide ou a expiré."}</Alert>;
  const cur = quote.currency === "XAF" ? "FCFA" : quote.currency;
  const sections = quote.lines.reduce<Record<string, QuoteLine[]>>((acc, l) => {
    const key = l.section || "";
    (acc[key] ??= []).push(l);
    return acc;
  }, {});
  const accepted = quote.status === "accepted" || done;
  const expired = quote.valid_until ? new Date(quote.valid_until) < new Date(new Date().toDateString()) : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            Devis {quote.number} · révision {quote.revision}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-brand-800">{quote.title}</h1>
          {quote.valid_until ? <p className="mt-1 text-sm text-muted">Valable jusqu'au {date(quote.valid_until)}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={quote.status} />
          <a href={apiUrl(`/public/quotes/${encodeURIComponent(token)}/pdf`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
            <Download className="h-4 w-4" /> PDF
          </a>
        </div>
      </div>
      {quote.introduction ? <Card className="whitespace-pre-line p-5 text-sm text-ink">{quote.introduction}</Card> : null}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Désignation</th>
                <th className="px-4 py-3 text-right">Qté</th>
                <th className="px-4 py-3">Unité</th>
                <th className="px-4 py-3 text-right">Prix unitaire</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {Object.entries(sections).map(([section, lines]) => (
                <SectionRows key={section} section={section} lines={lines} cur={cur} />
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto max-w-sm space-y-1 border-t border-line p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Sous-total HT</dt>
            <dd>{money(quote.subtotal, cur)}</dd>
          </div>
          {Number(quote.discount_amount) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted">Remise</dt>
              <dd>- {money(quote.discount_amount, cur)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted">TVA ({percent(Number(quote.tax_rate) * (Number(quote.tax_rate) <= 1 ? 100 : 1), 2)})</dt>
            <dd>{money(quote.tax_amount, cur)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-brand-800">
            <dt>Total TTC</dt>
            <dd>{money(quote.total, cur)}</dd>
          </div>
        </dl>
      </Card>
      {quote.payment_schedule?.length ? (
        <Card>
          <CardHeader title="Échéancier de paiement" />
          <ul className="divide-y divide-line">
            {quote.payment_schedule.map((p, i) => (
              <li key={i} className="flex justify-between px-5 py-3 text-sm">
                <span>{p.label}</span>
                <span className="font-medium">{p.amount ? money(p.amount, cur) : p.pct !== undefined ? `${number(p.pct)} %` : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {quote.terms ? (
        <Card className="p-5">
          <p className="mb-2 font-semibold text-brand-800">Conditions</p>
          <p className="whitespace-pre-line text-sm text-muted">{quote.terms}</p>
        </Card>
      ) : null}

      {accepted ? (
        <Alert tone="success" title="Devis accepté">
          Merci ! Votre acceptation a été enregistrée{quote.accepted_at ? ` le ${date(quote.accepted_at)}` : ""}. Votre conseiller vous contacte pour la suite.
        </Alert>
      ) : expired ? (
        <Alert tone="warning" title="Devis expiré">
          La date de validité est dépassée : contactez votre conseiller pour obtenir une révision.
        </Alert>
      ) : ["sent", "viewed"].includes(quote.status) ? (
        <Card className="p-6">
          <p className="flex items-center gap-2 text-lg font-semibold text-brand-800">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Accepter ce devis
          </p>
          <p className="mt-1 text-sm text-muted">Un code de validation est envoyé par e-mail au contact du devis. Votre acceptation est horodatée et associée à l'empreinte du document.</p>
          {!otp ? (
            <Button
              className="mt-4"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setMessage(null);
                try {
                  setOtp(await api(`/public/quotes/${encodeURIComponent(token)}/otp`, { method: "POST" }));
                } catch (err) {
                  setMessage(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Recevoir mon code de validation
            </Button>
          ) : (
            <div className="mt-4 grid gap-4 sm:max-w-md">
              <p className="text-sm text-ink">Code envoyé à {otp.sent_to}.</p>
              <Field label="Code reçu" required>
                <CodeInput value={code} onChange={setCode} autoFocus />
              </Field>
              <Field label="Nom et prénom du signataire" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <Checkbox label="J'ai lu le devis et j'accepte ses conditions." checked={terms} onChange={setTerms} />
              <Button
                variant="accent"
                loading={busy}
                disabled={code.length !== 6 || name.trim().length < 3 || !terms}
                onClick={async () => {
                  setBusy(true);
                  setMessage(null);
                  try {
                    await api(`/public/quotes/${encodeURIComponent(token)}/accept`, { method: "POST", body: { full_name: name.trim(), otp_token: otp.otp_token, code, accept_terms: true } });
                    setDone(true);
                    void reload();
                  } catch (err) {
                    setMessage(errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <CheckCircle2 className="h-4 w-4" /> J'accepte le devis
              </Button>
            </div>
          )}
          {message ? (
            <div className="mt-4">
              <Alert tone="danger">{message}</Alert>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function SectionRows({ section, lines, cur }: { section: string; lines: QuoteLine[]; cur: string }) {
  return (
    <>
      {section ? (
        <tr className="bg-slate-50">
          <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
            {section}
          </td>
        </tr>
      ) : null}
      {lines.map((l, i) => (
        <tr key={`${section}-${i}`}>
          <td className="px-4 py-3">
            <p className="font-medium text-ink">{l.designation}</p>
            {l.description ? <p className="text-xs text-muted">{l.description}</p> : null}
          </td>
          <td className="px-4 py-3 text-right tabular-nums">{number(l.quantity, 2)}</td>
          <td className="px-4 py-3">{l.unit}</td>
          <td className="px-4 py-3 text-right tabular-nums">{money(l.unit_price, cur)}</td>
          <td className="px-4 py-3 text-right font-medium tabular-nums">{money(l.total, cur)}</td>
        </tr>
      ))}
    </>
  );
}
