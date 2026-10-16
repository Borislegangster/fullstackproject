"use client";

import clsx from "clsx";
import { useState } from "react";

import { api, errorMessage } from "@/lib/api";
import { track } from "@/lib/tracker";

export function NewsletterForm({ dark, source = "website" }: { dark?: boolean; source?: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setState("error");
      setMessage("Merci de cocher la case de consentement.");
      return;
    }
    setState("busy");
    try {
      const res = await api<{ message?: string; status?: string }>("/public/newsletter/subscribe", { method: "POST", body: { email, consent: true, source } });
      setState("done");
      setMessage(res?.message ?? "Vérifiez votre boîte e-mail pour confirmer l'inscription.");
      track({ type: "newsletter_subscribe", target: source });
    } catch (err) {
      setState("error");
      setMessage(errorMessage(err));
    }
  };

  if (state === "done") return <p className={clsx("text-sm", dark ? "text-white" : "text-emerald-700")}>{message}</p>;

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      {/* Champ et bouton côte à côte s'il y a la place (≥ 15rem pour le champ), sinon bouton en dessous, pleine largeur. */}
      <div className="flex flex-wrap gap-2">
        <label htmlFor={`nl-${source}`} className="sr-only">
          Adresse e-mail
        </label>
        <input
          id={`nl-${source}`}
          type="email"
          required
          size={1}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre e-mail"
          className={clsx(
            "min-w-0 flex-[1_1_15rem] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2",
            dark ? "bg-white/10 text-white placeholder:text-brand-200 focus:ring-accent-400" : "border border-line bg-white focus:ring-brand-200",
          )}
        />
        <button type="submit" disabled={state === "busy"} className="flex-[1_0_auto] rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-60">
          {state === "busy" ? "…" : "S'inscrire"}
        </button>
      </div>
      <label className={clsx("flex items-start gap-2 text-xs", dark ? "text-brand-200" : "text-muted")}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        J'accepte de recevoir la newsletter et je peux me désinscrire en un clic.
      </label>
      {state === "error" && message ? <p className={clsx("text-xs", dark ? "text-accent-200" : "text-red-600")}>{message}</p> : null}
    </form>
  );
}
