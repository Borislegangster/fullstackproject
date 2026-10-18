"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Field, controlClass } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Button } from "@/components/ui/primitives";
import { api, errorMessage, setMfaStepUpHandler } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Confirmation par double authentification d'une session déjà ouverte : affichée quand une opération sensible
 * (coffre de secrets, intégrations…) est refusée avec MFA_REQUIRED ; la requête est rejouée après confirmation.
 */
export function MfaStepUpHost({ accountHref }: { accountHref: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    setMfaStepUpHandler(
      () =>
        new Promise<boolean>((resolve) => {
          resolver.current = resolve;
          setCode("");
          setError(null);
          setRecovery(false);
          setOpen(true);
        }),
    );
    return () => setMfaStepUpHandler(null);
  }, []);

  const finish = (ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await api("/auth/mfa/step-up", { body: recovery ? { recovery_code: value } : { code: value.replace(/\s+/g, "") } });
      finish(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const mfaReady = !!user?.mfa_enabled;
  return (
    <Modal
      open={open}
      onClose={() => finish(false)}
      size="sm"
      title={
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-600" /> Confirmer avec votre double authentification
        </span>
      }
      description="Opération sensible : confirmez votre identité pour continuer. Votre session reste confirmée ensuite."
    >
      {mfaReady ? (
        <form onSubmit={submit} className="space-y-4">
          <Field
            label={recovery ? "Code de secours" : "Code à 6 chiffres de votre application d'authentification"}
            error={error}
          >
            <input
              className={controlClass}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode={recovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              autoFocus
              maxLength={recovery ? 32 : 12}
              placeholder={recovery ? "XXXX-XXXX" : "123456"}
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="text-sm font-semibold text-brand-700 underline" onClick={() => { setRecovery(!recovery); setCode(""); setError(null); }}>
              {recovery ? "Utiliser l'application d'authentification" : "Utiliser un code de secours"}
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => finish(false)}>
                Annuler
              </Button>
              <Button type="submit" loading={busy} disabled={!code.trim()}>
                Confirmer
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <Alert tone="warning">Activez d&apos;abord la double authentification sur votre compte, puis recommencez l&apos;opération.</Alert>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => finish(false)}>
              Fermer
            </Button>
            <Link href={`${accountHref}?mfa=obligatoire`} onClick={() => finish(false)} className="inline-flex items-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
              Activer la double authentification
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
