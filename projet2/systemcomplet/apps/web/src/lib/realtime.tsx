"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { api } from "./api";

export interface RealtimeMessage {
  type: string;
  data: any;
}

type Handler = (data: any, message: RealtimeMessage) => void;

interface RealtimeState {
  status: "connecting" | "open" | "closed";
  online: Set<string>;
  subscribe: (type: string, handler: Handler) => () => void;
  join: (room: string) => void;
  leave: (room: string) => void;
  send: (type: string, data: Record<string, unknown>) => boolean;
}

const RealtimeContext = createContext<RealtimeState | null>(null);

/** Connexion WebSocket authentifiée par ticket court (/auth/ws-ticket), reconnexion automatique, salons. */
export function RealtimeProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const socket = useRef<WebSocket | null>(null);
  const handlers = useRef(new Map<string, Set<Handler>>());
  const rooms = useRef(new Set<string>());
  const [status, setStatus] = useState<RealtimeState["status"]>("connecting");
  const [online, setOnline] = useState<Set<string>>(new Set());
  const attempt = useRef(0);
  const stopped = useRef(false);

  const dispatch = useCallback((message: RealtimeMessage) => {
    if (message.type === "ready") setOnline(new Set<string>(message.data?.online ?? []));
    if (message.type === "presence") {
      setOnline((prev) => {
        const next = new Set(prev);
        if (message.data?.status === "offline") next.delete(String(message.data.user_id));
        else if (message.data?.user_id) next.add(String(message.data.user_id));
        return next;
      });
    }
    handlers.current.get(message.type)?.forEach((h) => h(message.data, message));
    handlers.current.get("*")?.forEach((h) => h(message.data, message));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pinger: ReturnType<typeof setInterval> | null = null;

    const connect = async () => {
      if (stopped.current) return;
      setStatus("connecting");
      try {
        const { ticket, url } = await api<{ ticket: string; url: string }>("/auth/ws-ticket", { method: "POST" });
        const wsUrl = url.startsWith("ws") ? url : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${url}`;
        const ws = new WebSocket(`${wsUrl}?ticket=${encodeURIComponent(ticket)}&app=web`);
        socket.current = ws;
        ws.onopen = () => {
          attempt.current = 0;
          setStatus("open");
          rooms.current.forEach((room) => ws.send(JSON.stringify({ type: "join", data: { room } })));
          pinger = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "ping" })), 30_000);
        };
        ws.onmessage = (event) => {
          try {
            dispatch(JSON.parse(event.data as string) as RealtimeMessage);
          } catch {
            /* message ignoré */
          }
        };
        ws.onclose = () => {
          if (pinger) clearInterval(pinger);
          setStatus("closed");
          socket.current = null;
          if (stopped.current) return;
          attempt.current += 1;
          const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt.current, 5)) + Math.random() * 1000;
          timer = setTimeout(() => void connect(), delay);
        };
      } catch {
        setStatus("closed");
        attempt.current += 1;
        timer = setTimeout(() => void connect(), Math.min(60_000, 2000 * 2 ** Math.min(attempt.current, 5)));
      }
    };
    void connect();
    return () => {
      stopped.current = true;
      if (timer) clearTimeout(timer);
      if (pinger) clearInterval(pinger);
      socket.current?.close();
    };
  }, [enabled, dispatch]);

  const send = useCallback((type: string, data: Record<string, unknown>) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type, data }));
    return true;
  }, []);

  const subscribe = useCallback((type: string, handler: Handler) => {
    const set = handlers.current.get(type) ?? new Set<Handler>();
    set.add(handler);
    handlers.current.set(type, set);
    return () => {
      set.delete(handler);
    };
  }, []);

  const join = useCallback(
    (room: string) => {
      rooms.current.add(room);
      send("join", { room });
    },
    [send],
  );

  const leave = useCallback(
    (room: string) => {
      rooms.current.delete(room);
      send("leave", { room });
    },
    [send],
  );

  const value = useMemo<RealtimeState>(() => ({ status, online, subscribe, join, leave, send }), [status, online, subscribe, join, leave, send]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeState {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime hors RealtimeProvider");
  return ctx;
}

/** Abonnement déclaratif à un type d'événement temps réel. */
export function useRealtimeEvent(type: string, handler: Handler): void {
  const { subscribe } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe(type, (d, m) => ref.current(d, m)), [subscribe, type]);
}

/** Rejoint un salon (conversation:, project:, bim:, call:) tant que le composant est monté. */
export function useRoom(room: string | null): void {
  const { join, leave } = useRealtime();
  useEffect(() => {
    if (!room) return;
    join(room);
    return () => leave(room);
  }, [room, join, leave]);
}
