import { axiosInstance } from './axiosClient';

// Profile
export const getClientProfile = async () => {
  const res = await axiosInstance.get('/client/profile');
  return res.data;
};

// Project
export const getClientProject = async () => {
  const res = await axiosInstance.get('/client/project');
  return res.data;
};

export const getClientProjectTimeline = async () => {
  const res = await axiosInstance.get('/client/project/timeline');
  return res.data;
};

export const getClientProjectGallery = async () => {
  const res = await axiosInstance.get('/client/project/gallery');
  return res.data;
};

export const getClientProjectLive = async () => {
  const res = await axiosInstance.get('/client/project/live');
  return res.data;
};

// Finances
export const getClientFinances = async () => {
  const res = await axiosInstance.get('/client/finances');
  return res.data;
};

export const initiatePayment = async (invoiceId: string) => {
  const res = await axiosInstance.post(`/client/finances/${invoiceId}/pay`);
  return res.data;
};

// Documents
export const getClientDocuments = async () => {
  const res = await axiosInstance.get('/client/documents');
  return res.data;
};

export const uploadClientDocument = async (formData: FormData) => {
  const res = await axiosInstance.post('/client/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const signDocumentOTP = async (id: string, otp: string) => {
  const res = await axiosInstance.post(`/client/documents/${id}/sign-otp`, { otp });
  return res.data;
};

export const submitMaterialChoice = async (data: any) => {
  const res = await axiosInstance.post('/client/material-choices', data);
  return res.data;
};

// Messages
export const getClientMessages = async () => {
  const res = await axiosInstance.get('/client/messages');
  return res.data;
};

export const sendClientMessage = async (content: string) => {
  const res = await axiosInstance.post('/client/messages', { content });
  return res.data;
};

// Planning
export const getClientPlanning = async () => {
  const res = await axiosInstance.get('/client/planning');
  return res.data;
};

export const requestAppointment = async (data: any) => {
  const res = await axiosInstance.post('/client/appointments', data);
  return res.data;
};

// SAV
export const getClientSAVTickets = async () => {
  const res = await axiosInstance.get('/client/sav/tickets');
  return res.data;
};

export const createClientSAVTicket = async (data: any) => {
  const res = await axiosInstance.post('/client/sav/tickets', data);
  return res.data;
};

export const rateClientSAVTicket = async (id: string, rating: number) => {
  const res = await axiosInstance.post(`/client/sav/tickets/${id}/rate`, { rating });
  return res.data;
};

// Notifications
export const getClientNotifications = async () => {
  const res = await axiosInstance.get('/client/notifications');
  return res.data;
};

export const markClientNotificationRead = async (id: string) => {
  const res = await axiosInstance.patch(`/client/notifications/${id}/read`);
  return res.data;
};
