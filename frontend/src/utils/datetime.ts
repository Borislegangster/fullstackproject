/**
 * Central, settings-driven date/time formatting — no mock, no hardcoded locale.
 *
 * The persisted ERP settings (`timezone`, `date_format`) are pushed in once via
 * `configureDateFormatting()` (called from the ERP layout when the company
 * settings load). Every formatter then honours that timezone + day/month order.
 *
 * Why module-level state: dates are formatted in dozens of places, many outside
 * React render scope. A single hydrated cache keeps every call site consistent
 * without threading settings through props.
 */

type DateOrder = 'JJ/MM/AAAA' | 'MM/JJ/AAAA';

/** Persisted setting labels → real IANA timezone names. */
const TZ_MAP: Record<string, string> = {
  'Africa/Douala (WAT)': 'Africa/Douala',
  'Europe/Paris (CET)': 'Europe/Paris',
};

let _timeZone: string | undefined; // undefined → runtime/browser timezone
let _dateOrder: DateOrder = 'JJ/MM/AAAA';

/** Hydrate the formatter from persisted settings (idempotent). */
export function configureDateFormatting(opts: {
  timezone?: string | null;
  dateFormat?: string | null;
}): void {
  if (opts.timezone != null) {
    _timeZone = TZ_MAP[opts.timezone] ?? (opts.timezone || undefined);
  }
  if (opts.dateFormat === 'MM/JJ/AAAA' || opts.dateFormat === 'JJ/MM/AAAA') {
    _dateOrder = opts.dateFormat;
  }
}

/** Current configuration (handy for tests / debugging). */
export function getDateFormatting(): { timeZone: string | undefined; dateOrder: DateOrder } {
  return { timeZone: _timeZone, dateOrder: _dateOrder };
}

function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Numeric date/time parts rendered in the configured timezone. */
function numericParts(d: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: _timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) out[part.type] = part.value;
  return out;
}

function orderedDate(p: Record<string, string>): string {
  return _dateOrder === 'MM/JJ/AAAA'
    ? `${p.month}/${p.day}/${p.year}`
    : `${p.day}/${p.month}/${p.year}`;
}

/** Short numeric date honouring the configured order + timezone — "05/06/2026". */
export function formatDate(value: unknown, fallback = ''): string {
  const d = toDate(value);
  if (!d) return fallback;
  return orderedDate(numericParts(d));
}

/** Short numeric date + 24h time — "05/06/2026 14:30". */
export function formatDateTime(value: unknown, fallback = ''): string {
  const d = toDate(value);
  if (!d) return fallback;
  const p = numericParts(d);
  return `${orderedDate(p)} ${p.hour}:${p.minute}`;
}

/** 24h time only — "14:30". */
export function formatTime(value: unknown, fallback = ''): string {
  const d = toDate(value);
  if (!d) return fallback;
  const p = numericParts(d);
  return `${p.hour}:${p.minute}`;
}

/**
 * Named/long date with arbitrary Intl options (French month names),
 * timezone-aware — e.g. formatDateParts(x, { day: '2-digit', month: 'long', year: 'numeric' }).
 */
export function formatDateParts(
  value: unknown,
  options: Intl.DateTimeFormatOptions,
  fallback = '',
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString('fr-FR', { timeZone: _timeZone, ...options });
}

/** Long date+time with arbitrary Intl options, timezone-aware. */
export function formatDateTimeParts(
  value: unknown,
  options: Intl.DateTimeFormatOptions,
  fallback = '',
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleString('fr-FR', { timeZone: _timeZone, ...options });
}
