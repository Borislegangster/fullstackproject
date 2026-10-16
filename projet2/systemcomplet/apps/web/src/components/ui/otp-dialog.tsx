"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { CodeInput, Field, Select } from "./form";
import { Modal } from "./overlay";
import { Alert, Button } from "./primitives";
import { errorMessage } from "@/lib/api";

export interface OtpChallenge {
  otp_token: string;
  sent_to?: string | null;
  channel?: string | null;
  expires_in?: number;
}

/** Validation forte par code à usage unique (OTP) : décisions, avenants, signatures (preuve horodatée). */
export function OtpDialog({
  open,
  onClose,
  title,
  description,
  children,
  channels,
  request,
  confirm,
  confirmLabel = "Valider",
  canConfirm = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  channels?: { value: string; label: string }[];
  request: (channel: string) => Promise<OtpChallenge>;
  confirm: (challenge: OtpChallenge, code: string) => Promise<void>;
  confirmLabel?: string;
  canConfirm?: boolean;
}) {
  const [channel, setChannel] = useState(channels?.[0]?.value ?? "email");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setChallenge(null);
      setCode("");
      setError(null);
    }
  }, [open]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      setChallenge(await request(channel));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await confirm(challenge, code);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        challenge ? (
          <>
            <Button variant="ghost" onClick={send} disabled={busy}>
              Renvoyer le code
            </Button>
            <Button onClick={submit} loading={busy} disabled={code.length < 4 || !canConfirm}>
              <ShieldCheck className="h-4 w-4" /> {confirmLabel}
            </Button>
          </>
        ) : (
          <Button onClick={send} loading={busy}>
            Recevoir mon code
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {children}
        {!challenge && channels && channels.length > 1 ? (
          <Field label="Recevoir le code par">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)} options={channels} />
          </Field>
        ) : null}
        {challenge ? (
          <>
            <p className="text-sm text-ink">Code envoyé{challenge.sent_to ? ` à ${challenge.sent_to}` : ""}. Il expire dans {Math.round((challenge.expires_in ?? 600) / 60)} minutes.</p>
            <Field label="Code reçu">
              <CodeInput value={code} onChange={setCode} autoFocus />
            </Field>
          </>
        ) : (
          <p className="text-sm text-muted">Votre validation sera horodatée et associée à l'empreinte du contenu validé : elle ne pourra plus être modifiée.</p>
        )}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </Modal>
  );
}
