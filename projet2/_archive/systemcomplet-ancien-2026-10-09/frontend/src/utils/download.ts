/**
 * Real file/data download helpers — no mock, no fake progress.
 *
 * Every function here performs a genuine browser download of real bytes:
 *   • downloadCSV   — serialises real in-memory rows to a CSV file
 *   • downloadBlob  — saves an already-fetched Blob
 *   • downloadAuthedFile — streams a protected backend file (xlsx / pdf)
 *   • openOrDownloadUrl  — opens / downloads a stored document by its URL
 */
import { axiosClient } from '../services/api/axiosClient';

/** Trigger a browser "Save as" for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on next tick so the navigation has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Escape per RFC 4180 when the cell contains a delimiter / quote / newline.
  if (/[",\n;]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export interface CsvColumn {
  key: string;
  label: string;
}

/**
 * Build a real CSV from in-memory rows and download it.
 * A UTF-8 BOM is prepended so Excel renders accents (é, à, …) correctly.
 */
export function downloadCSV(
  filename: string,
  rows: Array<Record<string, unknown>>,
  columns?: CsvColumn[],
): void {
  const cols: CsvColumn[] =
    columns ??
    (rows.length
      ? Object.keys(rows[0]).map((k) => ({ key: k, label: k }))
      : []);
  const header = cols.map((c) => csvCell(c.label)).join(';');
  const body = rows
    .map((row) => cols.map((c) => csvCell(row[c.key])).join(';'))
    .join('\r\n');
  const csv = '﻿' + header + '\r\n' + body;
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

/**
 * Download a protected backend file (e.g. /exports/invoices.xlsx,
 * /invoices/{id}/pdf). The Authorization header is attached by axiosClient.
 */
export async function downloadAuthedFile(
  path: string,
  filename: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const res = await axiosClient.get(path, {
    responseType: 'blob',
    onDownloadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  downloadBlob(res.data as Blob, filename);
}

/**
 * Open / download a stored document referenced by its URL.
 * Absolute URLs (S3 / CDN) open directly; relative ones go through the API.
 */
export async function openOrDownloadUrl(
  fileUrl: string | null | undefined,
  filename?: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  if (!fileUrl) throw new Error('Aucun fichier associé à ce document.');
  if (/^https?:\/\//i.test(fileUrl)) {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  await downloadAuthedFile(
    fileUrl,
    filename || fileUrl.split('/').pop() || 'document',
    onProgress,
  );
}
