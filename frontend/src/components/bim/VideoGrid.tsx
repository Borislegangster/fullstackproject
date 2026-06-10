/**
 * VideoGrid — floating Picture-in-Picture video bubbles + controls for the
 * Bureau d'Études visioconférence (WebRTC mesh via useWebRTC).
 */
import { useEffect, useRef } from 'react';
import {
  MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, CircleIcon, SquareIcon, SignalLowIcon,
} from 'lucide-react';
import type { PeerVideo } from '../../hooks/useWebRTC';

function Bubble({ stream, name, muted }: { stream: MediaStream; name: string; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-black shadow-lg border border-white/20">
      <video ref={ref} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 truncate">
        {name}
      </span>
    </div>
  );
}

interface Props {
  localStream: MediaStream | null;
  remote: Record<string, PeerVideo>;
  micOn: boolean;
  camOn: boolean;
  recording: boolean;
  error: string | null;
  toggleMic: () => void;
  toggleCam: () => void;
  degrade: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  selfName: string;
  isAdmin: boolean;
}

export function VideoGrid({
  localStream, remote, micOn, camOn, recording, error,
  toggleMic, toggleCam, degrade, startRecording, stopRecording, selfName, isAdmin,
}: Props) {
  const peers = Object.values(remote);
  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2">
      {error && (
        <div className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg shadow">{error}</div>
      )}
      <div className="flex flex-wrap gap-2 max-w-[70vw]">
        {localStream && <Bubble stream={localStream} name={`${selfName} (moi)`} muted />}
        {peers.map((p) => <Bubble key={p.id} stream={p.stream} name={p.name} />)}
      </div>

      <div className="flex items-center gap-1.5 bg-gray-900/90 backdrop-blur px-2 py-1.5 rounded-full shadow-lg">
        <button
          onClick={toggleMic}
          title={micOn ? 'Couper le micro' : 'Activer le micro'}
          className={`p-2 rounded-full ${micOn ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>
          {micOn ? <MicIcon className="w-4 h-4" /> : <MicOffIcon className="w-4 h-4" />}
        </button>
        <button
          onClick={toggleCam}
          title={camOn ? 'Couper la caméra' : 'Activer la caméra'}
          className={`p-2 rounded-full ${camOn ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>
          {camOn ? <VideoIcon className="w-4 h-4" /> : <VideoOffIcon className="w-4 h-4" />}
        </button>
        <button
          onClick={degrade}
          title="Mode dégradé (coupe la vidéo, garde l'audio)"
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
          <SignalLowIcon className="w-4 h-4" />
        </button>
        {isAdmin && (
          <button
            onClick={recording ? stopRecording : startRecording}
            title={recording ? "Arrêter l'enregistrement" : 'Enregistrer la session'}
            className={`p-2 rounded-full ${recording ? 'bg-red-600 text-white animate-pulse' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            {recording ? <SquareIcon className="w-4 h-4" /> : <CircleIcon className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
