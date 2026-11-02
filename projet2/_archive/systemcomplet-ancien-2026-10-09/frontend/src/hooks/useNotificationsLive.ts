/**
 * useNotificationsLive — Subscribes to /ws/notifications for the current user.
 *
 * Whenever the server pushes a NOTIFICATION_CREATED packet, the React Query
 * caches for notifications + unreadCount are invalidated so every place that
 * reads them re-renders with the fresh data — no polling needed.
 *
 * Mount this once near the app root (or per layout). Returns { connected } so
 * the UI can show a small status dot if desired.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeWs } from './useRealtimeWs';
import { useAuth } from '../context/AuthContext';

export function useNotificationsLive() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();

  const { connected } = useRealtimeWs({
    path: '/ws/notifications',
    enabled: isAuthenticated,
    onPacket: (packet) => {
      if (!packet?.type) return;
      if (packet.type === 'NOTIFICATION_CREATED') {
        // Invalidate every list / count consumer (ERP + Client portal)
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['unreadCount'] });
        qc.invalidateQueries({ queryKey: ['client-notifications'] });
      }
    },
  });

  return { connected };
}
