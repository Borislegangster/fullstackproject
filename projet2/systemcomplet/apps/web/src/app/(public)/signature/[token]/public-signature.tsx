"use client";

import { CheckCircle2, ExternalLink, FileSignature, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { PartyBadge, type Challenge, type SignableDocument, SignatureForm } from "@/components/signatures/sign-document";
import { Alert, Card, Skeleton } from "@/components/ui/primitives";
import { api, apiUrl } from "@/lib/api";
import { dateTime, money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Lien personnel de signature (sans compte) : relire le document, le signer à la main et valider par le code reçu
 * par e-mail. */
export function PublicSignature({ token }: { token: string }) {
  const base = `/public/signatures/${encodeURIComponent(token)}`;
  const state = useApi<SignableDocument & { amount?: string | null; currency?: string | null }>(base);
  const [done, setDone] = useState(false);
  if (state.loading && !state.data) return <Skeleton className="h-96 w-full" />;
  if (!state.data) return <Alert tone="danger" title="Lien indisponible">{state.error ?? "Ce lien de signature est introuvable ou a expiré."}</Alert>;
  const doc = state.data;
  const client = doc.parties.find((p) => p.party === "client");
  const signed = done || Boolean(client?.signed);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-600">{doc.kind_label}</p>
        <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">{doc.reference}</h1>
        {doc.title ? <p className="mt-1 text-muted">{doc.title}</p> : null}
      </div>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="text-sm">
          {doc.party_name ? <p className="font-semibold text-ink">{doc.party_name}</p> : null}
          {doc.amount ? <p className="text-muted">Montant : {money(doc.amount, doc.currency === "XAF" || !doc.currency ? "FCFA" : doc.currency)}</p> : null}
        </div>
        <a href={apiUrl(`${base}/pdf`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
          <ExternalLink className="h-4 w-4" /> Lire le document (PDF)
        </a>
      </Card>
      <Card>
        <ul className="divide-y divide-line">
          {doc.parties.map((p) => (
            <li key={p.party} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">{p.label}</p>
                {p.signed ? <p className="text-xs text-muted">Signé par {p.signer_name} le {dateTime(p.signed_at)}</p> : null}
              </div>
              <PartyBadge state={p} />
            </li>
          ))}
        </ul>
      </Card>
      {signed ? (
        <Alert tone="success" title="Document signé">
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          Merci ! Votre signature est apposée sur le document et validée électroniquement. Vous pouvez télécharger le document signé ci-dessus.
        </Alert>
      ) : client?.blocked ? (
        <Alert tone="warning">{client.blocked}</Alert>
      ) : (
        <Card className="p-6">
          <p className="flex items-center gap-2 text-lg font-semibold text-brand-800">
            <FileSignature className="h-5 w-5 text-accent-600" /> Signer le document
          </p>
          <p className="mb-4 mt-1 flex items-start gap-2 text-sm text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Dessinez votre signature à la souris ou au doigt, puis validez-la avec le code envoyé à {doc.signer_email ?? "votre adresse e-mail"}. La signature est horodatée et liée à l&apos;empreinte exacte du document.
          </p>
          <SignatureForm
            askName
            defaultName={doc.signer_name}
            channels={false}
            consent={doc.consent}
            requestCode={() => api<Challenge>(`${base}/otp`, { method: "POST" })}
            submit={async (p) => {
              const res = await api<SignableDocument>(base, { method: "POST", body: p });
              state.setData({ ...doc, ...res });
              setDone(true);
            }}
          />
        </Card>
      )}
    </div>
  );
}
