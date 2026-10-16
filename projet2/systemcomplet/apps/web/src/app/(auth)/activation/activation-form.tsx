"use client";

import clsx from "clsx";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Field, Input } from "@/components/ui/form";
import { PasswordStrength, passwordIssues } from "@/components/ui/password-strength";
import { Alert, Button, Card, Skeleton } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import { accountPathFor, homeFor, type Me } from "@/lib/auth";
import { date } from "@/lib/format";

interface InvitationInfo {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  roles: string[];
  expires_at: string;
}

const STEPS = [
  { icon: KeyRound, label: "Mot de passe" },
  { icon: ShieldCheck, label: "Double authentification" },
  { icon: Sparkles, label: "Votre espace" },
];

/** Activation d'un accès créé par GLOBUS (aucune inscription libre) : lien personnel à usage unique reçu par
 * e-mail ou WhatsApp → choix du mot de passe → double authentification (obligatoire pour les clients). */
export function ActivationForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("invitation");
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<InvitationInfo>(`/auth/invitations/${encodeURIComponent(token)}`)
      .then((info) => {
        setInvitation(info);
        setForm((f) => ({ ...f, first_name: info.first_name ?? "", last_name: info.last_name ?? "" }));
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [token]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const issues = passwordIssues(form.password);
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || issues.length || mismatch) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ user: Me }>("/auth/invitations/accept", {
        method: "POST",
        body: { token, password: form.password, first_name: form.first_name || null, last_name: form.last_name || null, phone: form.phone || null },
      });
      const user = res.user;
      router.replace(user.mfa_required && !user.mfa_enabled ? `${accountPathFor(user)}?mfa=obligatoire` : homeFor(user));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (!token)
    return (
      <Card className="p-8">
        <h1 className="text-2xl font-bold text-brand-800">Accès sur invitation</h1>
        <p className="mt-3 text-sm text-muted">
          Les comptes GLOBUS sont ouverts par nos équipes : votre lien d'activation personnel vous est envoyé par e-mail ou WhatsApp dès la signature de votre contrat ou l'ouverture de votre accès partenaire.
        </p>
        <Link href="/connexion" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:underline">
          J'ai déjà activé mon accès : me connecter
        </Link>
      </Card>
    );
  if (loadError)
    return (
      <Card className="p-8">
        <Alert tone="danger" title="Lien d'activation indisponible">
          {loadError}
        </Alert>
        <p className="mt-4 text-sm text-muted">Ce lien a peut-être déjà été utilisé ou a expiré : demandez un nouvel envoi à votre interlocuteur GLOBUS.</p>
      </Card>
    );
  if (!invitation) return <Skeleton className="h-[30rem] w-full" />;

  return (
    <Card className="p-6 sm:p-8">
      <ol className="mb-6 flex items-center gap-2" aria-label="Étapes d'activation">
        {STEPS.map((step, i) => (
          <li key={step.label} className="flex flex-1 items-center gap-2">
            <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", i === 0 ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/30" : "bg-slate-100 text-muted")}>
              <step.icon className="h-4 w-4" />
            </span>
            <span className={clsx("hidden text-xs font-medium sm:block", i === 0 ? "text-ink" : "text-muted")}>{step.label}</span>
            {i < STEPS.length - 1 ? <span className="h-px flex-1 bg-line" /> : null}
          </li>
        ))}
      </ol>
      <h1 className="text-2xl font-bold text-brand-800">Activer votre accès</h1>
      <p className="mt-1 text-sm text-muted">
        Identifiant : <strong className="text-ink">{invitation.email}</strong> · lien valable jusqu'au {date(invitation.expires_at)}.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom">
            <Input value={form.first_name} onChange={set("first_name")} autoComplete="given-name" />
          </Field>
          <Field label="Nom">
            <Input value={form.last_name} onChange={set("last_name")} autoComplete="family-name" />
          </Field>
        </div>
        <Field label="Téléphone (WhatsApp)">
          <Input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
        </Field>
        <Field label="Choisissez votre mot de passe" required>
          <Input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" required />
          <PasswordStrength password={form.password} />
        </Field>
        <Field label="Confirmez le mot de passe" required error={mismatch ? "Les mots de passe ne correspondent pas" : null}>
          <Input type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required />
        </Field>
        <Alert tone="info">À l'étape suivante, vous activerez la double authentification (application d'authentification ou clé de sécurité) : elle protège vos documents, paiements et décisions.</Alert>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!!issues.length || mismatch || !form.confirm}>
          Activer et continuer
        </Button>
      </form>
    </Card>
  );
}
