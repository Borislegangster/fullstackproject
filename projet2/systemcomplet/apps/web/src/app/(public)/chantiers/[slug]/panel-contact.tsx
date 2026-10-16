"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useState } from "react";

import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Button } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";

const KINDS: Record<string, { label: string; placeholder: string }> = {
  info: { label: "Une question sur le chantier", placeholder: "Votre question…" },
  riverain: { label: "Je suis riverain (gêne, sécurité, accès)", placeholder: "Décrivez la gêne constatée : poussière, bruit, stationnement…" },
  devis: { label: "Je veux un projet similaire", placeholder: "Décrivez votre projet : terrain, surface, délai…" },
  candidature: { label: "Je postule pour travailler sur le chantier", placeholder: "Votre métier, votre expérience, votre disponibilité…" },
};

/** Contact depuis la page du chantier : riverains, prospects, candidats (anti-robot, consentement explicite). */
export function PanelContact({ slug, kinds }: { slug: string; kinds: string[] }) {
  const [renderedAt] = useState(() => Math.floor(Date.now() / 1000));
  const [kind, setKind] = useState(kinds[0] ?? "info");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (done) {
    return (
      <div className="rounded-[1.75rem] bg-white p-6 text-center shadow-[var(--shadow-card)] ring-1 ring-line">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <p className="mt-3 font-semibold text-ink">{done}</p>
      </div>
    );
  }
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ message: string }>(`/public/chantiers/${encodeURIComponent(slug)}/messages`, {
        body: { kind, name, phone: phone || null, email: email || null, message, consent, rendered_at: renderedAt, website: honeypot || null },
      });
      setDone(res.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4 rounded-[1.75rem] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line">
      <p className="font-title text-xl font-bold text-brand-900">Écrire à l&apos;équipe du chantier</p>
      <Field label="Objet">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} options={kinds.map((k) => ({ value: k, label: KINDS[k]?.label ?? k }))} />
      </Field>
      <Field label="Nom" required>
        <Input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Field label="Téléphone">
          <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="E-mail">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      <Field label="Message" required help="10 caractères minimum">
        <Textarea rows={4} value={message} maxLength={4000} placeholder={KINDS[kind]?.placeholder} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} name="website" />
      <Checkbox checked={consent} onChange={setConsent} label="J'accepte que GLOBUS ENGINEERING traite ce message pour me répondre." />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button className="w-full" loading={busy} disabled={!consent || name.trim().length < 2 || message.trim().length < 10 || (!phone && !email)} onClick={() => void send()}>
        <Send className="h-4 w-4" /> Envoyer
      </Button>
    </div>
  );
}
