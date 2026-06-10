/**
 * useWebRTC — peer-to-peer (mesh) visioconférence for the Bureau d'Études.
 *
 * Signaling rides the existing collaboration WebSocket (RTC_OFFER / RTC_ANSWER /
 * RTC_ICE relayed by the backend to a target peer). Glare is avoided with the
 * "lowest id is the initiator" rule. Suited to small expert groups (mesh);
 * swap to an SFU later for large rooms.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { axiosClient } from '../services/api/axiosClient';

export interface PeerVideo {
  id: string;
  name: string;
  stream: MediaStream;
}

interface Participant {
  id: string;
  name?: string;
  role?: string;
  color?: string;
}

interface Options {
  sessionId: string;
  send: (packet: { type: string; payload?: any }) => void;
  participants: Participant[];
  enabled: boolean;
}

export function useWebRTC({ sessionId, send, participants, enabled }: Options) {
  const { user } = useAuth();
  const selfId = user?.id || '';

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<Record<string, PeerVideo>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localRef = useRef<MediaStream | null>(null);
  const iceRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Fetch ICE servers (STUN + optional TURN) once.
  useEffect(() => {
    axiosClient
      .get('/collaboration/ice-servers')
      .then((r) => {
        if (Array.isArray(r.data?.iceServers) && r.data.iceServers.length) {
          iceRef.current = r.data.iceServers;
        }
      })
      .catch(() => {});
  }, []);

  const createPeer = useCallback(
    (peerId: string, peerName: string): RTCPeerConnection => {
      const existing = peers.current.get(peerId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: iceRef.current });
      localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          send({ type: 'RTC_ICE', payload: { target_id: peerId, candidate: e.candidate } });
        }
      };
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (stream) setRemote((prev) => ({ ...prev, [peerId]: { id: peerId, name: peerName, stream } }));
      };
      peers.current.set(peerId, pc);
      return pc;
    },
    [send],
  );

  const callPeer = useCallback(
    async (peerId: string, peerName: string) => {
      const pc = createPeer(peerId, peerName);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: 'RTC_OFFER', payload: { target_id: peerId, sdp: offer } });
    },
    [createPeer, send],
  );

  // Acquire / release local media on enable.
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        setLocalStream(stream);
        setMicOn(true);
        setCamOn(true);
      })
      .catch(() => setError("Caméra/micro indisponibles ou refusés."));
    return () => {
      stopped = true;
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      setLocalStream(null);
      peers.current.forEach((pc) => pc.close());
      peers.current.clear();
      setRemote({});
    };
  }, [enabled]);

  // Connect to peers (initiator = the lower id) + tear down those who left.
  useEffect(() => {
    if (!enabled || !localStream) return;
    const ids = new Set(participants.map((p) => p.id));
    participants.forEach((p) => {
      if (p.id === selfId) return;
      if (!peers.current.has(p.id) && selfId < p.id) {
        callPeer(p.id, p.name || 'Participant');
      }
    });
    peers.current.forEach((pc, id) => {
      if (!ids.has(id)) {
        pc.close();
        peers.current.delete(id);
        setRemote((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
  }, [participants, enabled, localStream, selfId, callPeer]);

  // Incoming signaling (offer / answer / ice).
  useEffect(() => {
    const onRtc = async (ev: Event) => {
      const { type, payload } = (ev as CustomEvent).detail || {};
      const from = payload?.sender_id;
      if (!from || from === selfId) return;
      try {
        if (type === 'RTC_OFFER') {
          const pc = createPeer(from, payload.sender_name || 'Participant');
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: 'RTC_ANSWER', payload: { target_id: from, sdp: answer } });
        } else if (type === 'RTC_ANSWER') {
          const pc = peers.current.get(from);
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if (type === 'RTC_ICE') {
          const pc = peers.current.get(from);
          if (pc && payload.candidate) await pc.addIceCandidate(payload.candidate);
        }
      } catch {
        /* ignore transient negotiation errors */
      }
    };
    window.addEventListener('collab:rtc', onRtc as EventListener);
    return () => window.removeEventListener('collab:rtc', onRtc as EventListener);
  }, [createPeer, selfId, send]);

  const toggleMic = useCallback(() => {
    const t = localRef.current?.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setMicOn(t.enabled);
    }
  }, []);

  const toggleCam = useCallback(() => {
    const t = localRef.current?.getVideoTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setCamOn(t.enabled);
    }
  }, []);

  /** Mode dégradé : coupe la vidéo, garde l'audio (réseau chantier instable). */
  const degrade = useCallback(() => {
    const t = localRef.current?.getVideoTracks()[0];
    if (t) {
      t.enabled = false;
      setCamOn(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!localRef.current || recorderRef.current) return;
    try {
      chunksRef.current = [];
      const rec = new MediaRecorder(localRef.current, { mimeType: 'video/webm' });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const fd = new FormData();
        fd.append('file', blob, `recording-${sessionId}.webm`);
        try {
          await axiosClient.post(`/collaboration/sessions/${sessionId}/recording`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          /* non-fatal */
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setError("Enregistrement impossible sur ce navigateur.");
    }
  }, [sessionId]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  return {
    localStream,
    remote,
    micOn,
    camOn,
    recording,
    error,
    toggleMic,
    toggleCam,
    degrade,
    startRecording,
    stopRecording,
  };
}
