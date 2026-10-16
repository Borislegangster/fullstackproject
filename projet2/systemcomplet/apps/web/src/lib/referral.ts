/** Code ambassadeur (I6) mémorisé sur l'appareil du visiteur pendant la durée d'attribution, joint aux demandes. */
const KEY = "globus_referral";

export function storeReferral(code: string, days: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: code.toUpperCase(), until: Date.now() + days * 86_400_000 }));
  } catch {
    /* stockage indisponible (navigation privée) : pas d'attribution */
  }
}

export function readReferral(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { code?: string; until?: number };
    if (!data.code || !data.until || data.until < Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return /^[A-Z0-9]{4,20}$/.test(data.code) ? data.code : null;
  } catch {
    return null;
  }
}
