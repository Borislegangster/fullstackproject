"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useEffect, useState } from "react";

import { CONSENT_EVENT, readConsent, type ConsentState } from "@/lib/consent";
import type { SitePayload } from "@/lib/cms-types";
import { initTracker, track, trackPage } from "@/lib/tracker";

function injectScript(id: string, src: string | null, inline?: string): void {
  if (document.getElementById(id)) return;
  const el = document.createElement("script");
  el.id = id;
  if (src) {
    el.src = src;
    el.async = true;
  }
  if (inline) el.text = inline;
  document.head.appendChild(el);
}

const SAFE_ID = /^[A-Za-z0-9_-]{3,40}$/;

/** Balises tierces (GA4, Google Ads, Meta, TikTok, LinkedIn) chargées uniquement après consentement. */
function loadTags(tracking: SitePayload["tracking"], consent: ConsentState) {
  const { ga4_id, gads_id, meta_pixel, tiktok_pixel, linkedin_partner } = tracking;
  if (consent.analytics && ga4_id && SAFE_ID.test(ga4_id)) {
    injectScript("gtag-src", `https://www.googletagmanager.com/gtag/js?id=${ga4_id}`);
    injectScript(
      "gtag-init",
      null,
      `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('consent','default',{ad_storage:'${consent.marketing ? "granted" : "denied"}',analytics_storage:'granted',ad_user_data:'${consent.marketing ? "granted" : "denied"}',ad_personalization:'${consent.marketing ? "granted" : "denied"}'});gtag('config','${ga4_id}',{anonymize_ip:true});${consent.marketing && gads_id && SAFE_ID.test(gads_id) ? `gtag('config','${gads_id}');` : ""}`,
    );
  }
  if (!consent.marketing) return;
  if (meta_pixel && SAFE_ID.test(meta_pixel))
    injectScript(
      "meta-pixel",
      null,
      `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta_pixel}');fbq('track','PageView');`,
    );
  if (tiktok_pixel && SAFE_ID.test(tiktok_pixel))
    injectScript(
      "tiktok-pixel",
      null,
      `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktok_pixel}');ttq.page();}(window,document,'ttq');`,
    );
  if (linkedin_partner && SAFE_ID.test(linkedin_partner))
    injectScript(
      "linkedin-insight",
      null,
      `window._linkedin_partner_id='${linkedin_partner}';window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(window._linkedin_partner_id);(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li/lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);`,
    );
}

export function SiteTracking({ tracking, policyVersion }: { tracking: SitePayload["tracking"]; policyVersion: string }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    initTracker();
    setConsent(readConsent(policyVersion));
    const onConsent = (e: Event) => setConsent((e as CustomEvent<ConsentState>).detail);
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, [policyVersion]);

  useEffect(() => {
    if (consent) loadTags(tracking, consent);
  }, [consent, tracking]);

  useEffect(() => {
    if (!pathname) return;
    const stop = trackPage(pathname);
    const w = window as unknown as { gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void };
    w.gtag?.("event", "page_view", { page_path: pathname });
    return stop;
  }, [pathname]);

  useReportWebVitals((metric) => {
    if (["LCP", "CLS", "INP", "FCP", "TTFB"].includes(metric.name)) {
      track({ type: "web_vital", target: metric.name, value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value) });
    }
  });

  return null;
}
