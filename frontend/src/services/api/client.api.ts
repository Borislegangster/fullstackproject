import { axiosClient } from './axiosClient';

// ── Profile ──────────────────────────────────────────────────
export const getClientProfile = async () => {
  const res = await axiosClient.get('/client/profile');
  return res.data;
};

// ── Project ──────────────────────────────────────────────────
export const getClientProject = async () => {
  const res = await axiosClient.get('/client/project');
  return res.data;
};

export const getClientProjectTimeline = async () => {
  const res = await axiosClient.get('/client/project/timeline');
  return res.data;
};

export const getClientProjectGallery = async () => {
  const res = await axiosClient.get('/client/project/gallery');
  return res.data;
};

/** Live snapshot (phase/photo recent/unread messages) for the dashboard widget. */
export const getClientProjectLive = async () => {
  const res = await axiosClient.get('/client/project/live');
  return res.data;
};

// ── Finances ─────────────────────────────────────────────────
export const getClientFinances = async () => {
  const res = await axiosClient.get('/client/finances');
  return res.data;
};

export const getClientFinancesEvolution = async () => {
  const res = await axiosClient.get('/client/finances/evolution');
  return res.data as Array<{ month: string; invoiced: number; paid: number; budget: number }>;
};

export const getClientFinancesReceipts = async () => {
  const res = await axiosClient.get('/client/finances/receipts');
  return res.data as Array<{
    id: string; invoice_code: string; amount: number; method: string; reference: string; paid_at: string;
  }>;
};

export interface PaymentPayload {
  amount: number;
  method?: 'mobile_money' | 'virement' | 'cash' | 'cheque' | 'cb';
  reference?: string;
}

/** @deprecated — Legacy direct-insert payment. Use initiateFlutterwavePayment instead. */
export const initiatePayment = async (
  invoiceId: string,
  payload: PaymentPayload
) => {
  const res = await axiosClient.post(`/client/finances/${invoiceId}/pay`, payload);
  return res.data;
};

// ── Flutterwave Payment Flow ─────────────────────────────────

export interface FlutterwaveInitResponse {
  checkout_url: string;
  tx_ref: string;
  transaction_id: string;
}

export interface PaymentStatusResponse {
  tx_ref: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amount: number;
  currency: string;
  payment_type: string | null;
  flw_ref: string | null;
  completed_at: string | null;
}

/** Initiate a Flutterwave payment — returns checkout URL for redirect. */
export const initiateFlutterwavePayment = async (
  invoiceId: string
): Promise<FlutterwaveInitResponse> => {
  const res = await axiosClient.post<FlutterwaveInitResponse>('/payments/initiate', {
    invoice_id: invoiceId,
  });
  return res.data;
};

/** Poll payment status by tx_ref. */
export const getPaymentStatus = async (
  txRef: string
): Promise<PaymentStatusResponse> => {
  const res = await axiosClient.get<PaymentStatusResponse>(`/payments/${txRef}/status`);
  return res.data;
};

// ── Documents ────────────────────────────────────────────────
export const getClientDocuments = async () => {
  const res = await axiosClient.get('/client/documents');
  return res.data;
};

export interface ClientDocumentPayload {
  name: string;
  file_url: string;
  category?: string;
  notes?: string;
}

/** Client document upload — two-step:
 *  1. Upload the binary via /admin/media/upload to get a stable URL.
 *  2. POST that URL here with metadata.
 *  The legacy `FormData` version is no longer used (backend expects JSON).
 */
export const uploadClientDocument = async (payload: ClientDocumentPayload) => {
  const res = await axiosClient.post('/client/documents', payload);
  return res.data;
};

/** Real binary upload — sends the file itself; backend stores it & returns the URL. */
export const uploadClientDocumentFile = async (
  file: File,
  opts?: { category?: string; notes?: string; onProgress?: (pct: number) => void },
) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('name', file.name);
  fd.append('category', opts?.category || 'envoi_client');
  fd.append('notes', opts?.notes || '');
  const res = await axiosClient.post('/client/documents/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (opts?.onProgress && e.total) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return res.data;
};

export const signDocumentOTP = async (id: string, _otp?: string) => {
  // Backend OTP is not yet enforced — POST without body for now (Phase 7 will
  // add request-otp / verify-otp endpoints).
  const res = await axiosClient.post(`/client/documents/${id}/sign-otp`);
  return res.data;
};

export interface MaterialChoicePayload {
  choice_id: string;
  selection: string;
}

export const getMaterialChoices = async () => {
  const res = await axiosClient.get('/client/material-choices');
  return res.data;
};

export const submitMaterialChoice = async (data: MaterialChoicePayload) => {
  // Backend exposes PATCH /client/material-choices/{choice_id} with body {selection}
  const res = await axiosClient.patch(
    `/client/material-choices/${data.choice_id}`,
    { selection: data.selection }
  );
  return res.data;
};

// ── Messages ─────────────────────────────────────────────────
export const getClientMessages = async () => {
  const res = await axiosClient.get('/client/messages');
  return res.data;
};

export const sendClientMessage = async (content: string) => {
  const res = await axiosClient.post('/client/messages', { content });
  return res.data;
};

// ── Planning ─────────────────────────────────────────────────
export const getClientPlanning = async () => {
  const res = await axiosClient.get('/client/planning');
  return res.data;
};

export interface AppointmentRequest {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
}

export const requestAppointment = async (data: AppointmentRequest) => {
  const res = await axiosClient.post('/client/appointments', data);
  return res.data;
};

// ── SAV ──────────────────────────────────────────────────────
export const getClientSAVTickets = async () => {
  const res = await axiosClient.get('/client/sav/tickets');
  return res.data;
};

export interface SAVTicketPayload {
  subject: string;
  description?: string;
  category?: string;
  priority?: 'BASSE' | 'NORMALE' | 'HAUTE' | 'URGENTE';
}

export const createClientSAVTicket = async (data: SAVTicketPayload) => {
  const res = await axiosClient.post('/client/sav/tickets', data);
  return res.data;
};

export const rateClientSAVTicket = async (id: string, rating: number) => {
  const res = await axiosClient.post(`/client/sav/tickets/${id}/rate`, { rating });
  return res.data;
};

// ── Notifications ────────────────────────────────────────────
export const getClientNotifications = async () => {
  const res = await axiosClient.get('/client/notifications');
  return res.data;
};

export const markClientNotificationRead = async (id: string) => {
  const res = await axiosClient.patch(`/client/notifications/${id}/read`);
  return res.data;
};

export const deleteClientNotification = async (id: string) => {
  const res = await axiosClient.delete(`/client/notifications/${id}`);
  return res.data;
};

// ── Family / Guest access ────────────────────────────────────
export interface GuestAccess {
  id: string;
  email: string;
  name: string;
  role: 'READ_ONLY' | 'EDIT';
  status: string;
  created_at: string | null;
}

export const getClientGuests = async (): Promise<GuestAccess[]> => {
  const res = await axiosClient.get<GuestAccess[]>('/client/guests');
  return res.data;
};

export const inviteClientGuest = async (data: {
  email: string;
  name?: string;
  role?: 'READ_ONLY' | 'EDIT';
}) => {
  const res = await axiosClient.post('/client/guests', data);
  return res.data;
};

export const removeClientGuest = async (id: string) => {
  const res = await axiosClient.delete(`/client/guests/${id}`);
  return res.data;
};
