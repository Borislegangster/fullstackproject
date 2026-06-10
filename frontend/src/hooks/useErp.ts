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
  usersApi,
  // Phase 0 additions — endpoints to be implemented in Phase 1
  epiApi, equipmentAssignmentsApi, chargesApi, pettyCashApi,
  planningApi, subcontractorInvoicesApi, savAssignApi,
  // Phase 1 additions — new endpoints
  reportsApi, equipmentExtraApi, subcontractorsExtraApi,
  hrExtraApi, projectsExtraApi, invoicingExtraApi,
  procurementExtraApi, qhseExtraApi, planningExtraApi,
  templatesApi, userPrefsApi, adminUsersExtraApi,
  quotesApi, companySettingsApi,
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

export function useMaterialChoices(projectId: string) {
  return useQuery({
    queryKey: ['materialChoices', projectId],
    queryFn: () => gedApi.getMaterialChoices(projectId),
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

export function useUploadDocumentFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: gedApi.uploadDocumentFile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useUploadDocumentVersionFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { docId: string; file: File; onProgress?: (pct: number) => void }) =>
      gedApi.uploadDocumentVersionFile(vars.docId, vars.file, vars.onProgress),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: gedApi.deleteDocument,
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
    // Optimistic — the new bubble appears immediately. WS MESSAGE_CREATED
    // (Phase 6) replaces it with the server row on broadcast.
    onMutate: async ({ projectId, data }) => {
      await qc.cancelQueries({ queryKey: ['messages', projectId] });
      const prev = qc.getQueryData<any[]>(['messages', projectId]);
      const optimistic = {
        id: `temp-${Date.now()}`,
        sender_id: 'me',
        content: data.content,
        is_system: false,
        attachment_url: null,
        created_at: new Date().toISOString(),
        _pending: true,
      };
      qc.setQueryData<any[]>(['messages', projectId], [...(prev || []), optimistic]);
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['messages', vars.projectId], ctx.prev);
    },
    onSettled: (_data, _err, vars) => qc.invalidateQueries({ queryKey: ['messages', vars.projectId] }),
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
  // Phase 6: live WS subscription invalidates this cache automatically — fallback
  // poll is still set so the UI never stalls if WS fails for >2 min.
  return useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list, refetchInterval: 120_000 });
}

export function useUnreadCount() {
  return useQuery({ queryKey: ['unreadCount'], queryFn: notificationsApi.getUnreadCount, refetchInterval: 120_000 });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    // Optimistic update — the dot disappears instantly, the counter ticks down
    onMutate: async (notifId: string) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      await qc.cancelQueries({ queryKey: ['unreadCount'] });
      const prevList = qc.getQueryData<any[]>(['notifications']);
      const prevCount = qc.getQueryData<{ count: number }>(['unreadCount']);
      if (Array.isArray(prevList)) {
        qc.setQueryData<any[]>(['notifications'], prevList.map((n) =>
          n.id === notifId ? { ...n, is_read: true } : n
        ));
      }
      if (prevCount && typeof prevCount.count === 'number') {
        qc.setQueryData(['unreadCount'], { count: Math.max(0, prevCount.count - 1) });
      }
      return { prevList, prevCount };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevList) qc.setQueryData(['notifications'], ctx.prevList);
      if (ctx?.prevCount) qc.setQueryData(['unreadCount'], ctx.prevCount);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      await qc.cancelQueries({ queryKey: ['unreadCount'] });
      const prevList = qc.getQueryData<any[]>(['notifications']);
      const prevCount = qc.getQueryData<{ count: number }>(['unreadCount']);
      if (Array.isArray(prevList)) {
        qc.setQueryData<any[]>(['notifications'], prevList.map((n) => ({ ...n, is_read: true })));
      }
      qc.setQueryData(['unreadCount'], { count: 0 });
      return { prevList, prevCount };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevList) qc.setQueryData(['notifications'], ctx.prevList);
      if (ctx?.prevCount) qc.setQueryData(['unreadCount'], ctx.prevCount);
    },
    onSettled: () => {
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
// Client-portal hooks live in hooks/useClient.ts (the single source used by
// the espace-client pages). The duplicated copies that used to live here were
// removed in Phase 16 — import from '../hooks/useClient' instead.

// ═══════════════════════════════════════════════════════════════
// PHASE 0 — Aliases & stubs to unblock ERP pages
//
// These hooks are imported by ErpQHSE, ErpMateriel, ErpFinances,
// ErpPlanification, ErpAgenda, ErpSAV, ErpSousTraitants.
// They wire onto endpoints that will be fully implemented in Phase 1.
// In the meantime, the underlying API helpers return [] on 404 so the
// pages render an empty state instead of crashing.
// ═══════════════════════════════════════════════════════════════

// ── QHSE aliases & EPI ───────────────────────────────────────

/** Alias of useQHSEIncidents — matches the name used in ErpQHSE.tsx */
export function useIncidents(projectId?: string) {
  return useQHSEIncidents(projectId);
}

export function useEPIData() {
  return useQuery({ queryKey: ['epi'], queryFn: epiApi.list });
}

export function useCreateEPIDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: epiApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['epi'] });
      qc.invalidateQueries({ queryKey: ['epiStats'] });
    },
  });
}

export function useEPIStats() {
  return useQuery({ queryKey: ['epiStats'], queryFn: epiApi.stats });
}

// ── Equipment assignments ────────────────────────────────────

export function useEquipmentAssignments() {
  return useQuery({
    queryKey: ['equipmentAssignments'],
    queryFn: equipmentAssignmentsApi.list,
  });
}

export function useCreateEquipmentAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: equipmentAssignmentsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipmentAssignments'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
}

// ── Finances — Project profitability, charges, petty cash ────

/** Alias of useProfitability — matches the name used in ErpFinances.tsx */
export function useFinancesProjects() {
  return useProfitability();
}

export function useCharges() {
  return useQuery({ queryKey: ['charges'], queryFn: chargesApi.list });
}

export function useCreateCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chargesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charges'] }),
  });
}

export function usePettyCashTransactions() {
  return useQuery({ queryKey: ['pettyCash'], queryFn: pettyCashApi.list });
}

export function useCreatePettyCashTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pettyCashApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pettyCash'] }),
  });
}

// ── Planning — Gantt tasks ───────────────────────────────────

export function usePlanningTasks(projectId?: string) {
  return useQuery({
    queryKey: ['planningTasks', projectId],
    queryFn: () => planningApi.list(projectId),
  });
}

export function useCreatePlanningTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: planningApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planningTasks'] }),
  });
}

// ── Agenda aliases (events == appointments in this app) ──────

/** Alias of useAppointments — matches the name used in ErpAgenda.tsx */
export function useEvents() {
  return useAppointments();
}

/** Alias of useCreateAppointment — matches the name used in ErpAgenda.tsx */
export function useCreateEvent() {
  return useCreateAppointment();
}

// ── SAV — Assign ticket ──────────────────────────────────────

export function useAssignSAVTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string }) =>
      savAssignApi.assign(id, assigneeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savTickets'] }),
  });
}

// ── Subcontractor invoices ───────────────────────────────────

export function useSubcontractorInvoices() {
  return useQuery({
    queryKey: ['subcontractorInvoices'],
    queryFn: subcontractorInvoicesApi.list,
  });
}

export function useUpdateSubcontractorInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      subcontractorInvoicesApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcontractorInvoices'] }),
  });
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1 — Full hook coverage of Phase 1 backend endpoints
// ═══════════════════════════════════════════════════════════════

// ── Reports / Dashboard ──────────────────────────────────────

export function useDashboardStats() {
  return useQuery({ queryKey: ['dashboardStats'], queryFn: reportsApi.dashboard, refetchInterval: 60000 });
}

export function useDashboardAlerts() {
  return useQuery({ queryKey: ['dashboardAlerts'], queryFn: reportsApi.alerts, refetchInterval: 60000 });
}

export function useRevenueByMonth(months = 12) {
  return useQuery({ queryKey: ['revenueByMonth', months], queryFn: () => reportsApi.revenueByMonth(months) });
}

export function useMarginByProject() {
  return useQuery({ queryKey: ['marginByProject'], queryFn: reportsApi.marginByProject });
}

export function useCrmFunnel() {
  return useQuery({ queryKey: ['crmFunnel'], queryFn: reportsApi.crmFunnel });
}

// ── Analytics charts (Phase 11 endpoints) ────────────────────

export function useExpenseBreakdown(projectId?: string) {
  return useQuery({
    queryKey: ['expenseBreakdown', projectId],
    queryFn: () => reportsApi.expenseBreakdown(projectId),
  });
}

export function useProjectPerformance() {
  return useQuery({ queryKey: ['projectPerformance'], queryFn: reportsApi.projectPerformance });
}

export function useProjectsByType() {
  return useQuery({ queryKey: ['projectsByType'], queryFn: reportsApi.projectsByType });
}

export function useCashflow(months = 6) {
  return useQuery({ queryKey: ['cashflow', months], queryFn: () => financesApi.cashflow(months) });
}

export function useInvoiceAging() {
  return useQuery({ queryKey: ['invoiceAging'], queryFn: invoicingExtraApi.aging });
}

export function useResourceAllocation() {
  return useQuery({ queryKey: ['resourceAllocation'], queryFn: projectsExtraApi.resourceAllocation });
}

export function useAttendanceSummary(days = 7) {
  return useQuery({ queryKey: ['attendanceSummary', days], queryFn: () => hrExtraApi.attendanceSummary(days) });
}

// ── Project team assignments (Phase 13) ──────────────────────

export function useTeamAssignments(projectId?: string) {
  return useQuery({
    queryKey: ['teamAssignments', projectId],
    queryFn: () => projectsExtraApi.listTeamAssignments(projectId),
  });
}

export function useCreateTeamAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsExtraApi.createTeamAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamAssignments'] }),
  });
}

export function useDeleteTeamAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsExtraApi.deleteTeamAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamAssignments'] }),
  });
}

// ── Quotes / Devis (Phase 14) ────────────────────────────────

export function useQuotes(statusFilter?: string) {
  return useQuery({ queryKey: ['quotes', statusFilter], queryFn: () => quotesApi.list(statusFilter) });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: quotesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => quotesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: quotesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
}

export function useReviseQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { client_name?: string; project_label?: string; amount?: number; lines?: any[]; notes?: string; version_note?: string } }) =>
      quotesApi.revise(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
}

export function useQuoteVersions(quoteId: string | null) {
  return useQuery({
    queryKey: ['quote-versions', quoteId],
    queryFn: () => quotesApi.versions(quoteId!),
    enabled: !!quoteId,
  });
}

// ── QHSE safety briefings (Phase 14) ─────────────────────────

export function useBriefings() {
  return useQuery({ queryKey: ['briefings'], queryFn: qhseExtraApi.listBriefings });
}

export function useCreateBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: qhseExtraApi.createBriefing,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['briefings'] }),
  });
}

export function useUpdateBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => qhseExtraApi.updateBriefing(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['briefings'] }),
  });
}

export function useDeleteBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: qhseExtraApi.deleteBriefing,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['briefings'] }),
  });
}

export function useScheduledReports() {
  return useQuery({ queryKey: ['scheduledReports'], queryFn: reportsApi.scheduledList });
}

export function useCreateScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportsApi.scheduledCreate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduledReports'] }),
  });
}

export function useToggleScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportsApi.scheduledToggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduledReports'] }),
  });
}

export function useDeleteScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportsApi.scheduledDelete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduledReports'] }),
  });
}

// ── Equipment extra ──────────────────────────────────────────

export function useEquipmentDetail(id: string) {
  return useQuery({
    queryKey: ['equipment', id],
    queryFn: () => equipmentExtraApi.get(id),
    enabled: !!id,
  });
}

export function useUpdateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => equipmentExtraApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  });
}

export function useDeleteEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: equipmentExtraApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  });
}

export function useReturnEquipmentAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: equipmentExtraApi.returnAssignment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipmentAssignments'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
}

export function useEquipmentMovements(equipmentId?: string) {
  return useQuery({
    queryKey: ['equipmentMovements', equipmentId],
    queryFn: () => equipmentExtraApi.movements(equipmentId),
  });
}

export function useCreateEquipmentMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: equipmentExtraApi.createMovement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipmentMovements'] }),
  });
}

export function useMaintenance(params?: { equipment_id?: string; status_filter?: string }) {
  return useQuery({
    queryKey: ['maintenance', params],
    queryFn: () => equipmentExtraApi.maintenance(params),
  });
}

export function useCreateMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: equipmentExtraApi.createMaintenance,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
}

export function useCompleteMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cost }: { id: string; cost?: number }) =>
      equipmentExtraApi.completeMaintenance(id, cost),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
}

// ── Subcontractors extra ─────────────────────────────────────

export function useSubcontractorDetail(id: string) {
  return useQuery({
    queryKey: ['subcontractor', id],
    queryFn: () => subcontractorsExtraApi.get(id),
    enabled: !!id,
  });
}

export function useUpdateSubcontractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => subcontractorsExtraApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcontractors'] }),
  });
}

export function useDeleteSubcontractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: subcontractorsExtraApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcontractors'] }),
  });
}

export function useSubcontractorContracts(subId: string) {
  return useQuery({
    queryKey: ['subcontractorContracts', subId],
    queryFn: () => subcontractorsExtraApi.listContracts(subId),
    enabled: !!subId,
  });
}

export function useCreateSubcontractorContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subId, data }: { subId: string; data: any }) =>
      subcontractorsExtraApi.createContract(subId, data),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['subcontractorContracts', vars.subId] }),
  });
}

export function useCreateSubcontractorInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: subcontractorsExtraApi.createSubInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcontractorInvoices'] }),
  });
}

export function useEvaluateSubcontractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subId, data }: { subId: string; data: { project_id: string; quality: number; timeliness: number; communication: number; comments?: string } }) =>
      subcontractorsApi.evaluate(subId, data as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcontractors'] }),
  });
}

// ── HR extra ─────────────────────────────────────────────────

export function useEmployeeDetail(id: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => hrExtraApi.getEmployee(id),
    enabled: !!id,
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => hrExtraApi.updateEmployee(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hrApi.deleteEmployee,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function usePayrollList(params?: { period?: string; status_filter?: string }) {
  return useQuery({
    queryKey: ['payrollList', params],
    queryFn: () => hrExtraApi.listPayroll(params),
  });
}

export function useValidatePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hrExtraApi.validatePayroll,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payrollList'] }),
  });
}

export function useMarkPayrollPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hrExtraApi.markPayrollPaid,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payrollList'] }),
  });
}

export function useGeneratePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hrApi.generatePayroll,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payrollList'] }),
  });
}

export function useAttendance(params?: { project_id?: string }) {
  return useQuery({
    queryKey: ['attendance', params],
    queryFn: () => hrApi.getAttendance(params),
  });
}

// ── Projects extra ───────────────────────────────────────────

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsExtraApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useProjectExpenses(id: string, category?: string) {
  return useQuery({
    queryKey: ['projectExpenses', id, category],
    queryFn: () => projectsExtraApi.listExpenses(id, category),
    enabled: !!id,
  });
}

export function useAddProjectExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => projectsExtraApi.addExpense(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['projectExpenses', vars.id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['profitability'] });
    },
  });
}

export function useAddProjectMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => projectsExtraApi.addMedia(id, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['gallery', vars.id] }),
  });
}

export function useDeleteProjectMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, mediaId }: { projectId: string; mediaId: string }) =>
      projectsExtraApi.deleteMedia(projectId, mediaId),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['gallery', vars.projectId] }),
  });
}

export function useCreateProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsExtraApi.createTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projectTemplates'] }),
  });
}

export function useDeleteProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsExtraApi.deleteTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projectTemplates'] }),
  });
}

// ── Invoicing extra ──────────────────────────────────────────

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicingExtraApi.get(id),
    enabled: !!id,
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invoicingExtraApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useInvoicePayments(invoiceId?: string) {
  return useQuery({
    queryKey: ['invoicePayments', invoiceId],
    queryFn: () => invoicingExtraApi.listPayments(invoiceId),
  });
}

export function useInvoicingStats() {
  return useQuery({ queryKey: ['invoicingStats'], queryFn: invoicingExtraApi.stats });
}

export function useRemindInvoice() {
  return useMutation({ mutationFn: invoicingApi.remind });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => invoicingApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

// ── Procurement extra ────────────────────────────────────────

export function useDeleteStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: procurementExtraApi.deleteStockItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock'] }),
  });
}

export function useStockMovements(params?: { stock_item_id?: string; project_id?: string }) {
  return useQuery({
    queryKey: ['stockMovements', params],
    queryFn: () => procurementExtraApi.stockMovements(params),
  });
}

export function useCreateStockMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: procurementApi.createMovement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['stockMovements'] });
    },
  });
}

export function usePurchaseOrders() {
  return useQuery({ queryKey: ['purchaseOrders'], queryFn: procurementApi.getPOs });
}

export function useReceivePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: procurementExtraApi.receivePO,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useRejectPR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => procurementApi.rejectPR(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchaseRequests'] }),
  });
}

// ── QHSE extra ───────────────────────────────────────────────

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => qhseExtraApi.updateIncident(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qhseIncidents'] }),
  });
}

export function useCloseIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: qhseExtraApi.closeIncident,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qhseIncidents'] }),
  });
}

export function useUpdateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => qhseExtraApi.updateAudit(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qhseAudits'] }),
  });
}

export function useCreateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: qhseApi.createAudit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qhseAudits'] }),
  });
}

export function useQHSEStats() {
  return useQuery({ queryKey: ['qhseStats'], queryFn: qhseExtraApi.stats });
}

export function useSAVByCategory() {
  return useQuery({ queryKey: ['savByCategory'], queryFn: savAssignApi.byCategory });
}

// ── Planning extra ───────────────────────────────────────────

export function useUpdatePlanningTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => planningExtraApi.updateTask(id, data),
    // Optimistic — status/progress toggles feel instant. Common case:
    // marking a daily task done from the planning UI.
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ['planningTasks'] });
      const prev = qc.getQueriesData<any[]>({ queryKey: ['planningTasks'] });
      prev.forEach(([key, value]) => {
        if (!Array.isArray(value)) return;
        qc.setQueryData(key, value.map((t: any) => (t.id === id ? { ...t, ...data } : t)));
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.prev?.forEach(([key, value]) => qc.setQueryData(key, value));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['planningTasks'] }),
  });
}

export function useDeletePlanningTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: planningExtraApi.deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planningTasks'] }),
  });
}

export function usePlanningDependencies(projectId?: string) {
  return useQuery({
    queryKey: ['planningDependencies', projectId],
    queryFn: () => planningExtraApi.listDependencies(projectId),
  });
}

export function useCreatePlanningDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: planningExtraApi.createDependency,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planningDependencies'] }),
  });
}

export function useDeletePlanningDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: planningExtraApi.deleteDependency,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planningDependencies'] }),
  });
}

// ── Document templates ───────────────────────────────────────

export function useDocumentTemplates(category?: string) {
  return useQuery({
    queryKey: ['documentTemplates', category],
    queryFn: () => templatesApi.list(category),
  });
}

export function useCreateDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: templatesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documentTemplates'] }),
  });
}

export function useUpdateDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => templatesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documentTemplates'] }),
  });
}

export function useDeleteDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: templatesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documentTemplates'] }),
  });
}

export function useGenerateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: any }) =>
      templatesApi.generate(templateId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documentTemplates'] });
      qc.invalidateQueries({ queryKey: ['generatedDocuments'] });
    },
  });
}

export function useGeneratedDocuments(params?: { target_type?: string; target_id?: string; category?: string }) {
  return useQuery({
    queryKey: ['generatedDocuments', params],
    queryFn: () => templatesApi.listGenerated(params),
  });
}

// ── User preferences ─────────────────────────────────────────

export function useUserPrefs() {
  return useQuery({ queryKey: ['userPrefs'], queryFn: userPrefsApi.get });
}

export function useUpdateUserPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: userPrefsApi.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['userPrefs'] }),
  });
}

// ── Admin users extra ────────────────────────────────────────

export function useAdminUserDetail(id: string) {
  return useQuery({
    queryKey: ['adminUser', id],
    queryFn: () => adminUsersExtraApi.get(id),
    enabled: !!id,
  });
}

export function useForceResetPassword() {
  return useMutation({ mutationFn: adminUsersExtraApi.forceResetPassword });
}

export function useResendInvitation() {
  return useMutation({ mutationFn: usersApi.resendInvitation });
}

// ── Re-exports for convenience (no transformation) ──────────

export function useCreateSubcontract() {
  return useCreateSubcontractorContract();
}

/** GET /invoices/{id} typed as 'fullInvoice' alias */
export function useFullInvoice(id: string) {
  return useInvoice(id);
}

// ═══ COMPANY SETTINGS (Phase 19) ═════════════════════════════
export function useCompanySettings() {
  return useQuery({ queryKey: ['company-settings'], queryFn: companySettingsApi.get });
}
export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: companySettingsApi.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-settings'] }),
  });
}

// ═══ SAV WARRANTIES (Phase 19) ═══════════════════════════════
export function useWarranties(projectId?: string) {
  return useQuery({ queryKey: ['warranties', projectId], queryFn: () => savApi.getWarranties(projectId) });
}
export function useCreateWarranty() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: savApi.createWarranty, onSuccess: () => qc.invalidateQueries({ queryKey: ['warranties'] }) });
}
export function useDeleteWarranty() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: savApi.deleteWarranty, onSuccess: () => qc.invalidateQueries({ queryKey: ['warranties'] }) });
}

// ═══ SUBCONTRACTOR SITUATIONS (Phase 19) ═════════════════════
export function useSubcontractorSituations() {
  return useQuery({ queryKey: ['subSituations'], queryFn: subcontractorsExtraApi.listSituations });
}
export function useCreateSituation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: subcontractorsExtraApi.createSituation, onSuccess: () => qc.invalidateQueries({ queryKey: ['subSituations'] }) });
}
export function useValidateSituation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: subcontractorsExtraApi.validateSituation, onSuccess: () => qc.invalidateQueries({ queryKey: ['subSituations'] }) });
}
export function useRefuseSituation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: subcontractorsExtraApi.refuseSituation, onSuccess: () => qc.invalidateQueries({ queryKey: ['subSituations'] }) });
}
