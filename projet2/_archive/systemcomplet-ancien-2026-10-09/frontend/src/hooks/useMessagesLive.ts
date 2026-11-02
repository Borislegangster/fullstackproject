/**
 * useMessagesLive — Subscribes to /ws/messaging/{projectId} for a given thread.
 *
 * Use cases:
 *   - ERP staff opens a project conversation → mount with projectId.
 *   - Client portal opens their thread → projectId pulled from the project.
 *
 * Side effects:
 *   - Invalidates ['messages', projectId] + ['client-messages'] caches when a
 *     MESSAGE_CREATED arrives (no need to merge by hand — React Query will
 *     re-fetch the canonical list).
 *   - Surfaces a `typingUsers` set computed from TYPING_START / TYPING_STOP.
 *   - Exposes `notifyTyping(start)` so the input box can announce typing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeWs } from './useRealtimeWs';

const TYPING_TIMEOUT_MS = 4000;

interface Options {
  projectId: string | null | undefined;
}

export function useMessagesLive({ projectId }: Options) {
  const qc = useQueryClient();
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const expireTyping = useCallback((userId: string) => {
    setTypingUsers((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const armTypingExpiry = useCallback((userId: string) => {
    const existing = typingTimers.current.get(userId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => expireTyping(userId), TYPING_TIMEOUT_MS);
    typingTimers.current.set(userId, t);
  }, [expireTyping]);

  const { connected, send } = useRealtimeWs({
    path: `/ws/messaging/${projectId || ''}`,
    enabled: !!projectId,
    onPacket: (packet) => {
      if (!packet?.type) return;
      switch (packet.type) {
        case 'MESSAGE_CREATED':
          qc.invalidateQueries({ queryKey: ['messages', projectId] });
          qc.invalidateQueries({ queryKey: ['client-messages'] });
          break;
        case 'TYPING_START': {
          const uid = packet.payload?.user_id;
          if (!uid) return;
          setTypingUsers((prev) => {
            if (prev.has(uid)) return prev;
            const next = new Set(prev);
            next.add(uid);
            return next;
          });
          armTypingExpiry(uid);
          break;
        }
        case 'TYPING_STOP': {
          const uid = packet.payload?.user_id;
          if (!uid) return;
          const t = typingTimers.current.get(uid);
          if (t) clearTimeout(t);
          typingTimers.current.delete(uid);
          expireTyping(uid);
          break;
        }
      }
    },
  });

  // Clear timers on unmount
  useEffect(() => () => {
    typingTimers.current.forEach((t) => clearTimeout(t));
    typingTimers.current.clear();
  }, []);

  const notifyTyping = useCallback((isTyping: boolean) => {
    send({ type: isTyping ? 'TYPING_START' : 'TYPING_STOP' });
  }, [send]);

  return { connected, typingUsers, notifyTyping };
}
