"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/form";
import { readConsent, writeConsent } from "@/lib/consent";

export function CookieBanner({ texts, policyVersion, cookiesPath }: { texts?: Record<string, string>; policyVersion: string; cookiesPath?: string }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const current = readConsent(policyVersion);
    if (!current) setOpen(true);
    else {
      setAnalytics(current.analytics);
      setMarketing(current.marketing);
    }
    const reopen = () => {
      const c = readConsent(policyVersion);
      setAnalytics(!!c?.analytics);
      setMarketing(!!c?.marketing);
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener("globus:consent-open", reopen);
    return () => window.removeEventListener("globus:consent-open", reopen);
  }, [policyVersion]);

  if (!open) return null;
  const save = (a: boolean, m: boolean) => {
    writeConsent({ analytics: a, marketing: m }, policyVersion);
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4" role="dialog" aria-modal="false" aria-labelledby="cookie-title">
      <div className="mx-auto max-w-4xl rounded-2xl border border-line bg-white p-5 shadow-2xl">
        <h2 id="cookie-title" className="text-base font-semibold text-ink">
          {texts?.title ?? "Vos choix en matière de cookies"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {texts?.banner ??
            "Nous utilisons des cookies nécessaires au fonctionnement du site et, avec votre accord, des cookies de mesure d'audience et publicitaires."}{" "}
          {cookiesPath ? (
            <Link href={cookiesPath} className="text-brand-600 underline">
              En savoir plus
            </Link>
          ) : null}
        </p>
        {details ? (
          <div className="mt-4 space-y-3 rounded-xl bg-surface p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Nécessaires</p>
                <p className="text-xs text-muted">{texts?.necessary ?? "Sécurité, session, préférences. Toujours actifs."}</p>
              </div>
              <Switch checked onChange={() => undefined} disabled />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Mesure d'audience</p>
                <p className="text-xs text-muted">{texts?.analytics ?? "Statistiques de visite pour améliorer le site (Google Analytics, mesure interne)."}</p>
              </div>
              <Switch checked={analytics} onChange={setAnalytics} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Marketing</p>
                <p className="text-xs text-muted">{texts?.marketing ?? "Mesure des campagnes et publicités personnalisées (Google Ads, Meta, TikTok, LinkedIn)."}</p>
              </div>
              <Switch checked={marketing} onChange={setMarketing} />
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {details ? (
            <Button variant="secondary" onClick={() => save(analytics, marketing)}>
              Enregistrer mes choix
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setDetails(true)}>
              Personnaliser
            </Button>
          )}
          <Button variant="secondary" onClick={() => save(false, false)}>
            Tout refuser
          </Button>
          <Button onClick={() => save(true, true)}>Tout accepter</Button>
        </div>
      </div>
    </div>
  );
}
