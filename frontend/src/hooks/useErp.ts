/**
 * React Query hooks for all ERP modules.
 * Each hook wraps erp.api.ts functions with proper caching, invalidation,
 * and error handling via React Query (TanStack Query).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  crmApi, projectsApi, invoicingApi, hrApi, procurementApi,
  gedApi, messagingApi, savApi, agendaApi, qhseApi, equipmentApi,
  subcontractorsApi, financesApi, notificationsApi, activityApi,
  usersApi, clientApi,
} from '../services/api/erp.api';

// ═══ CRM ═════════════════════════════════════════════════════

export function useLeads(status?: string) {
  return useQuery({ queryKey: ['leads', status], queryFn: () => crmApi.getLeads(status) });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crmApi.createLead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => crmApi.updateLead(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crmApi.deleteLead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => crmApi.convertLead(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// ═══ PROJECTS ════════════════════════════════════════════════

export function useProjects(status?: string) {
  return useQuery({ queryKey: ['projects', status], queryFn: () => projectsApi.list(status) });
}

export function useProject(id: string) {
  return useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id), enabled: !!id });
}

export function useProjectTimeline(id: string) {
  return useQuery({ queryKey: ['timeline', id], queryFn: () => projectsApi.getTimeline(id), enabled: !!id });
}

export function useProjectGallery(id: string) {
  return useQuery({ queryKey: ['gallery', id], queryFn: () => projectsApi.getGallery(id), enabled: !!id });
}

export function useProjectTemplates() {
  return useQuery({ queryKey: ['projectTemplates'], queryFn: projectsApi.getTemplates });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => projectsApi.update(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', vars.id] });
    },
  });
}

export function useUpdatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, phaseId, data }: { projectId: string; phaseId: string; data: any }) =>
      projectsApi.updatePhase(projectId, phaseId, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['timeline', vars.projectId] }),
  });
}

// ═══ INVOICING ═══════════════════════════════════════════════

export function useInvoices(params?: { project_id?: string; status_filter?: string }) {
  return useQuery({ queryKey: ['invoices', params], queryFn: () => invoicingApi.list(params) });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invoicingApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invoicingApi.send,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invoicingApi.markPaid,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invoicingApi.createPayment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

// ═══ HR ══════════════════════════════════════════════════════

export function useEmployees() {
  return useQuery({ queryKey: ['employees'], queryFn: hrApi.getEmployees });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hrApi.createEmployee,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useTempWorkers() {
  return useQuery({ queryKey: ['tempWorkers'], queryFn: hrApi.getTempWorkers });
}

export function useCreateTempWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hrApi.createTempWorker,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tempWorkers'] }),
  });
}

export function useRecordAttendance() {
  return useMutation({ mutationFn: hrApi.recordAttendance });
}

// ═══ PROCUREMENT ═════════════════════════════════════════════

export function usePurchaseRequests(status?: string) {
  return useQuery({ queryKey: ['purchaseRequests', status], queryFn: () => procurementApi.getPRs(status) });
}

export function useCreatePR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: procurementApi.createPR,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchaseRequests'] }),
  });
}

export function useValidatePR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: procurementApi.validatePR,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchaseRequests'] }),
  });
}

export function useStock() {
  return useQuery({ queryKey: ['stock'], queryFn: procurementApi.getStock });
}

export function useCreateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: procurementApi.createStockItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock'] }),
  });
}

// ═══ GED ═════════════════════════════════════════════════════

export function useDocuments(projectId: string, params?: { category?: string }) {
  return useQuery({
    queryKey: ['documents', projectId, params],
    queryFn: () => gedApi.getDocuments(projectId, params),
    enabled: !!projectId,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: gedApi.uploadDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useToggleDocumentShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: gedApi.toggleShare,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

// ═══ MESSAGING ═══════════════════════════════════════════════

export function useMessages(projectId: string) {
  return useQuery({
    queryKey: ['messages', projectId],
    queryFn: () => messagingApi.getMessages(projectId),
    enabled: !!projectId,
    refetchInterval: 10000, // Poll every 10s for new messages
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: { content: string } }) =>
      messagingApi.sendMessage(projectId, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['messages', vars.projectId] }),
  });
}

// ═══ SAV ═════════════════════════════════════════════════════

export function useSAVTickets(params?: { status_filter?: string }) {
  return useQuery({ queryKey: ['savTickets', params], queryFn: () => savApi.getTickets(params) });
}

export function useSAVTicket(id: string) {
  return useQuery({ queryKey: ['savTicket', id], queryFn: () => savApi.getTicket(id), enabled: !!id });
}

export function useCreateSAVTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: savApi.createTicket,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savTickets'] }),
  });
}

export function useReplySAVTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { content: string; is_internal?: boolean } }) =>
      savApi.replyTicket(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['savTicket', vars.id] });
      qc.invalidateQueries({ queryKey: ['savTickets'] });
    },
  });
}

export function useResolveSAVTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: savApi.resolveTicket,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savTickets'] }),
  });
}

export function useSAVStats() {
  return useQuery({ queryKey: ['savStats'], queryFn: savApi.getStats });
}

// ═══ AGENDA ══════════════════════════════════════════════════

export function useAppointments() {
  return useQuery({ queryKey: ['appointments'], queryFn: agendaApi.getAppointments });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: agendaApi.createAppointment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  });
}

export function useConfirmAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: agendaApi.confirmAppointment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  });
}

// ═══ QHSE ═══════════════════════════════════════════════════

export function useQHSEIncidents(projectId?: string) {
  return useQuery({ queryKey: ['qhseIncidents', projectId], queryFn: () => qhseApi.getIncidents(projectId) });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: qhseApi.createIncident,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qhseIncidents'] }),
  });
}

export function useQHSEAudits() {
  return useQuery({ queryKey: ['qhseAudits'], queryFn: qhseApi.getAudits });
}

// ═══ EQUIPMENT ═══════════════════════════════════════════════

export function useEquipment() {
  return useQuery({ queryKey: ['equipment'], queryFn: equipmentApi.list });
}

export function useCreateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: equipmentApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  });
}

// ═══ SUBCONTRACTORS ══════════════════════════════════════════

export function useSubcontractors() {
  return useQuery({ queryKey: ['subcontractors'], queryFn: subcontractorsApi.list });
}

export function useCreateSubcontractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: subcontractorsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcontractors'] }),
  });
}

// ═══ FINANCES ════════════════════════════════════════════════

export function useProfitability() {
  return useQuery({ queryKey: ['profitability'], queryFn: financesApi.getProfitability });
}

// ═══ NOTIFICATIONS ═══════════════════════════════════════════

export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list, refetchInterval: 30000 });
}

export function useUnreadCount() {
  return useQuery({ queryKey: ['unreadCount'], queryFn: notificationsApi.getUnreadCount, refetchInterval: 15000 });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
}

// ═══ ACTIVITY ════════════════════════════════════════════════

export function useActivityLogs(params?: { action?: string; entity_type?: string; limit?: number }) {
  return useQuery({ queryKey: ['activityLogs', params], queryFn: () => activityApi.getLogs(params) });
}

// ═══ ADMIN USERS ═════════════════════════════════════════════

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: usersApi.list });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// ═══ CLIENT PORTAL ═══════════════════════════════════════════

export function useClientProject() {
  return useQuery({ queryKey: ['clientProject'], queryFn: clientApi.getProject });
}

export function useClientTimeline() {
  return useQuery({ queryKey: ['clientTimeline'], queryFn: clientApi.getTimeline });
}

export function useClientGallery() {
  return useQuery({ queryKey: ['clientGallery'], queryFn: clientApi.getGallery });
}

export function useClientFinances() {
  return useQuery({ queryKey: ['clientFinances'], queryFn: clientApi.getFinances });
}

export function useClientDocuments() {
  return useQuery({ queryKey: ['clientDocuments'], queryFn: clientApi.getDocuments });
}

export function useClientMessages() {
  return useQuery({ queryKey: ['clientMessages'], queryFn: clientApi.getMessages, refetchInterval: 10000 });
}

export function useClientSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clientApi.sendMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientMessages'] }),
  });
}

export function useClientPlanning() {
  return useQuery({ queryKey: ['clientPlanning'], queryFn: clientApi.getPlanning });
}

export function useClientSAVTickets() {
  return useQuery({ queryKey: ['clientSAV'], queryFn: clientApi.getSAVTickets });
}

export function useClientNotifications() {
  return useQuery({ queryKey: ['clientNotifications'], queryFn: clientApi.getNotifications });
}

export function useClientPayInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: any }) => clientApi.payInvoice(invoiceId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientFinances'] }),
  });
}

export function useClientSignDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clientApi.signDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientDocuments'] }),
  });
}
