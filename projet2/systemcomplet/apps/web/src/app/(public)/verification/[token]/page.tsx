import { AlertTriangle, BadgeCheck, Download, ShieldCheck, XCircle } from "lucide-react";
import type { Metadata } from "next";

import { ProofFileCheck } from "@/components/innovations/proof-check";
import { dateLong, dateTime, money } from "@/lib/format";
import { optionLabel } from "@/lib/labels";
import { publicGetSafe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Vérification d'authenticité", robots: { index: false, follow: false } };

interface VerifyResult {
  valid: boolean;
  type?: "document" | "invoice" | "proof" | "sealed";
  // document scellé (reçu, devis, proforma, avoir, bon de commande, marché, bulletin…)
  kind?: string;
  kind_label?: string;
  issued_on?: string | null;
  amount?: string | null;
  party?: string | null;
  note?: string | null;
  message?: string | null;
  code?: string | null;
  title?: string;
  version?: string;
  status?: string;
  is_obsolete?: boolean;
  sha256?: string;
  issued_at?: string;
  published_at?: string | null;
  signatures?: { signer: string; signed_at: string; method: string }[];
  number?: string;
  issue_date?: string;
  total?: string;
  currency?: string;
  // preuve opposable (R4)
  subject?: string;
  subject_type?: string;
  algorithm?: string;
  summary?: Record<string, unknown>;
  leaves?: { label: string; sha256: string }[];
  anchor_status?: string;
  anchored_at?: string | null;
  ots_available?: boolean;
  revoked?: boolean;
  revoked_reason?: string | null;
}

const SUMMARY_LABELS: Record<string, string> = {
  number: "Référence",
  title: "Objet",
  option: "Option retenue",
  validated_at: "Validée le",
  method: "Mode de validation",
  code: "Code document",
  type: "Type",
  version: "Version",
  published_at: "Publié le",
  file_name: "Fichier",
  received_at: "Reçue le",
  lines: "Lignes",
  pieces: "Pièces jointes",
  geolocated: "Géolocalisée",
  day: "Journée",
  photos: "Photos",
  published_to_client: "Publiées au client",
};

function summaryValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "string" && /\d{4}-\d{2}-\d{2}T/.test(value)) return dateTime(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateLong(value);
  if (key === "type") return optionLabel(String(value));
  return String(value);
}

/** QR d'authenticité (anti-fraude) : document, facture ou preuve opposable émis par GLOBUS. */
export default async function VerificationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await publicGetSafe<VerifyResult>(`/public/verify/${encodeURIComponent(token)}`, { valid: false, message: "Vérification momentanément indisponible." }, undefined, { fresh: true });
  if (r.type === "proof") return <ProofView r={r} code={token} />;
  if (r.type === "sealed") return <SealedView r={r} />;
  return (
    <section className="bg-surface py-16 lg:py-24">
      <div className="container-page max-w-2xl">
        <div className="rounded-2xl bg-white p-8 text-center shadow-[var(--shadow-card)] ring-1 ring-line">
          {r.valid ? (
            r.is_obsolete ? (
              <AlertTriangle className="mx-auto h-14 w-14 text-amber-500" />
            ) : (
              <BadgeCheck className="mx-auto h-14 w-14 text-emerald-600" />
            )
          ) : (
            <XCircle className="mx-auto h-14 w-14 text-red-600" />
          )}
          <h1 className="mt-4 text-2xl font-bold text-brand-800">
            {r.valid ? (r.is_obsolete ? "Document authentique mais obsolète" : "Document authentique") : "Document non reconnu"}
          </h1>
          {!r.valid ? <p className="mt-2 text-muted">{r.message}</p> : null}
          {r.valid ? (
            <dl className="mt-6 space-y-3 text-left text-sm">
              {r.type === "invoice" ? (
                <>
                  <Row label="Facture" value={r.number} />
                  <Row label="Date d'émission" value={dateLong(r.issue_date)} />
                  <Row label="Montant TTC" value={money(r.total, r.currency === "XAF" ? "FCFA" : r.currency)} />
                  <Row label="Statut" value={optionLabel(r.status)} />
                </>
              ) : (
                <>
                  <Row label="Document" value={[r.code, r.title].filter(Boolean).join(" — ")} />
                  <Row label="Version" value={r.version} />
                  <Row label="Statut" value={optionLabel(r.status)} />
                  <Row label="Émis le" value={dateTime(r.issued_at)} />
                  {r.published_at ? <Row label="Publié le" value={dateTime(r.published_at)} /> : null}
                  <Row label="Empreinte SHA-256" value={<code className="break-all text-xs">{r.sha256}</code>} />
                  {r.signatures?.length ? (
                    <div>
                      <dt className="text-muted">Signatures</dt>
                      <dd>
                        <ul className="mt-1 space-y-1">
                          {r.signatures.map((s, i) => (
                            <li key={i} className="font-medium text-ink">
                              {s.signer} — {dateTime(s.signed_at)} ({optionLabel(s.method)})
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ) : null}
                </>
              )}
            </dl>
          ) : null}
          {r.is_obsolete ? <p className="mt-6 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Une version plus récente de ce document a été publiée : ne l'utilisez plus pour l'exécution.</p> : null}
          {r.valid && r.type === "document" && r.sha256 ? <ProofFileCheck sha256={r.sha256} leaves={[]} /> : null}
        </div>
      </div>
    </section>
  );
}

/** Document émis par GLOBUS et scellé (QR) : nature, numéro, date, montant, partie (masquée) et statut à jour. */
function SealedView({ r }: { r: VerifyResult }) {
  const revoked = Boolean(r.revoked);
  return (
    <section className="bg-surface py-16 lg:py-24">
      <div className="container-page max-w-2xl">
        <div className="rounded-2xl bg-white p-8 text-center shadow-[var(--shadow-card)] ring-1 ring-line">
          {revoked ? <XCircle className="mx-auto h-14 w-14 text-red-600" /> : <BadgeCheck className="mx-auto h-14 w-14 text-emerald-600" />}
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">{r.kind_label ?? "Document GLOBUS"}</p>
          <h1 className="mt-2 text-2xl font-bold text-brand-800">{revoked ? "Document annulé : il n'est plus valable" : "Document authentique"}</h1>
          <dl className="mt-6 space-y-3 text-left text-sm">
            <Row label="Nature" value={r.kind_label} />
            <Row label="Numéro" value={r.number} />
            {r.title ? <Row label="Objet" value={r.title} /> : null}
            <Row label="Émis le" value={dateLong(r.issued_on)} />
            {r.amount ? <Row label="Montant" value={money(r.amount, r.currency === "XAF" ? "FCFA" : r.currency)} /> : null}
            {r.party ? <Row label="Concerne" value={r.party} /> : null}
            {r.status ? <Row label="Statut actuel" value={optionLabel(r.status)} /> : null}
            {r.sha256 ? <Row label="Empreinte SHA-256" value={<code className="break-all text-xs">{r.sha256}</code>} /> : null}
          </dl>
          {r.note ? <p className="mt-6 rounded-xl bg-amber-50 p-3 text-left text-sm text-amber-900">{r.note}</p> : null}
          <p className="mt-6 text-xs text-muted">Comparez ces informations avec le document en votre possession : toute différence signale une falsification.</p>
        </div>
      </div>
    </section>
  );
}

function ProofView({ r, code }: { r: VerifyResult; code: string }) {
  const revoked = Boolean(r.revoked);
  const anchored = r.anchor_status === "pending" && r.anchored_at;
  const base = `/api/v1/public/proofs/${encodeURIComponent(code)}`;
  return (
    <section className="relative overflow-hidden bg-surface py-16 lg:py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-100/60 to-transparent" aria-hidden="true" />
      <div className="container-page relative max-w-2xl">
        <div className="rounded-3xl bg-white p-8 shadow-[var(--shadow-card)] ring-1 ring-line">
          <div className="text-center">
            {revoked ? <XCircle className="mx-auto h-14 w-14 text-red-600" /> : <ShieldCheck className="mx-auto h-14 w-14 text-emerald-600" />}
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Preuve opposable GLOBUS</p>
            <h1 className="mt-2 text-2xl font-bold text-brand-800">{revoked ? "Preuve révoquée" : "Empreinte certifiée"}</h1>
            <p className="mt-2 text-muted">{r.title}</p>
          </div>
          {revoked ? (
            <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-900">
              Cette preuve a été révoquée par GLOBUS ENGINEERING{r.revoked_reason ? ` : ${r.revoked_reason}` : ""}. Elle ne doit plus être utilisée.
            </p>
          ) : null}
          <dl className="mt-6 space-y-3 text-sm">
            <Row label="Nature" value={r.subject} />
            <Row label="Numéro" value={r.number} />
            <Row label="Certifiée le" value={dateTime(r.issued_at)} />
            <Row
              label="Horodatage"
              value={anchored ? `Ancré dans OpenTimestamps (soumis le ${dateTime(r.anchored_at)})` : r.anchor_status === "queued" ? "Ancrage public en cours" : "Registre infalsifiable GLOBUS"}
            />
            {Object.entries(r.summary ?? {}).map(([k, v]) => (
              <Row key={k} label={SUMMARY_LABELS[k] ?? k} value={summaryValue(k, v)} />
            ))}
            <Row label={r.algorithm === "merkle-sha256" ? "Racine de Merkle (SHA-256)" : "Empreinte SHA-256"} value={<code className="break-all text-xs">{r.sha256}</code>} />
          </dl>
          {r.leaves?.length ? (
            <details className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-ink">Pièces du lot ({r.leaves.length})</summary>
              <ul className="mt-2 space-y-1">
                {r.leaves.map((l, i) => (
                  <li key={`${l.sha256}-${i}`} className="flex flex-col gap-0.5 border-b border-line pb-1 last:border-0">
                    <span className="text-muted">{l.label}</span>
                    <code className="break-all text-[11px]">{l.sha256}</code>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {!revoked && r.sha256 ? <ProofFileCheck sha256={r.sha256} leaves={r.leaves ?? []} /> : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href={`${base}/certificate.pdf`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              <Download className="h-4 w-4" /> Certificat PDF
            </a>
            {r.ots_available ? (
              <a href={`${base}/ots`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-line hover:ring-brand-300">
                <Download className="h-4 w-4" /> Reçu OpenTimestamps (.ots)
              </a>
            ) : null}
          </div>
          {r.ots_available ? (
            <p className="mt-4 text-center text-xs text-muted">
              Vérification indépendante : <code>ots upgrade fichier.ots</code> puis <code>ots verify fichier.ots</code> (outil officiel OpenTimestamps).
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="max-w-full text-right font-medium text-ink">{value ?? "—"}</dd>
    </div>
  );
}
