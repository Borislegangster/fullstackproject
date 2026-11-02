/**
 * useRealtimeWs — Generic auto-reconnecting WebSocket subscription.
 *
 * Pattern reused by useNotificationsLive + useMessagesLive (Phase 6). Encapsulates:
 *   - WebSocket URL building from VITE_API_URL + token
 *   - Open / close / error handling
 *   - Auto-reconnect with exponential backoff (cap 30 s)
 *   - Idempotent unmount cleanup
 *   - Optional ping/keepalive interval
 */
import { useEffect, useRef, useState } from 'react';
import { getStoredAccessToken } from '../context/AuthContext';

export interface UseRealtimeWsOptions {
  /** Relative path (without /api/v1) — e.g. "/ws/notifications" */
  path: string;
  /** Called for every parsed packet. */
  onPacket: (packet: any) => void;
  /** Defaults to true. Set to false to bail out (e.g. user not authenticated yet). */
  enabled?: boolean;
  /** Ping every N ms to keep proxies awake (default disabled). */
  pingMs?: number;
}

export interface RealtimeWsState {
  connected: boolean;
  /** Number of consecutive reconnection attempts (resets on connect). */
  attempts: number;
  /** Imperative send (no-op when disconnected). */
  send: (msg: any) => void;
}

function buildWsUrl(path: string, token: string): string {
  const apiUrl = (import.meta as any).env?.VITE_API_URL || window.location.origin;
  const fullPath = `/api/v1${path}`;
  const url = new URL(fullPath, apiUrl);
  url.protocol = url.protocol.replace(/^http/, 'ws');
  url.searchParams.set('token', token);
  return url.toString();
}

export function useRealtimeWs({
  path,
  onPacket,
  enabled = true,
  pingMs,
}: UseRealtimeWsOptions): RealtimeWsState {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [attempts, setAttempts] = useState(0);
  // Latest onPacket reference so callers can pass inline arrows safely
  const onPacketRef = useRef(onPacket);
  onPacketRef.current = onPacket;

  const sendImpl = (msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (cancelled) return;
      const token = getStoredAccessToken();
      if (!token) {
        // No auth yet — retry shortly without bumping the attempt count
        reconnectTimer = setTimeout(connect, 2000);
        return;
      }
      const ws = new WebSocket(buildWsUrl(path, token));
      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
        setAttempts(0);
        setConnected(true);
        if (pingMs) {
          pingTimer = setInterval(() => sendImpl('ping'), pingMs);
        }
      };
      ws.onmessage = (e) => {
        try {
          onPacketRef.current(JSON.parse(e.data));
        } catch {
          onPacketRef.current({ raw: e.data });
        }
      };
      ws.onerror = () => {
        // onclose handles retry
      };
      ws.onclose = () => {
        setConnected(false);
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        if (cancelled) return;
        const delay = Math.min(30_000, 1000 * Math.pow(2, attemptsRef.current));
        attemptsRef.current += 1;
        setAttempts(attemptsRef.current);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      try { ws?.close(); } catch { /* noop */ }
    };
  }, [enabled, path, pingMs]);

  return { connected, attempts, send: sendImpl };
}
