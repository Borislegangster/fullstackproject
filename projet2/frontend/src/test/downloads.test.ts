/**
 * Unit tests for the download helpers — focus on the bits that don't need
 * a real network: filename parsing + URL composition.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We bypass axiosClient by mocking it before the helpers import it.
vi.mock('../services/api/axiosClient', () => ({
  axiosClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Import after the mock is in place.
import { axiosClient } from '../services/api/axiosClient';
import {
  downloadInvoicePdf, exportPayrollXlsx, requestSigningOtp, verifySigningOtp,
} from '../services/api/downloads';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('downloads — URL composition', () => {
  it('downloadInvoicePdf hits /invoices/:id/pdf with blob responseType', async () => {
    (axiosClient.get as any).mockResolvedValueOnce({
      data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
      headers: {},
    });
    // Spy on anchor click so we know the download was triggered.
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadInvoicePdf('abc-123', 'FAC-2026-001');

    expect(axiosClient.get).toHaveBeenCalledWith(
      '/invoices/abc-123/pdf',
      { responseType: 'blob' },
    );
    expect(click).toHaveBeenCalled();
  });

  it('exportPayrollXlsx forwards the period query string', async () => {
    (axiosClient.get as any).mockResolvedValueOnce({
      data: new Blob(['PK'], { type: 'application/octet-stream' }),
      headers: {},
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await exportPayrollXlsx('2026-05');

    expect(axiosClient.get).toHaveBeenCalledWith(
      '/exports/payroll.xlsx?period=2026-05',
      { responseType: 'blob' },
    );
  });

  it('exportPayrollXlsx with no period sends a bare URL', async () => {
    (axiosClient.get as any).mockResolvedValueOnce({
      data: new Blob(['PK'], { type: 'application/octet-stream' }),
      headers: {},
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await exportPayrollXlsx();

    expect(axiosClient.get).toHaveBeenCalledWith(
      '/exports/payroll.xlsx',
      { responseType: 'blob' },
    );
  });
});

describe('downloads — signing OTP', () => {
  it('requestSigningOtp posts to /signing/documents/:id/request-otp', async () => {
    (axiosClient.post as any).mockResolvedValueOnce({
      data: { detail: 'sent', expires_at: 'x', ttl_minutes: 10 },
    });
    const out = await requestSigningOtp('doc-1');
    expect(axiosClient.post).toHaveBeenCalledWith('/signing/documents/doc-1/request-otp');
    expect(out.ttl_minutes).toBe(10);
  });

  it('verifySigningOtp sends the code in body', async () => {
    (axiosClient.post as any).mockResolvedValueOnce({
      data: {
        id: 'sig-1', document_id: 'doc-1', signer_id: 'u',
        document_hash: 'abc', signed_at: '2026-05-30', method: 'OTP_EMAIL',
      },
    });
    const out = await verifySigningOtp('doc-1', '123456');
    expect(axiosClient.post).toHaveBeenCalledWith(
      '/signing/documents/doc-1/verify-otp',
      { code: '123456' },
    );
    expect(out.method).toBe('OTP_EMAIL');
  });
});
