import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureDateFormatting,
  formatDate,
  formatDateTime,
  formatTime,
  formatDateParts,
} from '../utils/datetime';

// Fixed UTC instant: 2026-06-05 13:30 UTC
//   → Africa/Douala (UTC+1): 14:30, 05/06/2026
//   → Europe/Paris  (UTC+2 in June / CEST): 15:30, 05/06/2026
const INSTANT = '2026-06-05T13:30:00Z';

describe('utils/datetime — settings-driven formatting', () => {
  beforeEach(() => {
    // Reset to the app defaults before each test
    configureDateFormatting({ timezone: 'Africa/Douala (WAT)', dateFormat: 'JJ/MM/AAAA' });
  });

  it('formats a short date in day/month order + configured timezone', () => {
    expect(formatDate(INSTANT)).toBe('05/06/2026');
  });

  it('honours the MM/JJ/AAAA order setting', () => {
    configureDateFormatting({ dateFormat: 'MM/JJ/AAAA' });
    expect(formatDate(INSTANT)).toBe('06/05/2026');
  });

  it('renders time in the configured timezone (WAT = UTC+1)', () => {
    expect(formatTime(INSTANT)).toBe('14:30');
    expect(formatDateTime(INSTANT)).toBe('05/06/2026 14:30');
  });

  it('shifts the rendered time when the timezone changes (CEST = UTC+2)', () => {
    configureDateFormatting({ timezone: 'Europe/Paris (CET)' });
    expect(formatTime(INSTANT)).toBe('15:30');
  });

  it('returns the fallback for null / empty / invalid input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate(undefined, '—')).toBe('—');
    expect(formatDateTime('not-a-date', 'Jamais')).toBe('Jamais');
  });

  it('formatDateParts keeps French month names', () => {
    expect(formatDateParts(INSTANT, { day: '2-digit', month: 'long', year: 'numeric' }))
      .toContain('juin');
  });
});
