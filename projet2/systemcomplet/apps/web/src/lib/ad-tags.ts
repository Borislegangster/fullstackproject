/** Conversions envoyées aux régies (Google Ads, GA4, Meta, TikTok) quand un visiteur fait une demande.
 *
 * Chaque balise ne reçoit l'événement que si le visiteur a donné l'accord correspondant (marketing pour les régies,
 * mesure d'audience pour GA4) et qu'elle est chargée. Google Ads a besoin du libellé de conversion de l'action,
 * saisi dans Réglages du site. */

import { readConsent } from "./consent";

export type TagConfig = {
  ga4_id?: string;
  gads_id?: string;
  gads_labels?: Partial<Record<ConversionKind, string>>;
  meta_pixel?: string;
  tiktok_pixel?: string;
};

/** Actions comptées comme conversions par les régies. */
export type ConversionKind = "lead" | "whatsapp" | "phone" | "newsletter";

type Globals = {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  ttq?: { track?: (event: string, props?: Record<string, unknown>) => void };
};

/** Événement de la mesure propriétaire → conversion des régies (null : pas une conversion publicitaire). */
function kindOf(type: string, target?: string): ConversionKind | null {
  if (type === "form_submit") return target === "energy_simulator" ? null : "lead";
  if (type === "describe_project_submit" || type === "instant_estimate_submit" || type === "lead") return "lead";
  if (type === "newsletter_subscribe") return "newsletter";
  if (type === "whatsapp_click") return "whatsapp";
  if (type === "phone_click") return "phone";
  return null;
}

const META_EVENT: Record<ConversionKind, string> = { lead: "Lead", whatsapp: "Contact", phone: "Contact", newsletter: "Subscribe" };
const TIKTOK_EVENT: Record<ConversionKind, string> = { lead: "SubmitForm", whatsapp: "Contact", phone: "Contact", newsletter: "Subscribe" };
const GA4_EVENT: Record<ConversionKind, string> = { lead: "generate_lead", whatsapp: "contact", phone: "contact", newsletter: "sign_up" };

const SAFE = /^[A-Za-z0-9_-]{3,40}$/;
let config: TagConfig = {};

export function setTagConfig(tracking: TagConfig | null | undefined): void {
  config = tracking ?? {};
}

export function reportConversion(type: string, target?: string): void {
  if (typeof window === "undefined") return;
  const kind = kindOf(type, target);
  if (!kind) return;
  const consent = readConsent();
  if (!consent) return;
  const w = window as unknown as Globals;
  const detail = { conversion: kind, source: target ?? type };
  if (consent.analytics && config.ga4_id) w.gtag?.("event", GA4_EVENT[kind], detail);
  if (!consent.marketing) return;
  const label = config.gads_labels?.[kind];
  if (config.gads_id && label && SAFE.test(label)) w.gtag?.("event", "conversion", { send_to: `${config.gads_id}/${label}` });
  if (config.meta_pixel) w.fbq?.("track", META_EVENT[kind], { content_name: detail.source });
  if (config.tiktok_pixel) w.ttq?.track?.(TIKTOK_EVENT[kind], { content_name: detail.source });
}
