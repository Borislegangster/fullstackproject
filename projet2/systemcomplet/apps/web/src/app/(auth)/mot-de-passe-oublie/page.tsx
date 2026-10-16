"use client";

import Link from "next/link";
import { useState } from "react";

import { Field, Input } from "@/components/ui/form";
import { Alert, Button, Card } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-brand-800">Mot de passe oublié</h1>
      <p className="mt-1 text-sm text-muted">Saisissez votre e-mail : si un compte existe, vous recevrez un lien de réinitialisation valable une heure.</p>
      {sent ? (
        <div className="mt-6">
          <Alert tone="success">Si un compte correspond à cette adresse, un e-mail vient de vous être envoyé.</Alert>
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api("/auth/password/forgot", { method: "POST", body: { email: email.trim() } });
              setSent(true);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Adresse e-mail">
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email}>
            Envoyer le lien
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/connexion" className="text-brand-600 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </Card>
  );
}
