/**
 * useCollaboration — WebSocket manager for the Bureau d'Études Virtuel.
 *
 * Connects to /api/v1/collaboration/ws/{sessionId}?token={access_token},
 * surfaces participants / annotations / cursors / chat / session mode, and
 * exposes a `send(packet)` function the canvas + toolbar use to broadcast.
 *
 * The connection is auto-reconnecting (exponential backoff capped at 30 s) and
 * survives a transient backend restart.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getStoredAccessToken } from '../context/AuthContext';

export type SessionMode = 'FREE' | 'PRESENTER';

export interface Participant {
  id: string;
  name: string;
  role: string;
  color: string;
  /** Compact slot id (0-255) used by the binary cursor protocol. */
  slot?: number;
}

export interface CursorState {
  x: number;
  y: number;
  sender_id: string;
  sender_name: string;
  color: string;
  ts: number;
}

/** A peer's "about to draw here" hint (optimistic annotation lock). */
export interface IntentState {
  x: number;
  y: number;
  layer: string;
  sender_id: string;
  sender_name: string;
  color: string;
  ts: number;
}

export interface AnnotationItem {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  layer: string;
  color: string;
  svg_data: any;
  is_validated: boolean;
  created_at: number;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  color: string;
  text: string;
  ts: number;
}

type Packet = { type: string; payload?: any };

export interface UseCollaborationOptions {
  sessionId: string;
  /** Called when the server sends SESSION_ENDED. */
  onSessionEnded?: () => void;
}

export interface CollaborationApi {
  connected: boolean;
  mode: SessionMode;
  presenterId: string | null;
  participants: Participant[];
  cursors: Record<string, CursorState>;
  /** Peers who just started drawing somewhere (optimistic lock hints). */
  intents: Record<string, IntentState>;
  annotations: AnnotationItem[];
  chat: ChatMessage[];
  /** Send a packet to all other participants. */
  send: (packet: Packet) => void;
  /** Helper to broadcast a cursor move at high frequency (throttled). */
  sendCursor: (x: number, y: number) => void;
  /** Announce intent to draw at (x,y) on a layer — optimistic lock hint. */
  sendIntent: (layer: string, x: number, y: number) => void;
  /** Add a new annotation (also persisted server-side). */
  addAnnotation: (layer: string, svgData: any) => void;
  /** Delete one of our own annotations. */
  deleteAnnotation: (annotationId: string) => void;
  /** ADMIN-only — switch session mode. */
  setMode: (mode: SessionMode) => void;
  /** Send a chat message visible by every participant. */
  sendChat: (text: string) => void;
}

function buildWsUrl(sessionId: string, token: string): string {
  const apiUrl = (import.meta as any).env?.VITE_API_URL || window.location.origin;
  const url = new URL(`/api/v1/collaboration/ws/${sessionId}`, apiUrl);
  url.protocol = url.protocol.replace(/^http/, 'ws');
  url.searchParams.set('token', token);
  return url.toString();
}

export function useCollaboration(opts: UseCollaborationOptions): CollaborationApi {
  const { sessionId, onSessionEnded } = opts;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const lastCursorSent = useRef(0);
  const [connected, setConnected] = useState(false);
  const [mode, setModeState] = useState<SessionMode>('FREE');
  const [presenterId, setPresenterId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorState>>({});
  const [intents, setIntents] = useState<Record<string, IntentState>>({});
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  // Latest participants, readable inside the WS onmessage closure (binary decode).
  const participantsRef = useRef<Participant[]>([]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);

  const send = useCallback((packet: Packet) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(packet));
    }
  }, []);

  const sendCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorSent.current < 50) return; // throttle ~20 Hz
    lastCursorSent.current = now;
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      // Compact binary frame [x:f32][y:f32][z:f32] (12 bytes vs ~80 in JSON).
      const buf = new ArrayBuffer(12);
      const dv = new DataView(buf);
      dv.setFloat32(0, x, true);
      dv.setFloat32(4, y, true);
      dv.setFloat32(8, 0, true);
      ws.send(buf);
    }
  }, []);

  // Decode a relayed binary cursor frame: [slot:u8][x:f32][y:f32][z:f32].
  const handleBinary = useCallback((buf: ArrayBuffer) => {
    if (buf.byteLength < 13) return;
    const dv = new DataView(buf);
    const slot = dv.getUint8(0);
    const x = dv.getFloat32(1, true);
    const y = dv.getFloat32(5, true);
    const p = participantsRef.current.find((pp) => pp.slot === slot);
    if (!p) return;
    setCursors((prev) => ({
      ...prev,
      [p.id]: { x, y, sender_id: p.id, sender_name: p.name, color: p.color || '#888', ts: Date.now() },
    }));
  }, []);

  const addAnnotation = useCallback((layer: string, svgData: any) => {
    send({ type: 'MARKUP_ADD', payload: { layer, svg_data: svgData } });
  }, [send]);

  const deleteAnnotation = useCallback((annotationId: string) => {
    send({ type: 'MARKUP_DELETE', payload: { markup_id: annotationId } });
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
  }, [send]);

  const setMode = useCallback((newMode: SessionMode) => {
    send({ type: 'MODE_CHANGE', payload: { mode: newMode } });
  }, [send]);

  const sendChat = useCallback((text: string) => {
    if (!text.trim()) return;
    send({ type: 'CHAT_MESSAGE', payload: { text: text.trim() } });
  }, [send]);

  const sendIntent = useCallback((layer: string, x: number, y: number) => {
    send({ type: 'MARKUP_INTENT', payload: { layer, x, y } });
  }, [send]);

  // Handle incoming packets
  const handlePacket = useCallback((raw: string) => {
    let packet: any;
    try { packet = JSON.parse(raw); } catch { return; }
    const { type, payload = {} } = packet;
    switch (type) {
      case 'SESSION_STATE':
        setMode(payload.mode || 'FREE');
        setPresenterId(payload.presenter_id || null);
        setParticipants(payload.participants || []);
        break;
      case 'USER_JOINED':
        setParticipants((prev) => {
          if (prev.some((p) => p.id === payload.id)) return prev;
          return [...prev, payload];
        });
        break;
      case 'USER_LEFT':
        setParticipants((prev) => prev.filter((p) => p.id !== payload.user_id));
        setCursors((prev) => {
          const next = { ...prev };
          delete next[payload.user_id];
          return next;
        });
        break;
      case 'CURSOR_MOVE':
        setCursors((prev) => ({
          ...prev,
          [payload.sender_id]: {
            x: payload.x,
            y: payload.y,
            sender_id: payload.sender_id,
            sender_name: payload.sender_name,
            color: payload.color || '#888',
            ts: Date.now(),
          },
        }));
        break;
      case 'MARKUP_ADD':
        setAnnotations((prev) => [
          ...prev,
          {
            id: payload.annotation_id || `temp-${Date.now()}`,
            author_id: payload.sender_id,
            author_name: payload.sender_name,
            author_role: payload.sender_role,
            color: payload.color,
            layer: payload.layer,
            svg_data: payload.svg_data,
            is_validated: false,
            created_at: Date.now(),
          },
        ]);
        break;
      case 'MARKUP_DELETE':
        setAnnotations((prev) => prev.filter((a) => a.id !== payload.markup_id));
        break;
      case 'MARKUP_INTENT':
        setIntents((prev) => ({
          ...prev,
          [payload.sender_id]: {
            x: payload.x,
            y: payload.y,
            layer: payload.layer,
            sender_id: payload.sender_id,
            sender_name: payload.sender_name,
            color: payload.color || '#888',
            ts: Date.now(),
          },
        }));
        break;
      case 'MARKUP_VALIDATE':
        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === payload.markup_id ? { ...a, is_validated: true, layer: payload.layer } : a
          )
        );
        break;
      case 'MODE_CHANGE':
        setModeState(payload.mode);
        setPresenterId(payload.presenter_id || null);
        break;
      case 'CAMERA_SYNC':
        // The viewer subscribes via window event so we don't trigger a re-render
        window.dispatchEvent(new CustomEvent('collab:camera-sync', { detail: payload }));
        break;
      case 'CHAT_MESSAGE':
        setChat((prev) => [
          ...prev,
          {
            id: `${payload.sender_id}-${Date.now()}`,
            sender_id: payload.sender_id,
            sender_name: payload.sender_name,
            color: payload.color || '#888',
            text: payload.text || '',
            ts: Date.now(),
          },
        ]);
        break;
      case 'SNAPSHOT_TAKEN':
        window.dispatchEvent(new CustomEvent('collab:snapshot', { detail: payload }));
        break;
      case 'RTC_OFFER':
      case 'RTC_ANSWER':
      case 'RTC_ICE':
        // WebRTC signaling — handed to the useWebRTC layer via a window event.
        window.dispatchEvent(new CustomEvent('collab:rtc', { detail: { type, payload } }));
        break;
      case 'SESSION_ENDED':
        onSessionEnded?.();
        break;
    }
  }, [onSessionEnded]);

  // Establish & maintain the connection
  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const token = getStoredAccessToken();
      if (!token) return;
      const ws = new WebSocket(buildWsUrl(sessionId, token));
      wsRef.current = ws;

      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        reconnectAttempt.current = 0;
        setConnected(true);
      };
      ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) handleBinary(e.data);
        else handlePacket(e.data);
      };
      ws.onerror = () => {
        // onclose will retry
      };
      ws.onclose = () => {
        setConnected(false);
        if (cancelled) return;
        const delay = Math.min(30_000, 1000 * Math.pow(2, reconnectAttempt.current));
        reconnectAttempt.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [sessionId, handlePacket, handleBinary]);

  // Expire stale cursors after 5 s of inactivity
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - 5000;
      setCursors((prev) => {
        const next: typeof prev = {};
        let changed = false;
        for (const [k, v] of Object.entries(prev)) {
          if (v.ts > cutoff) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
      // Draw-intents are short-lived (2.5 s).
      const intentCutoff = Date.now() - 2500;
      setIntents((prev) => {
        const next: typeof prev = {};
        let changed = false;
        for (const [k, v] of Object.entries(prev)) {
          if (v.ts > intentCutoff) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    connected,
    mode,
    presenterId,
    participants,
    cursors,
    intents,
    annotations,
    chat,
    send,
    sendCursor,
    sendIntent,
    addAnnotation,
    deleteAnnotation,
    setMode,
    sendChat,
  };
}
