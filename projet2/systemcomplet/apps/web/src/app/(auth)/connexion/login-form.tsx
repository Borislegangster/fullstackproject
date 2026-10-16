"use client";

import { Eye, EyeOff, Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Checkbox, CodeInput, Field, Input } from "@/components/ui/form";
import { Alert, Button, Card } from "@/components/ui/primitives";
import { api, ApiError, errorMessage, newKey } from "@/lib/api";
import { homeFor, safeNext, type Me } from "@/lib/auth";
import { webauthnAuthenticate, webauthnSupported } from "@/lib/webauthn";

function deviceKey(): string {
  let key = localStorage.getItem("globus_device");
  if (!key) {
    key = newKey();
    localStorage.setItem("globus_device", key);
  }
  return key;
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return `${browser}${os ? ` · ${os}` : ""}`;
}

type Step = { kind: "credentials" } | { kind: "mfa"; token: string; methods: string[]; mode: "totp" | "recovery" };

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("suite"));
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const verify = params.get("verify");
    if (verify) {
      api("/auth/email/verify", { method: "POST", body: { token: verify } })
        .then(() => setNotice("Votre adresse e-mail est confirmée. Vous pouvez vous connecter."))
        .catch((err) => setError(errorMessage(err)));
    } else {
      api<Me>("/auth/me")
        .then((me) => router.replace(next ?? homeFor(me)))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (payload: { user: Me }) => {
    router.replace(next ?? homeFor(payload.user));
    router.refresh();
  };

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ mfa_required?: boolean; mfa_token?: string; methods?: string[]; user?: Me }>("/auth/login", {
        method: "POST",
        body: { email: email.trim(), password, remember, device_key: deviceKey(), device_name: deviceName() },
      });
      if (res.mfa_required && res.mfa_token) {
        setStep({ kind: "mfa", token: res.mfa_token, methods: res.methods ?? ["totp"], mode: "totp" });
      } else if (res.user) finish(res as { user: Me });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Identifiants incorrects." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (body: Record<string, unknown>) => {
    if (step.kind !== "mfa") return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ user: Me }>("/auth/mfa/verify", { method: "POST", body: { mfa_token: step.token, trust_device: trust, ...body } });
      finish(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const useKey = async () => {
    if (step.kind !== "mfa") return;
    setBusy(true);
    setError(null);
    try {
      const { options, challenge_token } = await api<{ options: any; challenge_token: string }>("/auth/mfa/webauthn/options", { method: "POST", body: { mfa_token: step.token } });
      const credential = await webauthnAuthenticate(options);
      setBusy(false);
      await verify({ webauthn: credential, webauthn_challenge_token: challenge_token });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (step.kind === "mfa") {
    return (
      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-brand-800">Vérification en deux étapes</h1>
            <p className="text-sm text-muted">Confirmez votre identité pour accéder à votre espace.</p>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          {step.mode === "totp" ? (
            <Field label="Code de l'application d'authentification">
              <CodeInput value={code} onChange={setCode} autoFocus />
            </Field>
          ) : (
            <Field label="Code de secours">
              <Input value={recovery} onChange={(e) => setRecovery(e.target.value)} autoFocus autoComplete="off" placeholder="xxxx-xxxx" />
            </Field>
          )}
          <Checkbox label="Faire confiance à cet appareil pendant 30 jours" checked={trust} onChange={setTrust} />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button
            className="w-full"
            size="lg"
            loading={busy}
            disabled={step.mode === "totp" ? code.length !== 6 : recovery.trim().length < 6}
            onClick={() => verify(step.mode === "totp" ? { code } : { recovery_code: recovery.trim() })}
          >
            Vérifier
          </Button>
          {step.methods.includes("webauthn") && webauthnSupported() ? (
            <Button variant="secondary" className="w-full" onClick={useKey} disabled={busy}>
              <Fingerprint className="h-4 w-4" /> Utiliser ma clé de sécurité
            </Button>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 text-sm text-brand-600 hover:underline"
            onClick={() => setStep({ ...step, mode: step.mode === "totp" ? "recovery" : "totp" })}
          >
            <KeyRound className="h-4 w-4" />
            {step.mode === "totp" ? "Utiliser un code de secours" : "Utiliser le code de l'application"}
          </button>
          <button type="button" className="w-full text-sm text-muted hover:text-ink" onClick={() => setStep({ kind: "credentials" })}>
            Retour
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-brand-800">Connexion</h1>
      <p className="mt-1 text-sm text-muted">Espace client, ERP ou extranet partenaire.</p>
      <form onSubmit={submitCredentials} className="mt-6 space-y-4" noValidate>
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <Field label="Adresse e-mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Mot de passe" htmlFor="password">
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <div className="flex items-center justify-between gap-2">
          <Checkbox label="Rester connecté" checked={remember} onChange={setRemember} />
          <Link href="/mot-de-passe-oublie" className="text-sm text-brand-600 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email || !password}>
          Se connecter
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Accès sur invitation : votre lien d'activation vous est envoyé par e-mail ou WhatsApp par votre interlocuteur GLOBUS.{" "}
        <Link href="/activation" className="font-medium text-brand-600 hover:underline">
          En savoir plus
        </Link>
      </p>
    </Card>
  );
}
