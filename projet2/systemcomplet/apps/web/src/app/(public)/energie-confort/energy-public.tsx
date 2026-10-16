"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useState } from "react";

import { EnergySimulator, type EnergyInputs } from "@/components/innovations/energy-simulator";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Alert, Button } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import { track } from "@/lib/tracker";

export function EnergyPublic() {
  const [renderedAt] = useState(() => Math.floor(Date.now() / 1000));
  const [inputs, setInputs] = useState<EnergyInputs | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const send = async () => {
    if (!inputs) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ reference?: string }>("/public/energy/lead", {
        body: { simulation: inputs, first_name: name, email: email || null, phone: phone || null, consent, rendered_at: renderedAt },
      });
      setDone(res.reference ?? "");
      track({ type: "form_submit", target: "energy_simulator" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
      <EnergySimulator onResult={(i) => setInputs(i)}>
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          {done !== null ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Merci ! Un ingénieur vous envoie l&apos;étude détaillée{done ? ` (réf. ${done})` : ""}.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="font-semibold text-ink">Recevoir l&apos;étude détaillée gratuite</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Prénom" required>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="E-mail">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Téléphone">
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
              </div>
              <Checkbox checked={consent} onChange={setConsent} label="J'accepte d'être recontacté(e) au sujet de mon projet." />
              {error ? <Alert tone="danger">{error}</Alert> : null}
              <Button loading={busy} disabled={!consent || !name.trim() || (!email && !phone) || !inputs} onClick={() => void send()}>
                <Send className="h-4 w-4" /> Recevoir l&apos;étude
              </Button>
            </div>
          )}
        </div>
      </EnergySimulator>
    </div>
  );
}
