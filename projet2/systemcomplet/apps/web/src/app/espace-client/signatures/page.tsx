"use client";

import { ExternalLink, FileSignature } from "lucide-react";
import { useState } from "react";

import { PartyBadge, SignDocumentDialog, type SignableDocument } from "@/components/signatures/sign-document";
import { Alert, Button, Card, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

type Doc = SignableDocument & { status: string; amount?: string | null; currency?: string | null };

/** Documents à signer : devis et contrats qui attendent ma signature manuscrite (validée par code), et ceux signés. */
export default function ClientSignaturesPage() {
  const { can } = useAuth();
  const docs = useApi<Doc[]>("/signatures/mine");
  const [current, setCurrent] = useState<Doc | null>(null);
  if (docs.loading && !docs.data) return <Skeleton className="h-96 w-full" />;
  const rows = docs.data ?? [];
  const pending = rows.filter((d) => {
    const mine = d.parties.find((p) => p.party === "client");
    return mine && !mine.signed && !mine.blocked;
  });
  const others = rows.filter((d) => !pending.includes(d));
  const item = (d: Doc) => {
    const mine = d.parties.find((p) => p.party === "client");
    return (
      <li key={`${d.kind}:${d.entity_id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{d.kind_label}</p>
          <p className="font-semibold text-ink">
            {d.reference}
            {d.title ? <span className="font-normal text-muted"> — {d.title}</span> : null}
          </p>
          <p className="text-xs text-muted">
            {d.amount ? `${money(d.amount, d.currency === "XAF" || !d.currency ? "FCFA" : d.currency)} · ` : ""}
            {d.parties.map((p) => `${p.label} : ${p.signed ? `signé le ${dateTime(p.signed_at)}` : "en attente"}`).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mine ? <PartyBadge state={mine} /> : null}
          <a href={apiUrl(`/signatures/${d.kind}/${d.entity_id}/pdf`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
            <ExternalLink className="h-3.5 w-3.5" /> PDF
          </a>
          {mine && !mine.signed && !mine.blocked && can("client:decide") ? (
            <Button size="sm" onClick={() => setCurrent(d)}>
              <FileSignature className="h-4 w-4" /> Signer
            </Button>
          ) : null}
        </div>
      </li>
    );
  };
  return (
    <div className="space-y-5">
      <PageTitle
        title="Documents à signer"
        subtitle="Signez vos devis et contrats à la main, avec la souris ou le doigt, puis validez avec le code reçu : votre signature est apposée sur le document, horodatée et liée à son contenu exact."
      />
      {docs.error ? <Alert tone="danger">{docs.error}</Alert> : null}
      {!rows.length ? (
        <EmptyState icon={<FileSignature className="h-8 w-8" />} title="Aucun document à signer" text="Vos devis et contrats apparaîtront ici dès que GLOBUS ENGINEERING vous les adressera." />
      ) : (
        <>
          <Card>
            <h2 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">En attente de ma signature ({pending.length})</h2>
            {pending.length ? <ul className="divide-y divide-line">{pending.map(item)}</ul> : <p className="px-5 py-4 text-sm text-muted">Aucun document en attente.</p>}
          </Card>
          {others.length ? (
            <Card>
              <h2 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">Signés ou clos</h2>
              <ul className="divide-y divide-line">{others.map(item)}</ul>
            </Card>
          ) : null}
        </>
      )}
      <SignDocumentDialog
        open={current !== null}
        onClose={() => setCurrent(null)}
        doc={current}
        party="client"
        onSigned={() => {
          setCurrent(null);
          void docs.reload();
        }}
      />
    </div>
  );
}
