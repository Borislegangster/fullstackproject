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

export const useClientProjectLive = () => {
  return useQuery({
    queryKey: ['client-project-live'],
    queryFn: clientApi.getClientProjectLive,
  });
};

// Finances
export const useClientFinances = () => {
  return useQuery({
    queryKey: ['client-finances'],
    queryFn: clientApi.getClientFinances,
  });
};

export const useInitiatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.initiatePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-finances'] });
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

export const useSignDocumentOTP = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, otp }: { id: string; otp: string }) => clientApi.signDocumentOTP(id, otp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-documents'] });
    },
  });
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
  return useQuery({
    queryKey: ['client-messages'],
    queryFn: clientApi.getClientMessages,
  });
};

export const useSendClientMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.sendClientMessage,
    onSuccess: () => {
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

// Notifications
export const useClientNotifications = () => {
  return useQuery({
    queryKey: ['client-notifications'],
    queryFn: clientApi.getClientNotifications,
  });
};

export const useMarkClientNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.markClientNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notifications'] });
    },
  });
};
