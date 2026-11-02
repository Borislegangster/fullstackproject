import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as clientApi from '../services/api/client.api';

// Profile
export const useClientProfile = () => {
  return useQuery({
    queryKey: ['client-profile'],
    queryFn: clientApi.getClientProfile,
  });
};

// Project
export const useClientProject = () => {
  return useQuery({
    queryKey: ['client-project'],
    queryFn: clientApi.getClientProject,
  });
};

export const useClientProjectTimeline = () => {
  return useQuery({
    queryKey: ['client-project-timeline'],
    queryFn: clientApi.getClientProjectTimeline,
  });
};

export const useClientProjectGallery = () => {
  return useQuery({
    queryKey: ['client-project-gallery'],
    queryFn: clientApi.getClientProjectGallery,
  });
};

/** Live snapshot for the dashboard widget. */
export const useClientProjectLive = () => {
  return useQuery({
    queryKey: ['client-project-live'],
    queryFn: clientApi.getClientProjectLive,
    refetchInterval: 60_000, // refresh every minute
  });
};

// Finances
export const useClientFinances = () => {
  return useQuery({
    queryKey: ['client-finances'],
    queryFn: clientApi.getClientFinances,
  });
};

export const useClientFinancesEvolution = () => {
  return useQuery({
    queryKey: ['client-finances-evolution'],
    queryFn: clientApi.getClientFinancesEvolution,
  });
};

export const useClientFinancesReceipts = () => {
  return useQuery({
    queryKey: ['client-finances-receipts'],
    queryFn: clientApi.getClientFinancesReceipts,
  });
};

export const useInitiatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, payload }: { invoiceId: string; payload: clientApi.PaymentPayload }) =>
      clientApi.initiatePayment(invoiceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-finances'] });
      queryClient.invalidateQueries({ queryKey: ['client-notifications'] });
    },
  });
};

/** Initiate a Flutterwave payment — returns checkout URL for redirect. */
export const useInitiateFlutterwavePayment = () => {
  return useMutation({
    mutationFn: (invoiceId: string) => clientApi.initiateFlutterwavePayment(invoiceId),
  });
};

/** Poll payment status by tx_ref (refetches every 3s while PENDING). */
export const usePaymentStatus = (txRef: string | null) => {
  return useQuery({
    queryKey: ['payment-status', txRef],
    queryFn: () => clientApi.getPaymentStatus(txRef!),
    enabled: !!txRef,
    refetchInterval: (query) => {
      const data = query.state.data as clientApi.PaymentStatusResponse | undefined;
      if (data && data.status !== 'PENDING') return false;
      return 3000; // poll every 3s while PENDING
    },
  });
};

// Documents
export const useClientDocuments = () => {
  return useQuery({
    queryKey: ['client-documents'],
    queryFn: clientApi.getClientDocuments,
  });
};

export const useUploadClientDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.uploadClientDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-documents'] });
    },
  });
};

export const useUploadClientDocumentFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      file: File;
      category?: string;
      notes?: string;
      onProgress?: (pct: number) => void;
    }) =>
      clientApi.uploadClientDocumentFile(vars.file, {
        category: vars.category,
        notes: vars.notes,
        onProgress: vars.onProgress,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-documents'] });
    },
  });
};

// Family / Guest access
export const useClientGuests = () => {
  return useQuery({
    queryKey: ['client-guests'],
    queryFn: clientApi.getClientGuests,
  });
};

export const useInviteClientGuest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.inviteClientGuest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-guests'] });
    },
  });
};

export const useRemoveClientGuest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.removeClientGuest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-guests'] });
    },
  });
};

export const useSignDocumentOTP = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, otp }: { id: string; otp?: string }) => clientApi.signDocumentOTP(id, otp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-documents'] });
    },
  });
};

export const useClientMaterialChoices = () => {
  return useQuery({ queryKey: ['client-material-choices'], queryFn: clientApi.getMaterialChoices });
};

export const useSubmitMaterialChoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.submitMaterialChoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-documents'] });
    },
  });
};

// Messages
export const useClientMessages = () => {
  // Phase 6: live WS invalidates this cache. Fallback polling lifted to 60 s.
  return useQuery({
    queryKey: ['client-messages'],
    queryFn: clientApi.getClientMessages,
    refetchInterval: 60_000,
  });
};

export const useSendClientMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.sendClientMessage,
    // Optimistic — push the message into the list immediately so the input
    // feels instant. The WS MESSAGE_CREATED broadcast (Phase 6) will also
    // invalidate the cache shortly after, replacing this temp entry with the
    // server-canonical row.
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: ['client-messages'] });
      const prev = queryClient.getQueryData<any[]>(['client-messages']);
      const optimistic = {
        id: `temp-${Date.now()}`,
        sender_id: 'me',
        content,
        created_at: new Date().toISOString(),
        is_system: false,
        attachment_url: null,
        _pending: true,
      };
      queryClient.setQueryData<any[]>(['client-messages'], [...(prev || []), optimistic]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['client-messages'], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['client-messages'] });
    },
  });
};

// Planning
export const useClientPlanning = () => {
  return useQuery({
    queryKey: ['client-planning'],
    queryFn: clientApi.getClientPlanning,
  });
};

export const useRequestAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.requestAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-planning'] });
    },
  });
};

// SAV
export const useClientSAVTickets = () => {
  return useQuery({
    queryKey: ['client-sav-tickets'],
    queryFn: clientApi.getClientSAVTickets,
  });
};

export const useCreateClientSAVTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.createClientSAVTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-sav-tickets'] });
    },
  });
};

export const useRateClientSAVTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) => clientApi.rateClientSAVTicket(id, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-sav-tickets'] });
    },
  });
};

// Notifications — Phase 6 WS live push handles real-time freshness.
export const useClientNotifications = () => {
  return useQuery({
    queryKey: ['client-notifications'],
    queryFn: clientApi.getClientNotifications,
    refetchInterval: 120_000,
  });
};

export const useClientUnreadCount = () => {
  return useQuery({
    queryKey: ['client-notifications', 'unread'],
    queryFn: async () => {
      const list = (await clientApi.getClientNotifications()) as any[];
      return Array.isArray(list) ? list.filter((n) => !n.is_read).length : 0;
    },
    refetchInterval: 120_000,
  });
};

export const useMarkClientNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.markClientNotificationRead,
    // Optimistic — the badge ticks down and the row mutes immediately.
    onMutate: async (notifId: string) => {
      await queryClient.cancelQueries({ queryKey: ['client-notifications'] });
      const prev = queryClient.getQueryData<any[]>(['client-notifications']);
      if (Array.isArray(prev)) {
        queryClient.setQueryData<any[]>(
          ['client-notifications'],
          prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['client-notifications'], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notifications'] });
    },
  });
};

export const useDeleteClientNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.deleteClientNotification,
    // Optimistic — the row disappears immediately, restored on error.
    onMutate: async (notifId: string) => {
      await queryClient.cancelQueries({ queryKey: ['client-notifications'] });
      const prev = queryClient.getQueryData<any[]>(['client-notifications']);
      if (Array.isArray(prev)) {
        queryClient.setQueryData<any[]>(
          ['client-notifications'],
          prev.filter((n) => String(n.id) !== String(notifId))
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['client-notifications'], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notifications'] });
    },
  });
};
