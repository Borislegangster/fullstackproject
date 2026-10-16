"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Field, Input } from "@/components/ui/form";
import { PasswordStrength, passwordIssues } from "@/components/ui/password-strength";
import { Alert, Button, Card } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = passwordIssues(password).length > 0 || password !== confirm;

  if (!token)
    return (
      <Card className="p-8">
        <Alert tone="danger">Lien de réinitialisation incomplet.</Alert>
      </Card>
    );

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-brand-800">Nouveau mot de passe</h1>
      {done ? (
        <div className="mt-6 space-y-4">
          <Alert tone="success">Votre mot de passe a été modifié. Toutes vos autres sessions ont été fermées.</Alert>
          <Link href="/connexion" className="block rounded-xl bg-brand-500 px-4 py-3 text-center font-semibold text-white hover:bg-brand-600">
            Se connecter
          </Link>
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api("/auth/password/reset", { method: "POST", body: { token, new_password: password } });
              setDone(true);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Nouveau mot de passe">
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
            <PasswordStrength password={password} />
          </Field>
          <Field label="Confirmer" error={confirm && confirm !== password ? "Les mots de passe ne correspondent pas" : null}>
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={invalid}>
            Enregistrer
          </Button>
        </form>
      )}
    </Card>
  );
}
