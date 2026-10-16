/** Consentement cookies (RGPD / loi camerounaise 2010-012) : stockage local, version de politique, diffusion. */

export interface ConsentState {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  version: string;
  at: string;
}

const KEY = "globus_consent";
export const CONSENT_EVENT = "globus:consent";

export function readConsent(policyVersion?: string): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (policyVersion && parsed.version !== policyVersion) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(choice: { analytics: boolean; marketing: boolean }, policyVersion = "1"): ConsentState {
  const state: ConsentState = { necessary: true, analytics: choice.analytics, marketing: choice.marketing, version: policyVersion, at: new Date().toISOString() };
  window.localStorage.setItem(KEY, JSON.stringify(state));
  if (!choice.analytics) window.localStorage.removeItem("globus_vid");
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
  return state;
}

export function openConsentManager(): void {
  window.dispatchEvent(new CustomEvent("globus:consent-open"));
}
