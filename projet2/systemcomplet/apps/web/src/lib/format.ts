/** Formats français (Cameroun) : montants FCFA, dates, durées, tailles, libellés de statut. */

const moneyFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Africa/Douala",
});
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Douala",
});
const longDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Douala",
});

const NBSP = /[  ]/g;

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : 0;
}

export function money(value: unknown, currency = "FCFA"): string {
  if (value === null || value === undefined || value === "") return "—";
  return `${moneyFormatter.format(toNumber(value)).replace(NBSP, " ")} ${currency}`;
}

export function number(value: unknown, digits = 0): string {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(toNumber(value)).replace(NBSP, " ");
}

export function percent(value: unknown, digits = 0): string {
  if (value === null || value === undefined || value === "") return "—";
  return `${number(value, digits)} %`;
}

function parse(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function date(value: unknown): string {
  const d = parse(value);
  return d ? dateFormatter.format(d) : "—";
}

export function dateTime(value: unknown): string {
  const d = parse(value);
  return d ? dateTimeFormatter.format(d) : "—";
}

export function dateLong(value: unknown): string {
  const d = parse(value);
  return d ? longDate.format(d) : "—";
}

export function relative(value: unknown): string {
  const d = parse(value);
  if (!d) return "—";
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(-Math.round(diff), "second");
  if (abs < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(-Math.round(diff / 86400), "day");
  return dateFormatter.format(d);
}

export function fileSize(bytes: unknown): string {
  const n = toNumber(bytes);
  if (n < 1024) return `${n} o`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} Ko`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} Mo`;
  return `${(n / 1024 ** 3).toFixed(2)} Go`;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function toInputDate(value: unknown): string {
  const d = parse(value);
  return d ? d.toISOString().slice(0, 10) : "";
}

export function toInputDateTime(value: unknown): string {
  const d = parse(value);
  if (!d) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  approved: "Approuvé",
  rejected: "Refusé",
  cancelled: "Annulé",
  pending: "En attente",
  pending_approval: "À approuver",
  sent: "Envoyé",
  confirmed: "Confirmé",
  tentative: "À confirmer",
  refused: "Refusé",
  countered: "Contre-offre",
  shipped: "Expédié",
  partially_received: "Reçu partiellement",
  received: "Reçu",
  invoiced: "Facturé",
  closed: "Clôturé",
  validated: "Validé",
  published: "Publié",
  archived: "Archivé",
  in_review: "En revue",
  obsolete: "Obsolète",
  correction: "En correction",
  paid: "Payé",
  partially_paid: "Partiellement payé",
  overdue: "En retard",
  credited: "Soldée par avoir",
  issued: "Émis",
  succeeded: "Réussi",
  failed: "Échec",
  processing: "En cours",
  awaiting_approval: "À approuver",
  matched: "Rapproché",
  exception: "Anomalie",
  approved_for_payment: "Bon à payer",
  open: "Ouvert",
  in_progress: "En cours",
  done: "Terminé",
  resolved: "Résolu",
  reopened: "Rouvert",
  todo: "À faire",
  blocked: "Bloqué",
  planned: "Planifié",
  achieved: "Atteint",
  late: "En retard",
  active: "Actif",
  inactive: "Inactif",
  suspended: "Suspendu",
  new: "Nouveau",
  assigned: "Affecté",
  diagnosis: "Diagnostic",
  scheduled: "Planifié",
  ready: "Prêt",
  translating: "Traduction",
  uploaded: "Téléversé",
  field_checked: "Constat terrain",
  disputed: "Litige",
  signed: "Signé",
  mobilized: "Mobilisé",
  terminated: "Résilié",
  prospect: "Prospect",
  qualified: "Qualifié",
  blacklisted: "Liste noire",
  locked: "Verrouillé",
  superseded: "Remplacé",
  pending_client: "Attente client",
  client_approved: "Approuvé client",
  OUVERT: "Ouvert",
  EN_ANALYSE: "En analyse",
  EN_NEGOCIATION: "En négociation",
  DECISION: "Décision",
  RESOLU: "Résolu",
  ESCALADE: "Escaladé",
  on_track: "Dans les temps",
  at_risk: "À risque",
  critical: "Critique",
  in_stock: "En stock",
  on_order: "Sur commande",
  unavailable: "Indisponible",
  conception: "Conception",
  execution: "Exécution",
  preparation: "Préparation",
  etude: "Étude",
  reception: "Réception",
  garantie: "Garantie",
  clos: "Clos",
  contacted: "Contacté",
  won: "Gagné",
  lost: "Perdu",
  success: "Réussi",
  declared: "Déclaré",
  investigating: "Enquête",
  action_plan: "Plan d'action",
  verified: "Vérifié",
  present: "Présent",
  absent: "Absent",
  leave: "Congé",
  sick: "Maladie",
  computed: "Calculé",
  in_transit: "En transit",
  arrived: "Arrivé",
  announced: "Annoncé",
  ringing: "Sonnerie",
  ended: "Terminé",
  missed: "Manqué",
  held: "Retenue",
  released: "Libérée",
  frozen: "Gelée",
  completed: "Terminé",
  accepted: "Accepté",
  escalated: "Escaladé",
  matching: "Rapprochement",
  unmatched: "Non rapproché",
  ignored: "Ignoré",
  applied: "Imputé",
  expired: "Expiré",
  created: "Créé",
  partially_released: "Libérée en partie",
  awarded: "Attribué",
  proposed: "Proposé",
  withdrawn: "Retirée",
  shortlisted: "Présélectionnée",
  partially_consumed: "Partiellement consommé",
  invited: "Invité",
  declined: "Décliné",
  viewed: "Consulté",
  // innovations (avis, échéanciers, parrainage, panneau)
  opened: "Ouverte",
  requested: "Demandé",
  defaulted: "En défaut",
  captured: "Capté",
  handled: "Traité",
  // innovations lot 3 (séquestre, financement, maintenance, énergie)
  awaiting_payment: "Attente de versement",
  release_requested: "Libération demandée",
  refunded: "Restitué",
  pending_partner: "Convention en attente",
  offer: "Offre reçue",
  booked: "Intervention planifiée",
  skipped: "Ignoré",
  quoted: "Chiffré",
};

export function statusLabel(status?: string | null): string {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

const SUCCESS = new Set([
  "paid", "succeeded", "validated", "published", "approved", "done", "resolved", "closed", "received", "matched",
  "signed", "achieved", "success", "verified", "approved_for_payment", "on_track", "RESOLU", "ready", "present",
  "released", "completed", "accepted", "applied", "awarded", "handled", "offer",
]);
const DANGER = new Set([
  "rejected", "refused", "failed", "cancelled", "exception", "overdue", "late", "critical", "blacklisted", "disputed",
  "ESCALADE", "terminated", "missed", "absent", "frozen", "escalated", "expired", "withdrawn", "declined", "defaulted",
]);
const WARNING = new Set([
  "pending", "tentative", "submitted", "awaiting_approval", "in_review", "pending_client", "at_risk", "countered", "partially_paid",
  "partially_received", "field_checked", "EN_ANALYSE", "EN_NEGOCIATION", "DECISION", "on_order", "diagnosis",
  "pending_approval", "proposed", "matching", "unmatched", "partially_released", "partially_consumed",
  "release_requested", "pending_partner", "awaiting_payment",
]);
const INFO = new Set([
  "in_progress", "sent", "confirmed", "shipped", "issued", "processing", "open", "assigned", "scheduled", "translating",
  "mobilized", "OUVERT", "in_transit", "active", "created", "invited", "viewed", "shortlisted", "opened", "requested",
  "captured", "booked", "quoted", "held",
]);

export function statusTone(status?: string | null): Tone {
  if (!status) return "neutral";
  if (SUCCESS.has(status)) return "success";
  if (DANGER.has(status)) return "danger";
  if (WARNING.has(status)) return "warning";
  if (INFO.has(status)) return "info";
  return "neutral";
}
