/**
 * Client HTTP de l'API GLOBUS (navigateur) : cookies HttpOnly de session, jeton CSRF en en-tête,
 * renouvellement automatique de session (refresh rotatif), clés d'idempotence, erreurs normalisées.
 */

export const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  correlationId?: string;

  constructor(status: number, code: string, message: string, details?: unknown, correlationId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
  }
}

type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
  query?: Query;
  idempotent?: boolean | string;
  signal?: AbortSignal;
  raw?: boolean;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined;
}

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function apiUrl(path: string, query?: Query): string {
  return `${API_PREFIX}${path}${buildQuery(query)}`;
}

export function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Client-App": "web", "X-CSRF-Token": readCookie("globus_csrf") ?? "" },
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 0);
      });
  }
  return refreshing;
}

async function parseError(response: Response): Promise<ApiError> {
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    /* corps non JSON */
  }
  const err = payload?.error;
  if (err) return new ApiError(response.status, err.code ?? "ERROR", err.message ?? "Erreur", err.details, err.correlation_id);
  if (Array.isArray(payload?.detail)) {
    const first = payload.detail[0];
    const field = Array.isArray(first?.loc) ? first.loc.filter((x: unknown) => x !== "body").join(".") : "";
    return new ApiError(response.status, "VALIDATION_ERROR", `${field ? field + " : " : ""}${first?.msg ?? "Données invalides"}`, payload.detail);
  }
  return new ApiError(response.status, "HTTP_" + response.status, response.statusText || "Erreur réseau");
}

export async function api<T = any>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const method = options.method ?? (options.body !== undefined || options.form ? "POST" : "GET");
  const headers: Record<string, string> = { "X-Client-App": "web", Accept: "application/json" };
  if (method !== "GET") headers["X-CSRF-Token"] = readCookie("globus_csrf") ?? "";
  if (options.idempotent) headers["Idempotency-Key"] = typeof options.idempotent === "string" ? options.idempotent : newKey();
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(apiUrl(path, options.query), {
    method,
    headers,
    body,
    credentials: "include",
    signal: options.signal,
  });
  if (response.status === 401 && !retried && !path.startsWith("/auth/login") && !path.startsWith("/auth/refresh")) {
    if (await refreshSession()) return api<T>(path, options, true);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("globus:unauthorized"));
  }
  if (!response.ok) {
    const error = await parseError(response);
    if (error.code === "MFA_ENROLLMENT_REQUIRED" && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("globus:mfa-required"));
    throw error;
  }
  if (options.raw) return response as unknown as T;
  if (response.status === 204) return undefined as T;
  const type = response.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? response.json() : response.text()) as Promise<T>;
}

export async function download(path: string, filename: string, query?: Query): Promise<void> {
  const response = await api<Response>(path, { query, raw: true });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages?: number;
}

export interface FieldError {
  field: string;
  message: string;
  type?: string;
}

const VALIDATION_TYPES: Record<string, string> = {
  missing: "champ obligatoire",
  string_too_short: "valeur trop courte",
  string_too_long: "valeur trop longue",
  string_pattern_mismatch: "format invalide",
  greater_than: "valeur trop petite",
  greater_than_equal: "valeur trop petite",
  less_than: "valeur trop grande",
  less_than_equal: "valeur trop grande",
  too_short: "au moins un élément est requis",
  too_long: "trop d'éléments",
  value_error: "valeur invalide",
  uuid_parsing: "sélection invalide",
  uuid_type: "sélection invalide",
  date_from_datetime_parsing: "date invalide",
  date_parsing: "date invalide",
  datetime_parsing: "date et heure invalides",
  datetime_from_date_parsing: "date et heure invalides",
  decimal_parsing: "nombre invalide",
  float_parsing: "nombre invalide",
  int_parsing: "nombre entier attendu",
  bool_parsing: "valeur oui/non attendue",
  literal_error: "choix invalide",
  enum: "choix invalide",
  extra_forbidden: "champ non autorisé",
};

/** Erreurs de validation champ par champ renvoyées par l'API (422 VALIDATION_ERROR). */
export function fieldErrors(error: unknown): FieldError[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return [];
  return (error.details as any[])
    .filter((d) => d && typeof d === "object" && "field" in d)
    .map((d) => ({
      field: String(d.field ?? ""),
      type: d.type,
      message: (d.type && VALIDATION_TYPES[d.type]) || String(d.message ?? "valeur invalide").replace(/^Value error, /, ""),
    }));
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const fields = fieldErrors(error);
    if (fields.length) {
      const first = fields[0];
      const name = first.field.split(".").filter((p) => !/^\d+$/.test(p)).pop() ?? first.field;
      return `${error.message} — ${name ? `${name} : ` : ""}${first.message}${fields.length > 1 ? ` (+${fields.length - 1})` : ""}`;
    }
    if (error.status === 429) return "Trop de tentatives : patientez quelques instants avant de réessayer.";
    if (error.status === 403 && error.code === "FORBIDDEN") return error.message || "Action non autorisée pour votre profil.";
    return error.message;
  }
  if (error instanceof TypeError) return "Connexion au serveur impossible. Vérifiez votre réseau.";
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue";
}
