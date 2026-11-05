/**
 * Collaboration API — REST helpers for the Bureau d'Études Virtuel.
 *
 * The WebSocket channel for live broadcast is handled separately by
 * useCollaboration() hook (src/hooks/useCollaboration.ts).
 */
import { axiosClient } from './axiosClient';

// ── Types ────────────────────────────────────────────────────

export interface CollaborationSession {
  id: string;
  project_id: string;
  plan_urn: string;
  status: 'ACTIVE' | 'ENDED';
  mode: 'FREE' | 'PRESENTER';
  presenter_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  participants?: Participant[];
}

export interface Participant {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface SessionAnnotation {
  id: string;
  author_id: string;
  author_role: string;
  layer: string;
  markup_data: any;
  is_validated: boolean;
  validated_by?: string | null;
  created_at: string;
}

export interface SessionSnapshot {
  id: string;
  image_url: string;
  notes: string;
  shared_with_client: boolean;
  captured_by: string;
  created_at: string;
}

export interface APSToken {
  access_token: string;
  expires_in: number;
}

export interface TranslationStatus {
  status: 'success' | 'inprogress' | 'failed' | 'not_started' | 'pending' | string;
  progress: string;
  derivatives?: any[];
}

// ── REST endpoints ───────────────────────────────────────────

export const collaborationApi = {
  // Sessions
  createSession: (data: { project_id: string; plan_urn: string; invited_user_ids?: string[] }) =>
    axiosClient.post<{ session_id: string; plan_urn: string; status: string }>(
      '/collaboration/sessions', data
    ).then(r => r.data),

  listSessions: (projectId?: string) =>
    axiosClient.get<CollaborationSession[]>('/collaboration/sessions', {
      params: projectId ? { project_id: projectId } : {},
    }).then(r => r.data).catch(() => []),

  getSession: (id: string) =>
    axiosClient.get<CollaborationSession>(`/collaboration/sessions/${id}`).then(r => r.data),

  endSession: (id: string) =>
    axiosClient.post(`/collaboration/sessions/${id}/end`).then(r => r.data),

  // Annotations
  listAnnotations: (sessionId: string) =>
    axiosClient.get<SessionAnnotation[]>(
      `/collaboration/sessions/${sessionId}/annotations`
    ).then(r => r.data).catch(() => []),

  validateAnnotation: (sessionId: string, annotationId: string) =>
    axiosClient.post(
      `/collaboration/sessions/${sessionId}/annotations/${annotationId}/validate`
    ).then(r => r.data),

  // Snapshots
  takeSnapshot: (sessionId: string, data: { image_url: string; notes?: string; shared_with_client?: boolean }) =>
    axiosClient.post<{ snapshot_id: string }>(
      `/collaboration/sessions/${sessionId}/snapshot`, data
    ).then(r => r.data),

  listSnapshots: (sessionId: string) =>
    axiosClient.get<SessionSnapshot[]>(
      `/collaboration/sessions/${sessionId}/snapshots`
    ).then(r => r.data).catch(() => []),

  toggleSnapshotShare: (snapshotId: string) =>
    axiosClient.patch<{ shared_with_client: boolean }>(
      `/collaboration/snapshots/${snapshotId}/share`
    ).then(r => r.data),

  // APS
  getApsToken: () =>
    axiosClient.get<APSToken>('/collaboration/aps-token').then(r => r.data),

  uploadBim: (projectId: string, file: File) => {
    const form = new FormData();
    form.append('project_id', projectId);
    form.append('file', file);
    return axiosClient
      .post<{ urn: string; filename: string; translation_started: boolean }>(
        '/collaboration/upload-bim',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      .then(r => r.data);
  },

  getTranslationStatus: (urn: string) =>
    axiosClient.get<TranslationStatus>(
      `/collaboration/translation-status/${urn}`
    ).then(r => r.data),
};
