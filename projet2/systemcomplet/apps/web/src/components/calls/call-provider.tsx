"use client";

import clsx from "clsx";
import {
  Circle,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Phone,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRealtime, useRealtimeEvent } from "@/lib/realtime";

interface Participant {
  user_id: string;
  name: string;
  status: string;
}

interface CallInfo {
  id: string;
  kind: "audio" | "video";
  title?: string | null;
  status: string;
  topology?: string;
  initiator_id: string;
  participants: Participant[];
  recording_allowed?: boolean;
}

interface Incoming {
  call_id: string;
  kind: "audio" | "video";
  title?: string | null;
  from: { id: string; name: string };
}

interface StartOptions {
  participantIds: string[];
  kind: "audio" | "video";
  conversationId?: string;
  projectId?: string;
  issueId?: string;
  title?: string;
}

interface CallApi {
  active: CallInfo | null;
  start: (opts: StartOptions) => Promise<void>;
  join: (callId: string, video?: boolean) => Promise<void>;
}

const CallContext = createContext<CallApi | null>(null);

export function useCalls(): CallApi {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCalls hors CallProvider");
  return ctx;
}

/** Sonnerie générée (WebAudio) : aucun fichier audio externe. */
function useRingtone(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    let stopped = false;
    const ring = () => {
      if (stopped) return;
      [0, 0.25].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.22);
      });
    };
    ring();
    const id = setInterval(ring, 2000);
    return () => {
      stopped = true;
      clearInterval(id);
      void ctx.close();
    };
  }, [active]);
}

interface Peer {
  pc: RTCPeerConnection;
  stream: MediaStream;
  makingOffer: boolean;
  ignoreOffer: boolean;
}

/**
 * Appels audio/vidéo WebRTC (maillage pair-à-pair, signalisation par WebSocket, TURN à identifiants temporaires),
 * partage d'écran, consentement et enregistrement audio (V4-CALL-17/18/19).
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { send } = useRealtime();
  const toast = useToast();
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [active, setActive] = useState<CallInfo | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<Record<string, MediaStream>>({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const peers = useRef(new Map<string, Peer>());
  const iceServers = useRef<RTCIceServer[]>([]);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const activeRef = useRef<CallInfo | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  activeRef.current = active;

  useRingtone(!!incoming && !active);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const signal = useCallback((callId: string, to: string, payload: Record<string, unknown>) => send("call.signal", { call_id: callId, to, signal: payload }), [send]);

  const cleanup = useCallback(() => {
    peers.current.forEach((p) => p.pc.close());
    peers.current.clear();
    localRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    screenRef.current = null;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    setLocalStream(null);
    setRemote({});
    setActive(null);
    setSharing(false);
    setMuted(false);
    setCameraOff(false);
    setRecording(false);
    setStartedAt(null);
  }, []);

  const peerFor = useCallback(
    (callId: string, userId: string): Peer => {
      const existing = peers.current.get(userId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: iceServers.current });
      const stream = new MediaStream();
      const peer: Peer = { pc, stream, makingOffer: false, ignoreOffer: false };
      peers.current.set(userId, peer);
      localRef.current?.getTracks().forEach((track) => pc.addTrack(track, localRef.current!));
      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((t) => {
          if (!stream.getTracks().includes(t)) stream.addTrack(t);
        });
        if (!event.streams[0] && !stream.getTracks().includes(event.track)) stream.addTrack(event.track);
        setRemote((r) => ({ ...r, [userId]: stream }));
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) signal(callId, userId, { candidate: event.candidate.toJSON() });
      };
      pc.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true;
          await pc.setLocalDescription();
          signal(callId, userId, { description: pc.localDescription?.toJSON() });
        } catch {
          /* renégociation ultérieure */
        } finally {
          peer.makingOffer = false;
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") pc.restartIce();
        if (pc.connectionState === "closed") {
          peers.current.delete(userId);
          setRemote((r) => {
            const next = { ...r };
            delete next[userId];
            return next;
          });
        }
      };
      return peer;
    },
    [signal],
  );

  const prepareMedia = useCallback(async (video: boolean) => {
    const ice = await api<{ ice_servers: RTCIceServer[] }>("/calls/ice-servers");
    iceServers.current = ice.ice_servers ?? [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false });
      localRef.current = stream;
      setLocalStream(stream);
    } catch {
      throw new Error("Accès au micro ou à la caméra refusé. Autorisez-le dans votre navigateur (HTTPS requis).");
    }
  }, []);

  const join = useCallback(
    async (callId: string, video = false) => {
      try {
        await prepareMedia(video);
        const info = await api<CallInfo>(`/calls/${callId}/join`, { method: "POST", body: { video } });
        setActive(info);
        setStartedAt(Date.now());
        setIncoming(null);
        info.participants
          .filter((p) => p.user_id !== user?.id && p.status === "joined")
          .forEach((p) => peerFor(info.id, String(p.user_id)));
      } catch (err) {
        toast.error("Impossible de rejoindre l'appel", errorMessage(err));
        cleanup();
      }
    },
    [prepareMedia, peerFor, user?.id, toast, cleanup],
  );

  const start = useCallback(
    async (opts: StartOptions) => {
      try {
        await prepareMedia(opts.kind === "video");
        const info = await api<CallInfo>("/calls", {
          method: "POST",
          body: { kind: opts.kind, participant_ids: opts.participantIds, conversation_id: opts.conversationId ?? null, project_id: opts.projectId ?? null, issue_id: opts.issueId ?? null, title: opts.title ?? null },
        });
        setActive(info);
        setStartedAt(Date.now());
      } catch (err) {
        toast.error("Appel impossible", errorMessage(err));
        cleanup();
      }
    },
    [prepareMedia, toast, cleanup],
  );

  useRealtimeEvent("call.incoming", (data: Incoming) => {
    if (activeRef.current) {
      void api(`/calls/${data.call_id}/decline`, { method: "POST" }).catch(() => undefined);
      return;
    }
    setIncoming(data);
  });

  useRealtimeEvent("call.signal", async (data: { call_id: string; from: string; signal: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit } }) => {
    const call = activeRef.current;
    if (!call || call.id !== data.call_id || !user) return;
    const peer = peerFor(call.id, data.from);
    const polite = user.id > data.from;
    const { pc } = peer;
    try {
      if (data.signal.description) {
        const description = data.signal.description;
        const collision = description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
        peer.ignoreOffer = !polite && collision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          await pc.setLocalDescription();
          signal(call.id, data.from, { description: pc.localDescription?.toJSON() });
        }
      } else if (data.signal.candidate) {
        try {
          await pc.addIceCandidate(data.signal.candidate);
        } catch (err) {
          if (!peer.ignoreOffer) throw err;
        }
      }
    } catch {
      /* négociation reprise au prochain échange */
    }
  });

  useRealtimeEvent("call.participant_joined", (data: { call_id: string; user_id: string; name: string }) => {
    setActive((c) =>
      c && c.id === data.call_id
        ? { ...c, status: "active", participants: c.participants.map((p) => (String(p.user_id) === String(data.user_id) ? { ...p, status: "joined" } : p)) }
        : c,
    );
  });

  useRealtimeEvent("call.participant_left", (data: { call_id: string; user_id: string }) => {
    const peer = peers.current.get(String(data.user_id));
    peer?.pc.close();
    peers.current.delete(String(data.user_id));
    setRemote((r) => {
      const next = { ...r };
      delete next[String(data.user_id)];
      return next;
    });
    setActive((c) => (c && c.id === data.call_id ? { ...c, participants: c.participants.map((p) => (String(p.user_id) === String(data.user_id) ? { ...p, status: "left" } : p)) } : c));
  });

  useRealtimeEvent("call.declined", (data: { call_id: string; status: string }) => {
    if (activeRef.current?.id === data.call_id && data.status === "rejected") {
      toast.info("Appel refusé");
      cleanup();
    }
  });

  useRealtimeEvent("call.ended", (data: { call_id: string }) => {
    if (incoming?.call_id === data.call_id) setIncoming(null);
    if (activeRef.current?.id === data.call_id) {
      toast.info("Appel terminé");
      cleanup();
    }
  });

  useRealtimeEvent("call.recording_consent", (data: { call_id: string; recording_allowed: boolean }) => {
    setActive((c) => (c && c.id === data.call_id ? { ...c, recording_allowed: data.recording_allowed } : c));
  });

  const hangUp = async (endForAll: boolean) => {
    const call = activeRef.current;
    if (!call) return;
    try {
      await api(`/calls/${call.id}/${endForAll ? "end" : "leave"}`, { method: "POST" });
    } catch {
      /* appel déjà clos */
    }
    await stopRecording(true);
    cleanup();
  };

  const toggleMute = () => {
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted((m) => !m);
  };

  const toggleCamera = async () => {
    const stream = localRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.enabled = cameraOff;
      setCameraOff((c) => !c);
      return;
    }
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: true });
      const newTrack = cam.getVideoTracks()[0];
      stream.addTrack(newTrack);
      peers.current.forEach((p) => p.pc.addTrack(newTrack, stream));
      setLocalStream(new MediaStream(stream.getTracks()));
      setCameraOff(false);
    } catch {
      toast.error("Caméra indisponible");
    }
  };

  const toggleScreen = async () => {
    const call = activeRef.current;
    if (!call) return;
    if (sharing) {
      screenRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current = null;
      const cam = localRef.current?.getVideoTracks()[0] ?? null;
      peers.current.forEach((p) => {
        const sender = p.pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) void sender.replaceTrack(cam);
      });
      setSharing(false);
      void api(`/calls/${call.id}/screen-share`, { method: "POST", body: { active: false } }).catch(() => undefined);
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenRef.current = screen;
      const track = screen.getVideoTracks()[0];
      track.onended = () => {
        if (screenRef.current) void toggleScreen();
      };
      peers.current.forEach((p) => {
        const sender = p.pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) void sender.replaceTrack(track);
        else p.pc.addTrack(track, screen);
      });
      setSharing(true);
      void api(`/calls/${call.id}/screen-share`, { method: "POST", body: { active: true } }).catch(() => undefined);
    } catch {
      toast.error("Partage d'écran indisponible", "Navigateur compatible et connexion HTTPS requis.");
    }
  };

  const stopRecording = async (upload: boolean) => {
    const rec = recorder.current;
    const call = activeRef.current;
    if (!rec || rec.state === "inactive") return;
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    setRecording(false);
    if (upload && call && chunks.current.length) {
      const form = new FormData();
      form.append("file", new File(chunks.current, `appel-${call.id}.webm`, { type: "audio/webm" }));
      chunks.current = [];
      try {
        await api(`/calls/${call.id}/recording`, { method: "POST", form });
        toast.success("Enregistrement archivé");
      } catch (err) {
        toast.error("Enregistrement non archivé", errorMessage(err));
      }
    }
  };

  const toggleRecording = async () => {
    const call = activeRef.current;
    if (!call) return;
    if (recording) {
      await stopRecording(true);
      return;
    }
    try {
      const info = await api<CallInfo>(`/calls/${call.id}/recording/consent`, { method: "POST", body: { consent: true } });
      setActive((c) => (c ? { ...c, recording_allowed: info.recording_allowed } : c));
      if (!info.recording_allowed) {
        toast.info("Consentement enregistré", "L'enregistrement démarre lorsque tous les participants ont donné leur accord.");
        return;
      }
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      [localRef.current, ...Object.values(remote)].forEach((s) => {
        if (s && s.getAudioTracks().length) ctx.createMediaStreamSource(s).connect(dest);
      });
      const rec = new MediaRecorder(dest.stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined });
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.start(1000);
      recorder.current = rec;
      setRecording(true);
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    }
  };

  const value = useMemo<CallApi>(() => ({ active, start, join }), [active, start, join]);
  const others = active?.participants.filter((p) => String(p.user_id) !== user?.id) ?? [];
  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

  return (
    <CallContext.Provider value={value}>
      {children}
      {incoming && !active ? (
        <div className="fixed bottom-4 right-4 z-[95] w-80 animate-fade-in rounded-2xl bg-brand-900 p-5 text-white shadow-2xl" role="alertdialog" aria-label="Appel entrant">
          <p className="text-xs uppercase tracking-wider text-brand-200">{incoming.kind === "video" ? "Appel vidéo entrant" : "Appel audio entrant"}</p>
          <p className="mt-1 text-lg font-semibold">{incoming.from.name}</p>
          {incoming.title ? <p className="text-sm text-brand-200">{incoming.title}</p> : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 font-semibold hover:bg-red-600"
              onClick={() => {
                void api(`/calls/${incoming.call_id}/decline`, { method: "POST" }).catch(() => undefined);
                setIncoming(null);
              }}
            >
              <PhoneOff className="h-4 w-4" /> Refuser
            </button>
            <button type="button" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 font-semibold hover:bg-emerald-600" onClick={() => void join(incoming.call_id, incoming.kind === "video")}>
              <Phone className="h-4 w-4" /> Répondre
            </button>
          </div>
        </div>
      ) : null}
      {active ? (
        <div
          className={clsx(
            "fixed z-[95] flex flex-col overflow-hidden bg-brand-900 text-white shadow-2xl",
            expanded ? "inset-0" : "bottom-4 right-4 h-[26rem] w-[min(92vw,30rem)] rounded-2xl",
          )}
          role="dialog"
          aria-label="Appel en cours"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold">{active.title || others.map((o) => o.name).join(", ") || "Appel"}</p>
              <p className="text-xs text-brand-200">
                {active.status === "ringing" ? "Sonnerie…" : `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`}
                {recording ? " · enregistrement" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs">
                <Users className="h-3.5 w-3.5" /> {active.participants.filter((p) => p.status === "joined").length}
              </span>
              <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? "Réduire" : "Agrandir"}>
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className={clsx("grid min-h-0 flex-1 gap-1 p-1", Object.keys(remote).length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {Object.keys(remote).length === 0 ? (
              <div className="flex items-center justify-center text-sm text-brand-200">En attente des participants…</div>
            ) : (
              Object.entries(remote).map(([uid, stream]) => <RemoteTile key={uid} stream={stream} name={active.participants.find((p) => String(p.user_id) === uid)?.name ?? ""} />)
            )}
          </div>
          {localStream && localStream.getVideoTracks().length ? (
            <video
              className="absolute bottom-20 right-3 h-24 w-32 rounded-lg bg-black object-cover ring-2 ring-white/30"
              autoPlay
              muted
              playsInline
              ref={(el) => {
                if (el && el.srcObject !== (screenRef.current ?? localStream)) el.srcObject = screenRef.current ?? localStream;
              }}
            />
          ) : null}
          <div className="flex items-center justify-center gap-2 bg-black/30 px-3 py-3">
            <CallButton onClick={toggleMute} active={muted} label={muted ? "Réactiver le micro" : "Couper le micro"}>
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </CallButton>
            <CallButton onClick={() => void toggleCamera()} active={cameraOff || !localStream?.getVideoTracks().length} label="Caméra">
              {cameraOff || !localStream?.getVideoTracks().length ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </CallButton>
            <CallButton onClick={() => void toggleScreen()} active={sharing} label={sharing ? "Arrêter le partage" : "Partager l'écran"}>
              <MonitorUp className="h-5 w-5" />
            </CallButton>
            <CallButton onClick={() => void toggleRecording()} active={recording} label={recording ? "Arrêter l'enregistrement" : "Enregistrer (avec consentement)"}>
              <Circle className={clsx("h-5 w-5", recording && "fill-red-500 text-red-500")} />
            </CallButton>
            <button type="button" onClick={() => void hangUp(active.initiator_id === user?.id)} className="rounded-full bg-red-500 p-3 hover:bg-red-600" aria-label="Raccrocher" title="Raccrocher">
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </CallContext.Provider>
  );
}

function CallButton({ children, onClick, active, label }: { children: ReactNode; onClick: () => void; active?: boolean; label: string }) {
  return (
    <button type="button" onClick={onClick} className={clsx("rounded-full p-3 transition", active ? "bg-white text-brand-900" : "bg-white/15 hover:bg-white/25")} aria-label={label} title={label}>
      {children}
    </button>
  );
}

function RemoteTile({ stream, name }: { stream: MediaStream; name: string }) {
  const hasVideo = stream.getVideoTracks().some((t) => t.readyState === "live");
  return (
    <div className="relative min-h-0 overflow-hidden rounded-lg bg-black">
      <video
        className={clsx("h-full w-full object-contain", !hasVideo && "hidden")}
        autoPlay
        playsInline
        ref={(el) => {
          if (el && el.srcObject !== stream) el.srcObject = stream;
        }}
      />
      {!hasVideo ? (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-xl font-bold">{name.slice(0, 1).toUpperCase()}</span>
          <audio
            autoPlay
            ref={(el) => {
              if (el && el.srcObject !== stream) el.srcObject = stream;
            }}
          />
        </div>
      ) : null}
      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-xs">{name}</span>
    </div>
  );
}
