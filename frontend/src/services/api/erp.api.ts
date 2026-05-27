import { axiosClient } from './axiosClient';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface UserOut {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  phone: string;
  avatar_url: string | null;
  must_change_password: boolean;
  is_active?: boolean;
  last_login_at?: string;
  created_at?: string;
}

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  project_type: string;
  message: string;
  location: string;
  status: string;
  pipeline_notes: string;
  quote_amount: number | null;
  assigned_to: string | null;
  source: string;
  converted_project_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  phases: Array<{ name: string; duration_days: number }>;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  location: string;
  project_type: string;
  client_id: string | null;
  chef_projet_id: string | null;
  budget_initial: number;
  budget_spent: number;
  status: string;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  estimated_end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectPhase {
  id: string;
  name: string;
  status: string;
  progress: number;
  duration_days: number;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
  validated_by: string | null;
  validated_at: string | null;
}

export interface Invoice {
  id: string;
  code: string;
  project_id: string;
  client_id: string;
  invoice_type: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  lines: any[];
  notes: string;
  phase_id: string | null;
  issue_date: string;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  contract_type: string;
  base_salary: number;
  hire_date: string | null;
  is_active: boolean;
  photo_url: string | null;
}

export interface TempWorker {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  speciality: string;
  daily_rate: number;
  rating: number;
  qr_code_data: string | null;
  is_active: boolean;
}

export interface StockItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  alert_threshold: number;
  location: string;
  low_stock: boolean;
}

export interface SAVTicket {
  id: string;
  code: string;
  project_id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  rating: number | null;
  created_at: string;
  resolved_at: string | null;
  replies?: SAVTicketReply[];
}

export interface SAVTicketReply {
  id: string;
  author_id: string;
  content: string;
  attachment_url: string | null;
  is_internal: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  old_value: any;
  new_value: any;
  created_at: string;
}

export interface Appointment {
  id: string;
  title: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
  status: string;
  requested_by: string;
  attendees: string[];
  project_id: string | null;
}

export interface DocumentItem {
  id: string;
  name: string;
  file_url: string;
  file_size: string;
  mime_type: string;
  category: string;
  version: number;
  shared_with_client: boolean;
  uploaded_by: string | null;
  signed_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  content: string;
  is_system: boolean;
  attachment_url: string | null;
  created_at: string;
}

export interface SubContractor {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  speciality: string;
  rating: number;
  is_active: boolean;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  status: string;
  current_project_id: string | null;
  next_maintenance: string | null;
  maintenance_history: any[];
}

export interface QHSEIncident {
  id: string;
  project_id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  status: string;
  corrective_action: string;
  incident_date: string;
}

export interface PurchaseRequest {
  id: string;
  code: string;
  project_id: string | null;
  description: string;
  items: any[];
  estimated_total: number;
  status: string;
  requested_by: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════
// CRM
// ═══════════════════════════════════════════════════════════════

export const crmApi = {
  getLeads: (status?: string) =>
    axiosClient.get<Lead[]>('/crm/leads', { params: status ? { status_filter: status } : {} }).then(r => r.data),
  
  createLead: (data: Partial<Lead>) =>
    axiosClient.post<Lead>('/crm/leads', data).then(r => r.data),

  updateLead: (id: string, data: Partial<Lead>) =>
    axiosClient.patch<Lead>(`/crm/leads/${id}`, data).then(r => r.data),

  deleteLead: (id: string) =>
    axiosClient.delete(`/crm/leads/${id}`).then(r => r.data),

  convertLead: (id: string, data: { project_name: string; project_type?: string; template_id?: string; chef_projet_id?: string }) =>
    axiosClient.post(`/crm/leads/${id}/convert`, data).then(r => r.data),

  resendInvitation: (id: string) =>
    axiosClient.post(`/crm/leads/${id}/resend-invitation`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════════════════════════

export const projectsApi = {
  list: (status?: string) =>
    axiosClient.get<Project[]>('/projects', { params: status ? { status_filter: status } : {} }).then(r => r.data),

  get: (id: string) =>
    axiosClient.get<Project>(`/projects/${id}`).then(r => r.data),

  create: (data: any) =>
    axiosClient.post('/projects', data).then(r => r.data),

  update: (id: string, data: any) =>
    axiosClient.patch(`/projects/${id}`, data).then(r => r.data),

  getTimeline: (id: string) =>
    axiosClient.get<ProjectPhase[]>(`/projects/${id}/timeline`).then(r => r.data),

  updatePhase: (projectId: string, phaseId: string, data: any) =>
    axiosClient.patch(`/projects/${projectId}/phases/${phaseId}`, data).then(r => r.data),

  getGallery: (id: string) =>
    axiosClient.get(`/projects/${id}/gallery`).then(r => r.data),

  getTemplates: () =>
    axiosClient.get<ProjectTemplate[]>('/projects/templates/list').then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// INVOICING
// ═══════════════════════════════════════════════════════════════

export const invoicingApi = {
  list: (params?: { project_id?: string; status_filter?: string }) =>
    axiosClient.get<Invoice[]>('/invoices', { params }).then(r => r.data),

  create: (data: any) =>
    axiosClient.post('/invoices', data).then(r => r.data),

  update: (id: string, data: any) =>
    axiosClient.patch(`/invoices/${id}`, data).then(r => r.data),

  send: (id: string) =>
    axiosClient.patch(`/invoices/${id}/send`).then(r => r.data),

  markPaid: (id: string) =>
    axiosClient.patch(`/invoices/${id}/mark-paid`).then(r => r.data),

  remind: (id: string) =>
    axiosClient.post(`/invoices/${id}/remind`).then(r => r.data),

  createPayment: (data: { invoice_id: string; amount: number; method?: string; reference?: string }) =>
    axiosClient.post('/invoices/payments', data).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// HR
// ═══════════════════════════════════════════════════════════════

export const hrApi = {
  getEmployees: () =>
    axiosClient.get<Employee[]>('/hr/employees').then(r => r.data),

  createEmployee: (data: any) =>
    axiosClient.post('/hr/employees', data).then(r => r.data),

  updateEmployee: (id: string, data: any) =>
    axiosClient.patch(`/hr/employees/${id}`, data).then(r => r.data),

  deleteEmployee: (id: string) =>
    axiosClient.delete(`/hr/employees/${id}`).then(r => r.data),

  getTempWorkers: () =>
    axiosClient.get<TempWorker[]>('/hr/temp-workers').then(r => r.data),

  createTempWorker: (data: any) =>
    axiosClient.post('/hr/temp-workers', data).then(r => r.data),

  getAttendance: (params?: { project_id?: string }) =>
    axiosClient.get('/hr/attendance', { params }).then(r => r.data),

  recordAttendance: (data: any) =>
    axiosClient.post('/hr/attendance/scan', data).then(r => r.data),

  generatePayroll: (data: any) =>
    axiosClient.post('/hr/payroll/generate', data).then(r => r.data),

  getPayroll: (workerId: string) =>
    axiosClient.get(`/hr/payroll/${workerId}`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// PROCUREMENT
// ═══════════════════════════════════════════════════════════════

export const procurementApi = {
  getPRs: (status?: string) =>
    axiosClient.get<PurchaseRequest[]>('/procurement/purchase-requests', { params: status ? { status_filter: status } : {} }).then(r => r.data),

  createPR: (data: any) =>
    axiosClient.post('/procurement/purchase-requests', data).then(r => r.data),

  validatePR: (id: string) =>
    axiosClient.post(`/procurement/purchase-requests/${id}/validate`).then(r => r.data),

  rejectPR: (id: string, reason?: string) =>
    axiosClient.post(`/procurement/purchase-requests/${id}/reject`, null, { params: { reason } }).then(r => r.data),

  getPOs: () =>
    axiosClient.get('/procurement/purchase-orders').then(r => r.data),

  getStock: () =>
    axiosClient.get<StockItem[]>('/procurement/stock').then(r => r.data),

  createStockItem: (data: any) =>
    axiosClient.post('/procurement/stock', data).then(r => r.data),

  createMovement: (data: any) =>
    axiosClient.post('/procurement/stock/movements', data).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// GED / DOCUMENTS
// ═══════════════════════════════════════════════════════════════

export const gedApi = {
  getFolders: (projectId: string) =>
    axiosClient.get(`/ged/folders/${projectId}`).then(r => r.data),

  createFolder: (data: { project_id: string; name: string; parent_id?: string }) =>
    axiosClient.post('/ged/folders', data).then(r => r.data),

  getDocuments: (projectId: string, params?: { category?: string; shared_only?: boolean }) =>
    axiosClient.get<DocumentItem[]>(`/ged/documents/${projectId}`, { params }).then(r => r.data),

  uploadDocument: (data: any) =>
    axiosClient.post('/ged/documents', data).then(r => r.data),

  toggleShare: (docId: string) =>
    axiosClient.patch(`/ged/documents/${docId}/share`).then(r => r.data),

  signDocument: (docId: string) =>
    axiosClient.post(`/ged/documents/${docId}/sign-otp`).then(r => r.data),

  getMaterialChoices: (projectId: string) =>
    axiosClient.get(`/ged/material-choices/${projectId}`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// MESSAGING
// ═══════════════════════════════════════════════════════════════

export const messagingApi = {
  getConversation: (projectId: string) =>
    axiosClient.get(`/messaging/conversations/${projectId}`).then(r => r.data),

  getMessages: (projectId: string, page = 1) =>
    axiosClient.get<Message[]>(`/messaging/conversations/${projectId}/messages`, { params: { page } }).then(r => r.data),

  sendMessage: (projectId: string, data: { content: string; attachment_url?: string }) =>
    axiosClient.post(`/messaging/conversations/${projectId}/messages`, data).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// SAV
// ═══════════════════════════════════════════════════════════════

export const savApi = {
  getTickets: (params?: { status_filter?: string; project_id?: string }) =>
    axiosClient.get<SAVTicket[]>('/sav/tickets', { params }).then(r => r.data),

  createTicket: (data: any) =>
    axiosClient.post('/sav/tickets', data).then(r => r.data),

  getTicket: (id: string) =>
    axiosClient.get<SAVTicket>(`/sav/tickets/${id}`).then(r => r.data),

  replyTicket: (id: string, data: { content: string; is_internal?: boolean }) =>
    axiosClient.post(`/sav/tickets/${id}/replies`, data).then(r => r.data),

  assignTicket: (id: string, assigneeId: string) =>
    axiosClient.patch(`/sav/tickets/${id}/assign`, null, { params: { assignee_id: assigneeId } }).then(r => r.data),

  resolveTicket: (id: string) =>
    axiosClient.patch(`/sav/tickets/${id}/resolve`).then(r => r.data),

  rateTicket: (id: string, rating: number) =>
    axiosClient.patch(`/sav/tickets/${id}/rate`, null, { params: { rating } }).then(r => r.data),

  getStats: () =>
    axiosClient.get('/sav/stats').then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// AGENDA
// ═══════════════════════════════════════════════════════════════

export const agendaApi = {
  getAppointments: () =>
    axiosClient.get<Appointment[]>('/agenda/appointments').then(r => r.data),

  createAppointment: (data: any) =>
    axiosClient.post('/agenda/appointments', data).then(r => r.data),

  confirmAppointment: (id: string) =>
    axiosClient.patch(`/agenda/appointments/${id}/confirm`).then(r => r.data),

  cancelAppointment: (id: string) =>
    axiosClient.patch(`/agenda/appointments/${id}/cancel`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// QHSE
// ═══════════════════════════════════════════════════════════════

export const qhseApi = {
  getIncidents: (projectId?: string) =>
    axiosClient.get<QHSEIncident[]>('/qhse/incidents', { params: projectId ? { project_id: projectId } : {} }).then(r => r.data),

  createIncident: (data: any) =>
    axiosClient.post('/qhse/incidents', data).then(r => r.data),

  getAudits: () =>
    axiosClient.get('/qhse/audits').then(r => r.data),

  createAudit: (data: any) =>
    axiosClient.post('/qhse/audits', data).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT
// ═══════════════════════════════════════════════════════════════

export const equipmentApi = {
  list: () =>
    axiosClient.get<Equipment[]>('/equipment').then(r => r.data),

  create: (data: any) =>
    axiosClient.post('/equipment', data).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// SUBCONTRACTORS
// ═══════════════════════════════════════════════════════════════

export const subcontractorsApi = {
  list: () =>
    axiosClient.get<SubContractor[]>('/subcontractors').then(r => r.data),

  create: (data: any) =>
    axiosClient.post('/subcontractors', data).then(r => r.data),

  evaluate: (id: string, data: any) =>
    axiosClient.post(`/subcontractors/${id}/evaluate`, null, { params: data }).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// FINANCES
// ═══════════════════════════════════════════════════════════════

export const financesApi = {
  getProfitability: () =>
    axiosClient.get('/finances/profitability').then(r => r.data),

  addPettyCash: (data: { project_id: string; amount: number; description: string; category?: string }) =>
    axiosClient.post('/finances/petty-cash', null, { params: data }).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

export const notificationsApi = {
  list: () =>
    axiosClient.get<Notification[]>('/notifications').then(r => r.data),

  markRead: (id: string) =>
    axiosClient.patch(`/notifications/${id}/read`).then(r => r.data),

  markAllRead: () =>
    axiosClient.patch('/notifications/read-all').then(r => r.data),

  getUnreadCount: () =>
    axiosClient.get<{ count: number }>('/notifications/unread-count').then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════

export const activityApi = {
  getLogs: (params?: { action?: string; entity_type?: string; limit?: number }) =>
    axiosClient.get<ActivityLog[]>('/activity/logs', { params }).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// ADMIN USERS
// ═══════════════════════════════════════════════════════════════

export const usersApi = {
  list: () =>
    axiosClient.get<UserOut[]>('/admin/users').then(r => r.data),

  create: (data: { email: string; first_name: string; last_name: string; phone?: string; role?: string }) =>
    axiosClient.post('/admin/users', data).then(r => r.data),

  update: (id: string, data: any) =>
    axiosClient.patch(`/admin/users/${id}`, data).then(r => r.data),

  remove: (id: string) =>
    axiosClient.delete(`/admin/users/${id}`).then(r => r.data),

  resendInvitation: (id: string) =>
    axiosClient.post(`/admin/users/${id}/resend-invitation`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// CLIENT PORTAL
// ═══════════════════════════════════════════════════════════════

export const clientApi = {
  getProfile: () =>
    axiosClient.get('/client/profile').then(r => r.data),

  getProject: () =>
    axiosClient.get('/client/project').then(r => r.data),

  getTimeline: () =>
    axiosClient.get('/client/project/timeline').then(r => r.data),

  getGallery: () =>
    axiosClient.get('/client/project/gallery').then(r => r.data),

  getFinances: () =>
    axiosClient.get('/client/finances').then(r => r.data),

  payInvoice: (invoiceId: string, data: { amount: number; method?: string; reference?: string }) =>
    axiosClient.post(`/client/finances/${invoiceId}/pay`, data).then(r => r.data),

  getDocuments: () =>
    axiosClient.get('/client/documents').then(r => r.data),

  signDocument: (docId: string) =>
    axiosClient.post(`/client/documents/${docId}/sign-otp`).then(r => r.data),

  getMaterialChoices: () =>
    axiosClient.get('/client/material-choices').then(r => r.data),

  selectMaterial: (choiceId: string, selection: string) =>
    axiosClient.patch(`/client/material-choices/${choiceId}`, null, { params: { selection } }).then(r => r.data),

  getMessages: () =>
    axiosClient.get<Message[]>('/client/messages').then(r => r.data),

  sendMessage: (data: { content: string; attachment_url?: string }) =>
    axiosClient.post('/client/messages', data).then(r => r.data),

  getPlanning: () =>
    axiosClient.get('/client/planning').then(r => r.data),

  requestAppointment: (data: any) =>
    axiosClient.post('/client/appointments', data).then(r => r.data),

  getSAVTickets: () =>
    axiosClient.get('/client/sav/tickets').then(r => r.data),

  getNotifications: () =>
    axiosClient.get('/client/notifications').then(r => r.data),
};
