// Download helpers — file streaming for PDF, Excel, PNG.
//
// The API exposes "*/pdf" and "*.xlsx" endpoints that return a binary stream
// with Content-Disposition: attachment. We fetch them as `blob` with auth
// headers, then trigger a browser download via a temporary anchor.
import { axiosClient } from './axiosClient';

const triggerBrowserDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke a tick so Safari has time to start the download
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

const filenameFromContentDisposition = (header?: string): string | null => {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try { return decodeURIComponent(utf8[1]); } catch { /* fall through */ }
  }
  const ascii = /filename="?([^";]+)"?/i.exec(header);
  return ascii?.[1] || null;
};

/** GET a binary endpoint and stream it to the user as a download. */
export async function downloadBinary(path: string, fallbackFilename: string) {
  const res = await axiosClient.get(path, { responseType: 'blob' });
  const filename =
    filenameFromContentDisposition(res.headers['content-disposition'] as string | undefined) ||
    fallbackFilename;
  triggerBrowserDownload(res.data as Blob, filename);
}

/** POST a binary endpoint (e.g. attestation generator) and stream the result. */
export async function downloadBinaryPost(path: string, body: unknown, fallbackFilename: string) {
  const res = await axiosClient.post(path, body, { responseType: 'blob' });
  const filename =
    filenameFromContentDisposition(res.headers['content-disposition'] as string | undefined) ||
    fallbackFilename;
  triggerBrowserDownload(res.data as Blob, filename);
}

/** Fetch a binary endpoint and return the blob (e.g. to preview in an <img>). */
export async function fetchBlob(path: string): Promise<Blob> {
  const res = await axiosClient.get(path, { responseType: 'blob' });
  return res.data as Blob;
}

// ── Concrete shortcuts used across the ERP & client portal ──────

export const downloadInvoicePdf = (invoiceId: string, code = 'facture') =>
  downloadBinary(`/invoices/${invoiceId}/pdf`, `${code}.pdf`);

export const downloadQuotePdf = (quoteId: string, code = 'devis') =>
  downloadBinary(`/quotes/${quoteId}/pdf`, `${code}.pdf`);

export const downloadPayrollPdf = (payrollId: string, period = 'bulletin') =>
  downloadBinary(`/hr/payroll/${payrollId}/pdf`, `bulletin-${period}.pdf`);

export const downloadEmployeeAttestation = (employeeId: string, body: {
  subject?: string;
  body?: string;
  purpose?: string;
}) =>
  downloadBinaryPost(
    `/hr/employees/${employeeId}/attestation-pdf`,
    body,
    `attestation-${employeeId}.pdf`,
  );

export const downloadEmployeeContract = (employeeId: string, body: {
  title?: string;
  contract_type?: string;
  position?: string;
  salary?: number;
  salary_period?: string;
  working_hours?: string;
  start_date?: string;
  end_date?: string;
  clauses?: string;
}) =>
  downloadBinaryPost(
    `/hr/employees/${employeeId}/contract-pdf`,
    body,
    `contrat-${employeeId}.pdf`,
  );

export const downloadTemplatePreview = (templateId: string) =>
  downloadBinary(`/templates/${templateId}/preview-pdf`, `apercu-${templateId}.pdf`);

// ── Excel exports ──────────────────────────────────────────────

export const exportInvoicesXlsx = (statusFilter?: string) => {
  const qs = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
  return downloadBinary(`/exports/invoices.xlsx${qs}`, 'factures.xlsx');
};

export const exportProjectsXlsx = () =>
  downloadBinary('/exports/projects.xlsx', 'chantiers.xlsx');

export const exportLeadsXlsx = () =>
  downloadBinary('/exports/leads.xlsx', 'leads.xlsx');

export const exportEmployeesXlsx = () =>
  downloadBinary('/exports/employees.xlsx', 'employes.xlsx');

export const exportTempWorkersXlsx = () =>
  downloadBinary('/exports/temp-workers.xlsx', 'journaliers.xlsx');

export const exportPayrollXlsx = (period?: string) => {
  const qs = period ? `?period=${encodeURIComponent(period)}` : '';
  return downloadBinary(`/exports/payroll.xlsx${qs}`, `paie${period ? `-${period}` : ''}.xlsx`);
};

export const exportPurchaseRequestsXlsx = () =>
  downloadBinary('/exports/purchase-requests.xlsx', 'demandes-achat.xlsx');

export const exportStockXlsx = () =>
  downloadBinary('/exports/stock.xlsx', 'stock.xlsx');

export const exportSubcontractorInvoicesXlsx = () =>
  downloadBinary('/exports/subcontractor-invoices.xlsx', 'factures-soustraitants.xlsx');

// ── QR badge (PNG preview/download) ─────────────────────────────

export const fetchTempWorkerQrBlob = (workerId: string) =>
  fetchBlob(`/hr/temp-workers/${workerId}/qr.png`);

export const downloadTempWorkerQr = (workerId: string, name = 'badge') =>
  downloadBinary(`/hr/temp-workers/${workerId}/qr.png`, `qr-${name}.png`);

// ── Electronic signature (OTP) ──────────────────────────────────

export const requestSigningOtp = async (documentId: string) => {
  const res = await axiosClient.post(`/signing/documents/${documentId}/request-otp`);
  return res.data as { detail: string; expires_at: string; ttl_minutes: number };
};

export const verifySigningOtp = async (documentId: string, code: string) => {
  const res = await axiosClient.post(`/signing/documents/${documentId}/verify-otp`, { code });
  return res.data as {
    id: string;
    document_id: string;
    signer_id: string;
    document_hash: string;
    signed_at: string;
    method: string;
  };
};

export const getDocumentSignatureAudit = async (documentId: string) => {
  const res = await axiosClient.get(`/signing/documents/${documentId}/audit`);
  return res.data as Array<{
    id: string;
    signer_id: string;
    document_hash: string;
    signed_at: string;
    ip_address: string;
    user_agent: string;
    method: string;
    audit_meta: Record<string, unknown>;
  }>;
};
