"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { Banner } from "@/lib/cms-types";

import { MediaImage } from "./media";

function storageKey(b: Banner) {
  return `globus_banner_${b.key}`;
}

function alreadySeen(b: Banner): boolean {
  if (b.frequency === "always") return false;
  const store = b.frequency === "session" ? sessionStorage : localStorage;
  return store.getItem(storageKey(b)) === "1";
}

function markSeen(b: Banner) {
  if (b.frequency === "always") return;
  const store = b.frequency === "session" ? sessionStorage : localStorage;
  store.setItem(storageKey(b), "1");
}

/** Bannières et popups administrés depuis le CMS (ciblage par page, fréquence, délai). */
export function SiteBanners({ banners, pages }: { banners: Banner[]; pages: Record<string, string> }) {
  const pathname = usePathname() ?? "/";
  const routeKey = useMemo(() => Object.entries(pages).find(([, path]) => path === pathname)?.[0], [pages, pathname]);
  const [visible, setVisible] = useState<string[]>([]);

  useEffect(() => {
    const eligible = banners.filter((b) => (!b.route_keys?.length || (routeKey && b.route_keys.includes(routeKey))) && !alreadySeen(b));
    setVisible([]);
    const timers = eligible.map((b) =>
      setTimeout(() => {
        setVisible((v) => (v.includes(b.key) ? v : [...v, b.key]));
        markSeen(b);
      }, Math.max(0, (b.delay_seconds ?? 0) * 1000)),
    );
    return () => timers.forEach(clearTimeout);
  }, [banners, routeKey]);

  const close = (key: string) => setVisible((v) => v.filter((k) => k !== key));
  const shown = banners.filter((b) => visible.includes(b.key));
  if (!shown.length) return null;

  return (
    <>
      {shown.map((b) => {
        const cta = b.cta_label && b.cta_href ? (
          /^https?:/.test(b.cta_href) ? (
            <a href={b.cta_href} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600" data-track={`banner:${b.key}`}>
              {b.cta_label}
            </a>
          ) : (
            <Link href={b.cta_href} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600" data-track={`banner:${b.key}`} onClick={() => close(b.key)}>
              {b.cta_label}
            </Link>
          )
        ) : null;
        if (b.kind === "popup" || b.position === "center")
          return (
            <div key={b.key} className="fixed inset-0 z-[65] flex items-center justify-center bg-brand-900/50 p-4" role="dialog" aria-modal="true" aria-label={b.title ?? "Information"}>
              <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                {b.media ? <MediaImage media={b.media} className="aspect-[16/9] w-full" sizes="512px" /> : null}
                <div className="p-6">
                  {b.title ? <h2 className="text-xl font-bold text-brand-800">{b.title}</h2> : null}
                  {b.content ? <p className="mt-2 text-sm text-muted">{b.content}</p> : null}
                  {cta ? <div className="mt-5">{cta}</div> : null}
                </div>
                {b.dismissible !== false ? (
                  <button type="button" onClick={() => close(b.key)} className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 shadow" aria-label="Fermer">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        return (
          <div key={b.key} className={`fixed inset-x-0 z-[55] ${b.position === "bottom" ? "bottom-0" : "top-0"} bg-brand-700 text-white shadow-lg`} role="region" aria-label={b.title ?? "Annonce"}>
            <div className="container-page flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
              <p>
                {b.title ? <strong className="mr-2">{b.title}</strong> : null}
                {b.content}
              </p>
              <div className="flex items-center gap-2">
                {cta}
                {b.dismissible !== false ? (
                  <button type="button" onClick={() => close(b.key)} className="rounded p-1 hover:bg-white/10" aria-label="Fermer">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
