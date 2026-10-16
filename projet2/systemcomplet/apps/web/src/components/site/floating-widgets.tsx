"use client";

import clsx from "clsx";
import { ArrowUp, Loader2, Phone, Send, Sparkles, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { api, ApiError, errorMessage } from "@/lib/api";
import type { SiteContacts } from "@/lib/cms-types";
import { track } from "@/lib/tracker";

type Action = { type: "link"; label: string; href: string } | { type: "lead_form"; label: string };
interface Message {
  role: "user" | "assistant";
  content: string;
  actions?: Action[];
  suggestions?: string[];
  error?: boolean;
}
interface Welcome {
  greeting: string;
  suggestions: string[];
  ai: boolean;
}
interface Reply {
  conversation_id: string;
  mode: string;
  reply: string;
  suggestions: string[];
  actions: Action[];
}

const STORE = "globus:assistant";
const TEASER = "globus:assistant-teaser";

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41Z" />
    </svg>
  );
}

function Typing() {
  return (
    <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-md bg-white px-4 py-3 shadow-sm ring-1 ring-line" aria-label="L'assistant écrit…">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${i * 140}ms` }} />
      ))}
    </div>
  );
}

function LeadForm({ conversationId, need, privacyPath, onDone }: { conversationId: string; need: string; privacyPath?: string; onDone: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const phone = String(f.get("phone") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    if (!phone && !email) {
      setError("Indiquez un téléphone ou un e-mail pour être recontacté(e).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const firstName = String(f.get("first_name") ?? "").trim();
      const res = await api<{ lead_number: string }>("/public/assistant/lead", {
        method: "POST",
        body: { conversation_id: conversationId, first_name: firstName, phone: phone || null, email: email || null, need: String(f.get("need") ?? "") || null, consent: f.get("consent") === "on" },
      });
      track({ type: "lead", target: "assistant", props: { lead: res.lead_number } });
      onDone(`Merci ${firstName} ! Votre demande ${res.lead_number} est bien enregistrée : un conseiller vous recontacte très rapidement.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const input = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-2xl bg-brand-50/70 p-3 ring-1 ring-brand-100">
      <input name="first_name" required minLength={2} placeholder="Votre prénom" className={input} autoComplete="given-name" />
      <div className="grid grid-cols-2 gap-2">
        <input name="phone" type="tel" placeholder="Téléphone" className={input} autoComplete="tel" />
        <input name="email" type="email" placeholder="E-mail" className={input} autoComplete="email" />
      </div>
      <textarea name="need" rows={2} defaultValue={need} placeholder="Votre besoin en quelques mots" className={clsx(input, "resize-none")} />
      <label className="flex items-start gap-2 text-[11px] leading-snug text-muted">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-[var(--color-accent-500)]" />
        <span>
          J&apos;accepte d&apos;être recontacté(e) au sujet de ma demande.{" "}
          {privacyPath ? (
            <Link href={privacyPath} className="underline">
              Confidentialité
            </Link>
          ) : null}
        </span>
      </label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <button type="submit" disabled={busy} className="btn-glow w-full !rounded-xl !py-2.5 text-sm disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Être rappelé
      </button>
    </form>
  );
}

/** Widgets flottants de la vitrine : assistant conversationnel (CMS + IA), WhatsApp, appel, retour en haut. */
export function FloatingWidgets({ contacts, privacyPath, iconUrl }: { contacts?: SiteContacts; privacyPath?: string; iconUrl?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [welcome, setWelcome] = useState<Welcome | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [leadFor, setLeadFor] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [progress, setProgress] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const whatsapp = contacts?.whatsapp?.replace(/\D/g, "");
  const phone = contacts?.phone?.replace(/\s/g, "");

  // Conversation conservée pendant la navigation (session de l'onglet)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null");
      if (saved?.messages) {
        setMessages(saved.messages);
        setConversationId(saved.conversationId ?? null);
      }
    } catch {
      /* stockage indisponible */
    }
    const timer = setTimeout(() => {
      if (!localStorage.getItem(TEASER)) setTeaser(true);
    }, 9000);
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? h.scrollTop / max : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const openFromCta = () => setOpen(true);
    window.addEventListener("globus:assistant-open", openFromCta);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("globus:assistant-open", openFromCta);
    };
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ conversationId, messages: messages.slice(-40) }));
    } catch {
      /* stockage indisponible */
    }
  }, [messages, conversationId]);
  useEffect(() => {
    if (!open) return;
    setMounted(true);
    setTeaser(false);
    localStorage.setItem(TEASER, "1");
    if (!welcome) {
      api<Welcome>("/public/assistant")
        .then(setWelcome)
        .catch(() => setWelcome({ greeting: "Bonjour ! Posez-moi votre question, je vous oriente immédiatement.", suggestions: [], ai: false }));
    }
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, welcome]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, leadFor, welcome]);

  const send = useCallback(
    async (content: string) => {
      const message = content.trim();
      if (!message || busy) return;
      setText("");
      setLeadFor(null);
      setMessages((m) => [...m, { role: "user", content: message }]);
      setBusy(true);
      if (!conversationId) track({ type: "cta_click", target: "assistant-first-message" });
      try {
        const res = await api<Reply>("/public/assistant/messages", { method: "POST", body: { conversation_id: conversationId, message, page_path: pathname } });
        setConversationId(res.conversation_id);
        setMessages((m) => [...m, { role: "assistant", content: res.reply, actions: res.actions, suggestions: res.suggestions }]);
      } catch (err) {
        const tooMany = err instanceof ApiError && (err.status === 429 || err.code === "TOO_LONG");
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            error: true,
            content: tooMany ? "Je préfère vous passer un conseiller pour la suite : laissez-nous vos coordonnées ou écrivez-nous sur WhatsApp." : errorMessage(err),
            actions: conversationId ? [{ type: "lead_form", label: "Être rappelé" }] : [],
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, conversationId, pathname],
  );

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const suggestions = messages.length ? (lastAssistant?.suggestions ?? []) : (welcome?.suggestions ?? []);
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const ring = 2 * Math.PI * 22;

  return (
    <div className="no-print">
      {/* Retour en haut avec anneau de progression de lecture */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={clsx(
          "fixed bottom-6 left-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-night-900/90 text-white shadow-xl backdrop-blur transition duration-500 hover:-translate-y-1",
          progress > 0.08 ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
        )}
        aria-label="Revenir en haut de la page"
      >
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="22" fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="2.5" />
          <circle cx="24" cy="24" r="22" fill="none" stroke="var(--color-accent-500)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - progress)} />
        </svg>
        <ArrowUp className="h-5 w-5" />
      </button>

      {/* Panneau de conversation */}
      {mounted ? (
        <section
          role="dialog"
          aria-label="Assistant en ligne GLOBUS"
          aria-hidden={!open}
          className={clsx(
            "fixed bottom-24 right-3 z-50 flex h-[min(40rem,calc(100svh-8rem))] w-[min(25rem,calc(100vw-1.5rem))] origin-bottom-right flex-col overflow-hidden rounded-[1.75rem] bg-surface shadow-[0_30px_80px_-20px_rgb(5_11_26_/_0.55)] ring-1 ring-black/5 transition duration-300 sm:right-6",
            open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-6 scale-95 opacity-0",
          )}
        >
          <header className="relative overflow-hidden bg-night px-5 pb-5 pt-4 text-white">
            <div className="absolute inset-0 bg-blueprint opacity-40" />
            <div className="aurora-blob -right-10 -top-16 h-40 w-40 bg-accent-500/40" />
            <div className="relative flex items-center gap-3">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white p-1.5 shadow-lg">
                {iconUrl ? <img src={iconUrl} alt="" className="h-full w-full object-contain" /> : <Sparkles className="h-5 w-5 text-brand-600" />}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-night-900" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-title text-base font-bold">Assistant GLOBUS</p>
                <p className="truncate text-xs text-brand-100">{welcome?.ai ? "IA · réponses sourcées sur nos contenus" : "En ligne · réponse immédiate"}</p>
              </div>
              {whatsapp ? (
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/10 p-2 transition hover:bg-[#25D366]" aria-label="Continuer sur WhatsApp" data-track="assistant-whatsapp">
                  <WhatsAppIcon className="h-4 w-4" />
                </a>
              ) : null}
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white/10 p-2 transition hover:bg-white/20" aria-label="Fermer l'assistant">
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {welcome ? (
              <div className="fade-up max-w-[88%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm leading-relaxed text-ink shadow-sm ring-1 ring-line">{welcome.greeting}</div>
            ) : (
              <Typing />
            )}
            {messages.map((m, i) => (
              <div key={i} className={clsx("fade-up flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={clsx(
                    "max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                    m.role === "user" ? "rounded-tr-md bg-gradient-to-br from-brand-500 to-brand-700 text-white" : clsx("rounded-tl-md bg-white text-ink ring-1", m.error ? "ring-accent-200" : "ring-line"),
                  )}
                >
                  {m.content}
                </div>
                {m.actions?.length ? (
                  <div className="mt-2 flex max-w-[88%] flex-wrap gap-2">
                    {m.actions.map((a) =>
                      a.type === "link" ? (
                        /^https?:/.test(a.href) ? (
                          <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#25D366] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm">
                            {a.label}
                          </a>
                        ) : (
                          <Link key={a.label} href={a.href} onClick={() => setOpen(false)} className="rounded-full bg-accent-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-600">
                            {a.label} →
                          </Link>
                        )
                      ) : (
                        <button key={a.label} type="button" onClick={() => setLeadFor(i)} className="rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700">
                          <UserRound className="mr-1 inline h-3.5 w-3.5" />
                          {a.label}
                        </button>
                      ),
                    )}
                  </div>
                ) : null}
                {leadFor === i && conversationId ? (
                  <div className="w-full">
                    <LeadForm
                      conversationId={conversationId}
                      need={lastUser}
                      privacyPath={privacyPath}
                      onDone={(content) => {
                        setLeadFor(null);
                        setMessages((ms) => [...ms, { role: "assistant", content }]);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? <Typing /> : null}
          </div>

          {suggestions.length && !busy ? (
            <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-brand-700 shadow-sm ring-1 ring-brand-100 transition hover:bg-brand-50 hover:ring-brand-300">
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
            className="flex items-center gap-2 border-t border-line bg-white px-3 py-3"
          >
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder="Écrivez votre question…"
              className="min-w-0 flex-1 rounded-full bg-surface px-4 py-2.5 text-sm outline-none ring-1 ring-line transition focus:ring-2 focus:ring-brand-300"
              aria-label="Votre message"
            />
            <button type="submit" disabled={!text.trim() || busy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-md transition hover:scale-105 disabled:opacity-40" aria-label="Envoyer">
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="bg-white px-4 pb-2 text-center text-[10px] text-muted">Ne partagez aucune donnée sensible (mot de passe, coordonnées bancaires).</p>
        </section>
      ) : null}

      {/* Accroche (une fois) */}
      {teaser && !open ? (
        <div className="fade-up fixed bottom-[5.6rem] right-5 z-40 w-64 rounded-2xl rounded-br-md bg-white p-4 pr-8 text-sm text-ink shadow-2xl ring-1 ring-line sm:right-7">
          <button type="button" onClick={() => (setTeaser(false), localStorage.setItem(TEASER, "1"))} className="absolute right-2 top-2 rounded-full p-1 text-muted hover:bg-surface" aria-label="Masquer">
            <X className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="text-left" onClick={() => setOpen(true)}>
            <span className="font-semibold text-brand-800">Un projet en tête ?</span> Posez votre question, je vous réponds tout de suite.
          </button>
        </div>
      ) : null}

      {/* Dock */}
      <div className="fixed bottom-5 right-4 z-50 flex flex-col items-center gap-3 sm:right-6">
        {phone && !open ? (
          <a href={`tel:${phone}`} className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-700 shadow-xl ring-1 ring-line transition hover:-translate-y-0.5 md:hidden" aria-label="Appeler GLOBUS" data-track="call-float">
            <Phone className="h-5 w-5" />
          </a>
        ) : null}
        {whatsapp && !open ? (
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-6px_rgb(37_211_102_/_0.7)]" aria-label="Discuter sur WhatsApp" data-track="whatsapp-float">
            <WhatsAppIcon className="h-6 w-6" />
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            if (!open) track({ type: "cta_click", target: "assistant-open" });
          }}
          className="group relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_18px_40px_-10px_rgb(56_90_166_/_0.8)] transition hover:scale-105"
          aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant en ligne"}
          aria-expanded={open}
        >
          {!open ? <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-400" /> : null}
          <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_var(--angle),var(--color-brand-400),var(--color-accent-500),var(--color-brand-700),var(--color-brand-400))] [animation:border-spin_5s_linear_infinite]" />
          <span className="absolute inset-[3px] rounded-full bg-white" />
          {/* Icône unique de la plateforme (réglage CMS), comme l'onglet du navigateur et l'application installée. */}
          {open ? (
            <X className="relative h-6 w-6 text-brand-700" />
          ) : iconUrl ? (
            <img src={iconUrl} alt="" className="relative h-10 w-10 object-contain transition group-hover:scale-110" />
          ) : (
            <Sparkles className="relative h-7 w-7 text-brand-700 transition group-hover:rotate-12" />
          )}
          {teaser && !open ? <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold ring-2 ring-white">1</span> : null}
        </button>
      </div>
    </div>
  );
}
