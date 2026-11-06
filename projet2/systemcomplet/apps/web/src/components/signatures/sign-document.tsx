"use client";

import { CheckCircle2, Clock3, ExternalLink, FileSignature, Mail, PenLine, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Checkbox, CodeInput, Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { SignaturePad, type SignaturePadHandle } from "@/components/ui/signature-pad";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export type Party = "company" | "client";

export interface PartyState {
  party: Party;
  label: string;
  signed: boolean;
  stale: boolean;
  signer_name?: string | null;
  signed_at?: string | null;
  reference?: string | null;
  blocked?: string | null;
}

export interface SignableDocument {
  kind: string;
  kind_label: string;
  entity_id: string;
  reference: string;
  title?: string | null;
  party_name?: string | null;
  verify_url?: string;
  erp_link?: string | null;
  parties: PartyState[];
  consent: string;
  can_sign?: Party[];
  signer_name?: string | null;
  signer_email?: string | null;
  status?: string;
  client_contact?: { name?: string | null; email?: string | null } | null;
}

export interface Challenge {
  otp_token: string;
  sent_to?: string | null;
  channel?: string | null;
}

export interface SignaturePayload {
  image: string;
  otp_token: string;
  code: string;
  consent: true;
  remember?: boolean;
  full_name?: string;
}

const CHANNELS = [
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
];

/** Signer : 1) dessiner sa signature (souris, doigt, stylet) ou reprendre celle mémorisée ; 2) consentir ; 3) la
 * valider électroniquement avec le code à usage unique reçu personnellement. */
export function SignatureForm({
  consent,
  requestCode,
  submit,
  askName,
  defaultName,
  channels = true,
  allowRemember = false,
  submitLabel = "Signer le document",
}: {
  consent: string;
  requestCode: (channel: string) => Promise<Challenge>;
  submit: (payload: SignaturePayload) => Promise<void>;
  askName?: boolean;
  defaultName?: string | null;
  channels?: boolean;
  allowRemember?: boolean;
  submitLabel?: string;
}) {
  const pad = useRef<SignaturePadHandle>(null);
  const [empty, setEmpty] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [useSaved, setUseSaved] = useState(false);
  const [remember, setRemember] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState(defaultName ?? "");
  const [channel, setChannel] = useState("email");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowRemember) return;
    api<{ saved: boolean; image: string | null }>("/signatures/me/saved")
      .then((r) => setSaved(r.image))
      .catch(() => setSaved(null));
  }, [allowRemember]);

  const hasDrawing = useSaved ? Boolean(saved) : !empty;
  const ready = hasDrawing && agreed && (!askName || name.trim().length >= 3);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      setChallenge(await requestCode(channel));
      setCode("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    if (!challenge) return;
    const image = useSaved ? saved : pad.current?.toDataURL();
    if (!image) {
      setError("Dessinez votre signature avant de valider.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submit({
        image,
        otp_token: challenge.otp_token,
        code,
        consent: true,
        ...(allowRemember ? { remember: remember && !useSaved } : {}),
        ...(askName ? { full_name: name.trim() } : {}),
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <PenLine className="h-4 w-4 text-brand-600" /> 1. Votre signature manuscrite
        </h3>
        {saved ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={useSaved ? "primary" : "secondary"} onClick={() => setUseSaved(true)}>
              Utiliser ma signature enregistrée
            </Button>
            <Button type="button" size="sm" variant={useSaved ? "secondary" : "primary"} onClick={() => setUseSaved(false)}>
              Dessiner une nouvelle signature
            </Button>
          </div>
        ) : null}
        {useSaved && saved ? (
          <div className="flex h-[150px] items-center justify-center rounded-2xl border-2 border-dashed border-brand-200 bg-white">
            <img src={saved} alt="Ma signature enregistrée" className="max-h-[120px] max-w-[80%] object-contain" />
          </div>
        ) : (
          <SignaturePad ref={pad} onChange={setEmpty} disabled={Boolean(challenge) && busy} />
        )}
        {allowRemember && !useSaved ? (
          <Checkbox label="Mémoriser ma signature" description="Elle vous sera proposée pour les prochains documents ; vous la validerez toujours par un code." checked={remember} onChange={setRemember} />
        ) : null}
      </section>
      {askName ? (
        <Field label="Nom et prénom du signataire" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
      ) : null}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-brand-600" /> 2. Validation électronique
        </h3>
        <Checkbox label="J'approuve et je signe" description={consent} checked={agreed} onChange={setAgreed} />
        {!challenge ? (
          <div className="flex flex-wrap items-end gap-2">
            {channels ? (
              <Field label="Recevoir le code par" className="min-w-[10rem]">
                <Select value={channel} onChange={(e) => setChannel(e.target.value)} options={CHANNELS} />
              </Field>
            ) : null}
            <Button type="button" onClick={send} loading={busy} disabled={!ready}>
              <Mail className="h-4 w-4" /> Recevoir mon code
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              Code envoyé{challenge.sent_to ? ` à ${challenge.sent_to}` : ""} ; il expire dans 10 minutes.
            </p>
            <Field label="Code reçu">
              <CodeInput value={code} onChange={setCode} autoFocus />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={send} disabled={busy}>
                Renvoyer le code
              </Button>
              <Button type="button" onClick={sign} loading={busy} disabled={code.length < 6 || !ready}>
                <FileSignature className="h-4 w-4" /> {submitLabel}
              </Button>
            </div>
          </div>
        )}
      </section>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

/** Fenêtre « Signer le document » (ERP, espace client) : aperçu du PDF, signature dessinée, code. */
export function SignDocumentDialog({
  open,
  onClose,
  doc,
  party,
  onSigned,
}: {
  open: boolean;
  onClose: () => void;
  doc: SignableDocument | null;
  party: Party;
  onSigned: (doc: SignableDocument) => void;
}) {
  const toast = useToast();
  if (!doc) return null;
  const base = `/signatures/${doc.kind}/${doc.entity_id}`;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Signer le document"
      description={`${doc.kind_label} ${doc.reference}${doc.title ? ` — ${doc.title}` : ""}`}
    >
      <div className="space-y-4">
        <Alert tone="info" title={party === "company" ? "Signature au nom de GLOBUS ENGINEERING" : "Votre signature"}>
          {party === "company"
            ? "Votre signature est apposée sur le cachet de l'entreprise, dans le bloc « GLOBUS ENGINEERING » du document."
            : "Votre signature est apposée dans votre bloc de signature du document."}{" "}
          <a href={apiUrl(`${base}/pdf`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
            Relire le document <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Alert>
        <SignatureForm
          consent={doc.consent}
          allowRemember
          requestCode={(channel) => api<Challenge>(`${base}/otp`, { method: "POST", body: { party, channel } })}
          submit={async (payload) => {
            const res = await api<SignableDocument>(`${base}/sign`, { method: "POST", body: { party, ...payload } });
            toast.success("Document signé", "Signature apposée et validée électroniquement ; le PDF est à jour.");
            onSigned(res);
            onClose();
          }}
        />
      </div>
    </Modal>
  );
}

export function PartyBadge({ state }: { state: PartyState }) {
  if (state.signed)
    return (
      <Badge tone="success">
        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
        Signé
      </Badge>
    );
  if (state.stale)
    return (
      <Badge tone="warning">
        <TriangleAlert className="mr-1 inline h-3.5 w-3.5" />À signer de nouveau
      </Badge>
    );
  return (
    <Badge tone="neutral">
      <Clock3 className="mr-1 inline h-3.5 w-3.5" />À signer
    </Badge>
  );
}

/** Encadré « Signatures » d'un document : état de chaque partie, « Signer », PDF signé, envoi au client. */
export function SignaturePanel({ kind, entityId, onChange }: { kind: string; entityId: string; onChange?: () => void }) {
  const { can, user } = useAuth();
  const toast = useToast();
  const state = useApi<SignableDocument>(`/signatures/${kind}/${entityId}`);
  const [party, setParty] = useState<Party | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [recipient, setRecipient] = useState({ email: "", name: "" });
  if (state.loading && !state.data) return <Skeleton className="h-28 w-full" />;
  if (!state.data) return state.error ? <Alert tone="warning">{state.error}</Alert> : null;
  const doc = state.data;
  const canRequest = Boolean(user?.spaces.includes("erp")) && kind === "contract" && can("crm:contracts") && doc.parties.some((p) => p.party === "client" && !p.signed && !p.blocked?.includes("signé"));
  return (
    <Card>
      <CardHeader
        title="Signatures"
        subtitle="Signature manuscrite validée par code à usage unique ; cachet de l'entreprise sur le bloc GLOBUS ENGINEERING."
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={apiUrl(`/signatures/${kind}/${entityId}/pdf`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
              <ExternalLink className="h-3.5 w-3.5" /> PDF signé
            </a>
            {canRequest ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setRecipient({ email: doc.client_contact?.email ?? "", name: doc.client_contact?.name ?? "" });
                  setAsking(true);
                }}
              >
                <Mail className="h-4 w-4" /> Envoyer au client pour signature
              </Button>
            ) : null}
          </div>
        }
      />
      <ul className="divide-y divide-line">
        {doc.parties.map((p) => (
          <li key={p.party} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{p.label}</p>
              <p className="text-xs text-muted">
                {p.signed
                  ? `Signé par ${p.signer_name} le ${dateTime(p.signed_at)} · ${p.reference}`
                  : p.stale
                    ? `Signature de ${p.signer_name} (${dateTime(p.signed_at)}) caduque : le document a changé depuis.`
                    : (p.blocked ?? "En attente de signature")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PartyBadge state={p} />
              {!p.signed && !p.blocked && doc.can_sign?.includes(p.party) ? (
                <Button size="sm" onClick={() => setParty(p.party)}>
                  <FileSignature className="h-4 w-4" /> Signer
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Modal
        open={asking}
        onClose={() => setAsking(false)}
        title="Envoyer au client pour signature"
        description="Le signataire reçoit par e-mail un lien personnel, valable 30 jours, pour lire le document, le signer à la main et valider par code."
        footer={
          <Button
            loading={requesting}
            disabled={!/^S+@S+.S+$/.test(recipient.email.trim())}
            onClick={async () => {
              setRequesting(true);
              try {
                const res = await api<{ sent_to: string }>(`/signatures/${kind}/${entityId}/request`, {
                  method: "POST",
                  body: { email: recipient.email.trim(), name: recipient.name.trim() || undefined },
                });
                toast.success("Lien de signature envoyé", `Le client (${res.sent_to}) reçoit un lien personnel pour signer.`);
                setAsking(false);
                void state.reload();
                onChange?.();
              } catch (err) {
                toast.error("Envoi impossible", errorMessage(err));
              } finally {
                setRequesting(false);
              }
            }}
          >
            <Mail className="h-4 w-4" /> Envoyer le lien
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="E-mail du signataire" required>
            <Input type="email" value={recipient.email} onChange={(e) => setRecipient((r) => ({ ...r, email: e.target.value }))} autoComplete="email" />
          </Field>
          <Field label="Nom du signataire">
            <Input value={recipient.name} onChange={(e) => setRecipient((r) => ({ ...r, name: e.target.value }))} />
          </Field>
        </div>
      </Modal>
      <SignDocumentDialog
        open={party !== null}
        onClose={() => setParty(null)}
        doc={doc}
        party={party ?? "company"}
        onSigned={(res) => {
          state.setData({ ...doc, ...res });
          onChange?.();
        }}
      />
    </Card>
  );
}
