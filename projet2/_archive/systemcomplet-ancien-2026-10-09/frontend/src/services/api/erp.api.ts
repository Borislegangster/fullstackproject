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

  /** Real binary upload of a plan/document. */
  uploadDocumentFile: (vars: {
    file: File; project_id: string; name?: string; category?: string; note?: string;
    onProgress?: (pct: number) => void;
  }) => {
    const fd = new FormData();
    fd.append('file', vars.file);
    fd.append('project_id', vars.project_id);
    fd.append('name', vars.name || vars.file.name);
    fd.append('category', vars.category || 'general');
    fd.append('note', vars.note || '');
    return axiosClient
      .post('/ged/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (vars.onProgress && e.total) vars.onProgress(Math.round((e.loaded / e.total) * 100));
        },
      })
      .then(r => r.data);
  },

  /** Real binary upload as a new version of an existing document. */
  uploadDocumentVersionFile: (docId: string, file: File, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append('file', file);
    return axiosClient
      .post(`/ged/documents/${docId}/version-upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      })
      .then(r => r.data);
  },

  deleteDocument: (docId: string) =>
    axiosClient.delete(`/ged/documents/${docId}`).then(r => r.data),

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

  getWarranties: (projectId?: string) =>
    axiosClient.get('/sav/warranties', { params: projectId ? { project_id: projectId } : {} }).then(r => r.data),
  createWarranty: (data: any) =>
    axiosClient.post('/sav/warranties', data).then(r => r.data),
  deleteWarranty: (id: string) =>
    axiosClient.delete(`/sav/warranties/${id}`).then(r => r.data),
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

export interface CashflowPoint { month: string; inflow: number; outflow: number; net: number }

export const financesApi = {
  getProfitability: () =>
    axiosClient.get('/finances/profitability').then(r => r.data),

  cashflow: (months = 6) =>
    axiosClient.get<CashflowPoint[]>('/finances/cashflow', { params: { months } }).then(r => r.data),

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
// QHSE — EPI (équipements de protection individuelle)
// ═══════════════════════════════════════════════════════════════

export interface EPIDistribution {
  id: string;
  worker_id: string;
  worker_name: string;
  equipment_type: string;
  quantity: number;
  project_id: string | null;
  project_name: string;
  signed: boolean;
  distributed_at: string;
}

export const epiApi = {
  list: () =>
    axiosClient.get<EPIDistribution[]>('/qhse/epi').then(r => r.data).catch(() => []),
  create: (data: Partial<EPIDistribution>) =>
    axiosClient.post('/qhse/epi', data).then(r => r.data),
  stats: () =>
    axiosClient.get<{ type: string; quantity: number }[]>('/qhse/epi/stats').then(r => r.data).catch(() => []),
};

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT — Assignments (affectations chantier)
// ═══════════════════════════════════════════════════════════════

export interface EquipmentAssignment {
  id: string;
  equipment_id: string;
  equipment_name: string;
  project_id: string;
  project_name: string;
  responsible_id: string | null;
  responsible_name: string;
  assigned_from: string;
  assigned_to: string | null;
  status: string;
}

export const equipmentAssignmentsApi = {
  list: () =>
    axiosClient
      .get<EquipmentAssignment[]>('/equipment/assignments')
      .then(r => r.data)
      .catch(() => []),
  create: (data: Partial<EquipmentAssignment>) =>
    axiosClient.post('/equipment/assignments', data).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// FINANCES — Charges & Petty cash transactions
// ═══════════════════════════════════════════════════════════════

export interface Charge {
  id: string;
  category: string;
  description: string;
  amount: number;
  recurring: boolean;
  paid: boolean;
  due_date: string | null;
  created_at: string;
}

export interface PettyCashTransaction {
  id: string;
  project_id: string | null;
  project_name: string;
  amount: number;
  description: string;
  category: string;
  receipt_url: string | null;
  recorded_at: string;
}

export const chargesApi = {
  list: () =>
    axiosClient.get<Charge[]>('/finances/charges').then(r => r.data).catch(() => []),
  create: (data: Partial<Charge>) =>
    axiosClient.post('/finances/charges', data).then(r => r.data),
};

export const pettyCashApi = {
  list: () =>
    axiosClient
      .get<PettyCashTransaction[]>('/finances/petty-cash')
      .then(r => r.data)
      .catch(() => []),
  create: (data: { project_id?: string; amount: number; description: string; category?: string }) =>
    axiosClient.post('/finances/petty-cash', data).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// PLANNING — Gantt tasks
// ═══════════════════════════════════════════════════════════════

export interface PlanningTask {
  id: string;
  project_id: string;
  name: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  progress: number;
  status: string;
  depends_on: string | null;
  assignee_id: string | null;
}

export const planningApi = {
  list: (projectId?: string) =>
    axiosClient
      .get<PlanningTask[]>('/planning/tasks', { params: projectId ? { project_id: projectId } : {} })
      .then(r => r.data)
      .catch(() => []),
  create: (data: Partial<PlanningTask>) =>
    axiosClient.post('/planning/tasks', data).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// SUBCONTRACTORS — Invoices reçues
// ═══════════════════════════════════════════════════════════════

export interface SubcontractorInvoice {
  id: string;
  subcontractor_id: string;
  subcontractor_name: string;
  project_id: string | null;
  project_name: string;
  code: string;
  amount: number;
  status: string;
  issue_date: string;
  due_date: string | null;
}

export const subcontractorInvoicesApi = {
  list: () =>
    axiosClient
      .get<SubcontractorInvoice[]>('/subcontractors/invoices')
      .then(r => r.data)
      .catch(() => []),
  updateStatus: (id: string, status: string) =>
    axiosClient
      .patch(`/subcontractors/invoices/${id}/status`, { status })
      .then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// SAV — Assign helper (was missing from savApi)
// ═══════════════════════════════════════════════════════════════

export const savAssignApi = {
  assign: (id: string, assigneeId: string) =>
    axiosClient
      .patch(`/sav/tickets/${id}/assign`, { assignee_id: assigneeId })
      .then(r => r.data),
  byCategory: () =>
    axiosClient.get<{category: string; count: number}[]>('/sav/stats/by-category').then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// REPORTS / DASHBOARD (Phase 1)
// ═══════════════════════════════════════════════════════════════

export interface DashboardStats {
  active_projects: number;
  monthly_revenue: number;
  active_employees: number;
  open_sav_tickets: number;
  open_incidents: number;
  low_stock_items: number;
}

export interface DashboardAlert {
  type: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  link: string;
}

export interface RevenuePoint {
  month: string;
  revenue: number;
}

export interface MarginByProject {
  project_id: string;
  project_name: string;
  budget: number;
  spent: number;
  revenue: number;
  margin_pct: number;
}

export interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  frequency: string;
  recipients: string[];
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
}

export interface ExpenseBreakdownItem { category: string; label: string; amount: number; percentage: number }
export interface ProjectPerformanceItem {
  project_id: string; project_name: string; status: string;
  progress: number; budget_initial: number; budget_spent: number; budget_used_pct: number;
}
export interface ProjectTypeItem { type: string; count: number }

export const reportsApi = {
  dashboard: () => axiosClient.get<DashboardStats>('/reports/dashboard').then(r => r.data),
  alerts: () => axiosClient.get<DashboardAlert[]>('/reports/alerts').then(r => r.data),
  revenueByMonth: (months = 12) =>
    axiosClient.get<RevenuePoint[]>('/reports/revenue-by-month', { params: { months } }).then(r => r.data),
  marginByProject: () => axiosClient.get<MarginByProject[]>('/reports/margin-by-project').then(r => r.data),
  crmFunnel: () => axiosClient.get<{status: string; count: number}[]>('/reports/crm-funnel').then(r => r.data),
  expenseBreakdown: (projectId?: string) =>
    axiosClient.get<ExpenseBreakdownItem[]>('/reports/expense-breakdown', { params: projectId ? { project_id: projectId } : {} }).then(r => r.data),
  projectPerformance: () =>
    axiosClient.get<ProjectPerformanceItem[]>('/reports/project-performance').then(r => r.data),
  projectsByType: () =>
    axiosClient.get<ProjectTypeItem[]>('/reports/projects-by-type').then(r => r.data),
  scheduledList: () => axiosClient.get<ScheduledReport[]>('/reports/scheduled').then(r => r.data),
  scheduledCreate: (data: { name: string; report_type: string; frequency?: string; recipients?: string[] }) =>
    axiosClient.post('/reports/scheduled', data).then(r => r.data),
  scheduledToggle: (id: string) =>
    axiosClient.patch(`/reports/scheduled/${id}/toggle`).then(r => r.data),
  scheduledDelete: (id: string) =>
    axiosClient.delete(`/reports/scheduled/${id}`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT EXTRA (Phase 1)
// ═══════════════════════════════════════════════════════════════

export interface MaintenanceTicket {
  id: string;
  code: string;
  equipment_id: string;
  maintenance_type: string;
  description: string;
  cost: number;
  status: string;
  scheduled_for: string | null;
  completed_at: string | null;
  technician: string;
}

export const equipmentExtraApi = {
  get: (id: string) => axiosClient.get(`/equipment/${id}`).then(r => r.data),
  update: (id: string, data: any) => axiosClient.patch(`/equipment/${id}`, data).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`/equipment/${id}`).then(r => r.data),
  returnAssignment: (assignmentId: string) =>
    axiosClient.patch(`/equipment/assignments/${assignmentId}/return`).then(r => r.data),
  movements: (equipmentId?: string) =>
    axiosClient.get('/equipment/movements', { params: equipmentId ? { equipment_id: equipmentId } : {} })
      .then(r => r.data).catch(() => []),
  createMovement: (data: any) => axiosClient.post('/equipment/movements', data).then(r => r.data),
  maintenance: (params?: { equipment_id?: string; status_filter?: string }) =>
    axiosClient.get<MaintenanceTicket[]>('/equipment/maintenance', { params }).then(r => r.data).catch(() => []),
  createMaintenance: (data: any) => axiosClient.post('/equipment/maintenance', data).then(r => r.data),
  completeMaintenance: (id: string, cost?: number) =>
    axiosClient.patch(`/equipment/maintenance/${id}/complete`, null, { params: cost !== undefined ? { cost } : {} }).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// SUBCONTRACTORS EXTRA (Phase 1)
// ═══════════════════════════════════════════════════════════════

export const subcontractorsExtraApi = {
  get: (id: string) => axiosClient.get(`/subcontractors/${id}`).then(r => r.data),
  update: (id: string, data: any) => axiosClient.patch(`/subcontractors/${id}`, data).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`/subcontractors/${id}`).then(r => r.data),
  listContracts: (id: string) =>
    axiosClient.get(`/subcontractors/${id}/contracts`).then(r => r.data).catch(() => []),
  createContract: (id: string, data: any) =>
    axiosClient.post(`/subcontractors/${id}/contracts`, data).then(r => r.data),
  createSubInvoice: (data: any) =>
    axiosClient.post('/subcontractors/invoices', data).then(r => r.data),
  deleteSubInvoice: (id: string) =>
    axiosClient.delete(`/subcontractors/invoices/${id}`).then(r => r.data),
  // Situations de travaux (Phase 19)
  listSituations: () =>
    axiosClient.get('/subcontractors/situations').then(r => r.data),
  createSituation: (data: any) =>
    axiosClient.post('/subcontractors/situations', data).then(r => r.data),
  validateSituation: (id: string) =>
    axiosClient.patch(`/subcontractors/situations/${id}/validate`).then(r => r.data),
  refuseSituation: (id: string) =>
    axiosClient.patch(`/subcontractors/situations/${id}/refuse`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// HR EXTRA (Phase 1)
// ═══════════════════════════════════════════════════════════════

export interface PayrollItem {
  id: string;
  worker_type: string;
  worker_id: string;
  period: string;
  days_worked: number;
  base_amount: number;
  bonuses: number;
  deductions: number;
  advances: number;
  net_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface AttendanceSummaryPoint { date: string; present: number; late: number; absent: number }

export const hrExtraApi = {
  getEmployee: (id: string) => axiosClient.get(`/hr/employees/${id}`).then(r => r.data),
  updateEmployee: (id: string, data: any) => axiosClient.patch(`/hr/employees/${id}`, data).then(r => r.data),
  listPayroll: (params?: { period?: string; status_filter?: string }) =>
    axiosClient.get<PayrollItem[]>('/hr/payroll', { params }).then(r => r.data).catch(() => []),
  validatePayroll: (id: string) =>
    axiosClient.patch(`/hr/payroll/${id}/validate`).then(r => r.data),
  markPayrollPaid: (id: string) =>
    axiosClient.patch(`/hr/payroll/${id}/mark-paid`).then(r => r.data),
  attendanceSummary: (days = 7) =>
    axiosClient.get<AttendanceSummaryPoint[]>('/hr/attendance/summary', { params: { days } }).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// PROJECTS EXTRA (Phase 1)
// ═══════════════════════════════════════════════════════════════

export interface ResourceAllocationItem {
  project_id: string; project_name: string; workers: number; equipment: number; budget_used_pct: number;
}
export interface TeamAssignment {
  id: string; project_id: string; project_name: string;
  member_name: string; role: string; hours: number; status: string;
  worker_type: string; worker_id: string | null; assigned_at: string;
}

export const projectsExtraApi = {
  delete: (id: string) => axiosClient.delete(`/projects/${id}`).then(r => r.data),
  listExpenses: (id: string, category?: string) =>
    axiosClient.get(`/projects/${id}/expenses`, { params: category ? { category } : {} })
      .then(r => r.data).catch(() => []),
  addExpense: (id: string, data: any) =>
    axiosClient.post(`/projects/${id}/expenses`, data).then(r => r.data),
  addMedia: (id: string, data: any) =>
    axiosClient.post(`/projects/${id}/media`, data).then(r => r.data),
  deleteMedia: (projectId: string, mediaId: string) =>
    axiosClient.delete(`/projects/${projectId}/media/${mediaId}`).then(r => r.data),
  createTemplate: (data: { name: string; description?: string; phases?: any[] }) =>
    axiosClient.post('/projects/templates', data).then(r => r.data),
  deleteTemplate: (id: string) =>
    axiosClient.delete(`/projects/templates/${id}`).then(r => r.data),
  resourceAllocation: () =>
    axiosClient.get<ResourceAllocationItem[]>('/projects/resource-allocation').then(r => r.data),
  listTeamAssignments: (projectId?: string) =>
    axiosClient.get<TeamAssignment[]>('/projects/team-assignments', { params: projectId ? { project_id: projectId } : {} }).then(r => r.data),
  createTeamAssignment: (data: { project_id: string; member_name: string; role?: string; hours?: number; status?: string }) =>
    axiosClient.post('/projects/team-assignments', data).then(r => r.data),
  deleteTeamAssignment: (id: string) =>
    axiosClient.delete(`/projects/team-assignments/${id}`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// INVOICING EXTRA (Phase 1)
// ═══════════════════════════════════════════════════════════════

export const invoicingExtraApi = {
  get: (id: string) => axiosClient.get(`/invoices/${id}`).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`/invoices/${id}`).then(r => r.data),
  listPayments: (invoiceId?: string) =>
    axiosClient.get('/invoices/payments', { params: invoiceId ? { invoice_id: invoiceId } : {} })
      .then(r => r.data).catch(() => []),
  stats: () =>
    axiosClient.get<{
      total_paid: number; total_pending: number; total_overdue: number; invoice_count: number;
    }>('/invoices/stats/summary').then(r => r.data),
  aging: () =>
    axiosClient.get<{
      total_outstanding: number;
      buckets: { bucket: string; label: string; amount: number; count: number }[];
    }>('/invoices/stats/aging').then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// PROCUREMENT EXTRA (Phase 1)
// ═══════════════════════════════════════════════════════════════

export const procurementExtraApi = {
  deleteStockItem: (id: string) =>
    axiosClient.delete(`/procurement/stock/${id}`).then(r => r.data),
  stockMovements: (params?: { stock_item_id?: string; project_id?: string }) =>
    axiosClient.get('/procurement/stock/movements', { params }).then(r => r.data).catch(() => []),
  getPO: (id: string) =>
    axiosClient.get(`/procurement/purchase-orders/${id}`).then(r => r.data),
  receivePO: (id: string) =>
    axiosClient.patch(`/procurement/purchase-orders/${id}/receive`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// QHSE EXTRA (Phase 1)
// ═══════════════════════════════════════════════════════════════

export const qhseExtraApi = {
  getIncident: (id: string) => axiosClient.get(`/qhse/incidents/${id}`).then(r => r.data),
  updateIncident: (id: string, data: any) =>
    axiosClient.patch(`/qhse/incidents/${id}`, data).then(r => r.data),
  closeIncident: (id: string) =>
    axiosClient.patch(`/qhse/incidents/${id}/close`).then(r => r.data),
  getAudit: (id: string) => axiosClient.get(`/qhse/audits/${id}`).then(r => r.data),
  updateAudit: (id: string, data: any) =>
    axiosClient.patch(`/qhse/audits/${id}`, data).then(r => r.data),
  stats: () =>
    axiosClient.get<{
      open_incidents: number; severe_incidents: number; closed_incidents: number; completed_audits: number;
    }>('/qhse/stats').then(r => r.data).catch(() => ({
      open_incidents: 0, severe_incidents: 0, closed_incidents: 0, completed_audits: 0,
    })),
  // Safety briefings / toolbox talks (Phase 14)
  listBriefings: () =>
    axiosClient.get<SafetyBriefing[]>('/qhse/briefings').then(r => r.data),
  createBriefing: (data: {
    title: string; project_id?: string; site_label?: string; animator?: string;
    signed_count?: number; total_count?: number; status?: string;
  }) => axiosClient.post('/qhse/briefings', data).then(r => r.data),
  updateBriefing: (id: string, data: any) =>
    axiosClient.patch(`/qhse/briefings/${id}`, data).then(r => r.data),
  deleteBriefing: (id: string) =>
    axiosClient.delete(`/qhse/briefings/${id}`).then(r => r.data),
};

export interface SafetyBriefing {
  id: string; title: string; project_id: string | null; site_label: string;
  animator: string; signed_count: number; total_count: number; status: string;
  briefing_date: string; notes: string;
}

// ═══════════════════════════════════════════════════════════════
// QUOTES / DEVIS (Phase 14)
// ═══════════════════════════════════════════════════════════════

export interface Quote {
  id: string; code: string; lead_id: string | null;
  client_name: string; project_label: string; amount: number;
  lines: any[]; status: string; valid_until: string | null; notes: string;
  converted_invoice_id: string | null; created_at: string;
}

export const quotesApi = {
  list: (statusFilter?: string) =>
    axiosClient.get<Quote[]>('/quotes', { params: statusFilter ? { status_filter: statusFilter } : {} }).then(r => r.data),
  create: (data: { client_name?: string; project_label?: string; amount?: number; lines?: any[]; lead_id?: string; valid_until?: string; notes?: string }) =>
    axiosClient.post('/quotes', data).then(r => r.data),
  update: (id: string, data: any) =>
    axiosClient.patch(`/quotes/${id}`, data).then(r => r.data),
  revise: (id: string, data: { client_name?: string; project_label?: string; amount?: number; lines?: any[]; valid_until?: string; notes?: string; version_note?: string }) =>
    axiosClient.post(`/quotes/${id}/revise`, data).then(r => r.data),
  versions: (id: string) =>
    axiosClient.get(`/quotes/${id}/versions`).then(r => r.data),
  delete: (id: string) =>
    axiosClient.delete(`/quotes/${id}`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// PLANNING EXTRA (Phase 1)
// ═══════════════════════════════════════════════════════════════

export const planningExtraApi = {
  updateTask: (id: string, data: any) =>
    axiosClient.patch(`/planning/tasks/${id}`, data).then(r => r.data),
  deleteTask: (id: string) =>
    axiosClient.delete(`/planning/tasks/${id}`).then(r => r.data),
  listDependencies: (projectId?: string) =>
    axiosClient.get('/planning/dependencies', { params: projectId ? { project_id: projectId } : {} })
      .then(r => r.data).catch(() => []),
  createDependency: (data: any) =>
    axiosClient.post('/planning/dependencies', data).then(r => r.data),
  deleteDependency: (id: string) =>
    axiosClient.delete(`/planning/dependencies/${id}`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// DOCUMENT TEMPLATES (Phase 1)
// ═══════════════════════════════════════════════════════════════

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon_key: string;
  placeholders: any[];
  generated_count: number;
  is_active: boolean;
}

export interface GeneratedDocument {
  id: string;
  template_id: string;
  name: string;
  category: string;
  target_type: string;
  target_id: string | null;
  file_url: string;
  created_at: string;
}

export const templatesApi = {
  list: (category?: string) =>
    axiosClient.get<DocumentTemplate[]>('/templates', { params: category ? { category } : {} })
      .then(r => r.data).catch(() => []),
  get: (id: string) => axiosClient.get(`/templates/${id}`).then(r => r.data),
  create: (data: { name: string; description?: string; category?: string; icon_key?: string; template_body?: string; placeholders?: any[] }) =>
    axiosClient.post('/templates', data).then(r => r.data),
  update: (id: string, data: any) =>
    axiosClient.patch(`/templates/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    axiosClient.delete(`/templates/${id}`).then(r => r.data),
  generate: (templateId: string, data: { payload: any; target_type?: string; target_id?: string; name?: string }) =>
    axiosClient.post(`/templates/${templateId}/generate`, data).then(r => r.data),
  listGenerated: (params?: { target_type?: string; target_id?: string; category?: string }) =>
    axiosClient.get<GeneratedDocument[]>('/templates/generated/list', { params }).then(r => r.data).catch(() => []),
};

// ═══════════════════════════════════════════════════════════════
// USER PREFERENCES (Phase 1)
// ═══════════════════════════════════════════════════════════════

export const userPrefsApi = {
  get: () => axiosClient.get('/me/preferences').then(r => r.data).catch(() => ({})),
  update: (data: { notif_email?: any; notif_sms?: any; notif_push?: any; theme?: string; locale?: string }) =>
    axiosClient.patch('/me/preferences', data).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════
// ADMIN USERS EXTRA (Phase 1)
// ═══════════════════════════════════════════════════════════════

export const adminUsersExtraApi = {
  get: (id: string) => axiosClient.get(`/admin/users/${id}`).then(r => r.data),
  forceResetPassword: (id: string) =>
    axiosClient.post(`/admin/users/${id}/force-reset-password`).then(r => r.data),
};

// ── Company / site settings (ERP session, Phase 19) ──────────
export const companySettingsApi = {
  get: () => axiosClient.get('/admin/cms/settings').then(r => r.data),
  update: (data: any) => axiosClient.put('/admin/cms/settings', data).then(r => r.data),
};
