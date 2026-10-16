/** Collecte analytique propriétaire (§23) : sessions, pages vues, CTA, défilement, temps de lecture, Web Vitals. */

import { readConsent } from "./consent";

interface TrackEvent {
  type: string;
  path?: string;
  title?: string;
  target?: string;
  value?: number;
  content_type?: string;
  content_id?: string;
  props?: Record<string, string | number | boolean>;
}

const queue: TrackEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sessionId(): string {
  let sid = sessionStorage.getItem("globus_sid");
  if (!sid) {
    sid = randomId();
    sessionStorage.setItem("globus_sid", sid);
    sessionStorage.setItem("globus_landing", location.pathname + location.search);
    sessionStorage.setItem("globus_referrer", document.referrer || "");
  }
  return sid;
}

function visitorId(consent: boolean): { id: string | null; isNew: boolean } {
  if (!consent) return { id: null, isNew: !sessionStorage.getItem("globus_seen") };
  let vid = localStorage.getItem("globus_vid");
  const isNew = !vid;
  if (!vid) {
    vid = randomId();
    localStorage.setItem("globus_vid", vid);
  }
  return { id: vid, isNew };
}

export function utmParams(): Record<string, string> {
  const stored = sessionStorage.getItem("globus_utm");
  if (stored) return JSON.parse(stored) as Record<string, string>;
  const params = new URLSearchParams(location.search);
  const utm: Record<string, string> = {};
  ["source", "medium", "campaign", "content", "term"].forEach((k) => {
    const v = params.get(`utm_${k}`);
    if (v) utm[k] = v.slice(0, 120);
  });
  if (params.get("gclid")) utm.medium = utm.medium ?? "cpc";
  if (params.get("fbclid")) utm.source = utm.source ?? "facebook";
  sessionStorage.setItem("globus_utm", JSON.stringify(utm));
  return utm;
}

async function flush(useBeacon = false): Promise<void> {
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  const consent = readConsent();
  const analytics = !!consent?.analytics;
  const visitor = visitorId(analytics);
  const body = JSON.stringify({
    session_id: sessionId(),
    visitor_id: visitor.id,
    consent: analytics,
    referrer: sessionStorage.getItem("globus_referrer") || null,
    landing: sessionStorage.getItem("globus_landing") || null,
    language: navigator.language?.slice(0, 10),
    utm: utmParams(),
    is_new: visitor.isNew,
    events,
  });
  sessionStorage.setItem("globus_seen", "1");
  const url = "/api/v1/public/analytics/collect";
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Client-App": "web" }, body, keepalive: true });
    }
  } catch {
    /* collecte best-effort */
  }
  if (queue.length) void flush(useBeacon);
}

export function track(event: TrackEvent): void {
  if (typeof window === "undefined") return;
  if (navigator.doNotTrack === "1" && !readConsent()?.analytics) return;
  queue.push({ path: location.pathname, ...event });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), queue.length >= 10 ? 0 : 3000);
}

export function initTracker(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  sessionId();
  utmParams();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush(true);
  });
  window.addEventListener("pagehide", () => void flush(true));
  window.addEventListener("error", (e) => track({ type: "js_error", target: String(e.message).slice(0, 200) }));
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest("a,button") as HTMLAnchorElement | HTMLButtonElement | null;
      if (!el) return;
      const explicit = el.getAttribute("data-track");
      const href = el instanceof HTMLAnchorElement ? el.href : "";
      const social = el.getAttribute("data-social");
      if (social) track({ type: "social_click", target: social, props: { location: el.getAttribute("data-location") ?? "site" } });
      if (href.startsWith("tel:")) track({ type: "phone_click", target: href.slice(4) });
      else if (/wa\.me|whatsapp\.com/.test(href)) track({ type: "whatsapp_click", target: "whatsapp" });
      else if (href.startsWith("mailto:")) track({ type: "email_click", target: "email" });
      if (explicit || /\/decrire-mon-projet/.test(href)) track({ type: "cta_click", target: explicit || "decrire-mon-projet" });
    },
    { capture: true },
  );
}

/** Suivi d'une page : vue, profondeur de défilement et temps de lecture à la sortie. */
export function trackPage(path: string, extra?: Partial<TrackEvent>): () => void {
  track({ type: "page_view", path, title: document.title, ...extra });
  const started = Date.now();
  let maxScroll = 0;
  const onScroll = () => {
    const doc = document.documentElement;
    const height = doc.scrollHeight - doc.clientHeight;
    if (height > 0) maxScroll = Math.max(maxScroll, Math.round((doc.scrollTop / height) * 100));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.removeEventListener("scroll", onScroll);
    const seconds = Math.round((Date.now() - started) / 1000);
    if (seconds > 1) track({ type: "read_time", path, value: Math.min(seconds, 3600), content_type: extra?.content_type, content_id: extra?.content_id });
    track({ type: "scroll", path, value: maxScroll });
  };
}
