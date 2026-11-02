/**
 * SessionSidebar — Right-hand panel of the Bureau d'Études session.
 * Tabs: Participants · Chat · Snapshots · Annotations.
 */
import { useEffect, useRef, useState } from 'react';
import {
  UsersIcon, MessageSquareIcon, CameraIcon, PencilIcon, SendIcon,
  CheckCircle2Icon, ShareIcon,
} from 'lucide-react';
import type { CollaborationApi, AnnotationItem } from '../../hooks/useCollaboration';
import { collaborationApi, type SessionSnapshot } from '../../services/api/collaboration.api';
import { formatDateTime } from '../../utils/datetime';

interface Props {
  sessionId: string;
  collab: CollaborationApi;
  currentUserId?: string;
  isAdmin: boolean;
}

type Tab = 'participants' | 'chat' | 'snapshots' | 'annotations';

export function SessionSidebar({ sessionId, collab, currentUserId, isAdmin }: Props) {
  const [tab, setTab] = useState<Tab>('participants');

  return (
    <aside className="w-72 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex border-b border-gray-200">
        <TabBtn current={tab} target="participants" onClick={setTab} label="Équipe" icon={UsersIcon} badge={collab.participants.length} />
        <TabBtn current={tab} target="chat" onClick={setTab} label="Chat" icon={MessageSquareIcon} badge={collab.chat.length || undefined} />
        <TabBtn current={tab} target="snapshots" onClick={setTab} label="Snap" icon={CameraIcon} />
        <TabBtn current={tab} target="annotations" onClick={setTab} label="Annot." icon={PencilIcon} badge={collab.annotations.length || undefined} />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'participants' && <ParticipantsPanel collab={collab} currentUserId={currentUserId} />}
        {tab === 'chat' && <ChatPanel collab={collab} currentUserId={currentUserId} />}
        {tab === 'snapshots' && <SnapshotsPanel sessionId={sessionId} isAdmin={isAdmin} />}
        {tab === 'annotations' && <AnnotationsPanel sessionId={sessionId} collab={collab} isAdmin={isAdmin} />}
      </div>
    </aside>
  );
}

function TabBtn({
  current, target, onClick, label, icon: Icon, badge,
}: {
  current: Tab; target: Tab; onClick: (t: Tab) => void; label: string;
  icon: any; badge?: number;
}) {
  const active = current === target;
  return (
    <button
      onClick={() => onClick(target)}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold relative transition-colors
        ${active ? 'text-globus-blue-dark bg-gray-50' : 'text-gray-500 hover:text-gray-700'}`}>
      <Icon className="w-4 h-4" />
      <span>{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="absolute top-1 right-1 bg-globus-orange text-white text-[8px] rounded-full px-1.5 leading-none py-0.5">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-globus-orange rounded-full" />}
    </button>
  );
}

// ── Participants ─────────────────────────────────────────────

function ParticipantsPanel({ collab, currentUserId }: { collab: CollaborationApi; currentUserId?: string }) {
  if (collab.participants.length === 0) {
    return <p className="text-sm text-gray-500 text-center mt-6">Aucun participant connecté.</p>;
  }
  return (
    <ul className="space-y-2">
      {collab.participants.map((p) => (
        <li key={p.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
            style={{ backgroundColor: p.color }}>
            {p.name?.charAt(0) || '?'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-globus-blue-dark truncate">
              {p.name}{p.id === currentUserId && ' (vous)'}
            </p>
            <p className="text-xs text-gray-500">{p.role}</p>
          </div>
          {collab.presenterId === p.id && <span className="text-xs">🎤</span>}
        </li>
      ))}
    </ul>
  );
}

// ── Chat ─────────────────────────────────────────────────────

function ChatPanel({ collab, currentUserId }: { collab: CollaborationApi; currentUserId?: string }) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [collab.chat]);

  const send = () => {
    if (!text.trim()) return;
    collab.sendChat(text);
    setText('');
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2">
        {collab.chat.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-6">Aucun message pour le moment.</p>
        ) : (
          collab.chat.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-gray-500" style={{ color: m.color }}>{m.sender_name}</span>
                <span
                  className={`max-w-[80%] text-sm rounded-lg px-3 py-1.5 ${mine
                    ? 'bg-globus-blue-dark text-white'
                    : 'bg-gray-100 text-gray-800'}`}>
                  {m.text}
                </span>
              </div>
            );
          })
        )}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="mt-3 flex gap-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message..."
          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-globus-orange" />
        <button
          type="submit"
          disabled={!text.trim()}
          className="bg-globus-orange text-white p-1.5 rounded-lg disabled:opacity-50">
          <SendIcon className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

// ── Snapshots ────────────────────────────────────────────────

function SnapshotsPanel({ sessionId, isAdmin }: { sessionId: string; isAdmin: boolean }) {
  const [snapshots, setSnapshots] = useState<SessionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try { setSnapshots(await collaborationApi.listSnapshots(sessionId)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    refresh();
    const onNewSnapshot = () => refresh();
    window.addEventListener('collab:snapshot', onNewSnapshot);
    return () => window.removeEventListener('collab:snapshot', onNewSnapshot);
  }, [sessionId]);

  const toggleShare = async (id: string) => {
    await collaborationApi.toggleSnapshotShare(id);
    refresh();
  };

  if (loading) return <p className="text-sm text-gray-500 text-center mt-6">Chargement...</p>;
  if (snapshots.length === 0) return <p className="text-sm text-gray-500 text-center mt-6">Aucun snapshot.</p>;

  return (
    <ul className="space-y-3">
      {snapshots.map((s) => (
        <li key={s.id} className="border rounded-lg p-2 bg-white">
          <img src={s.image_url} alt="Snapshot" className="w-full rounded mb-2" />
          {s.notes && <p className="text-xs text-gray-700 mb-1">{s.notes}</p>}
          <div className="flex justify-between items-center text-[10px] text-gray-500">
            <span>{formatDateTime(s.created_at)}</span>
            {isAdmin && (
              <button
                onClick={() => toggleShare(s.id)}
                className={`flex items-center gap-1 font-bold ${s.shared_with_client ? 'text-green-600' : 'text-gray-500 hover:text-gray-800'}`}>
                <ShareIcon className="w-3 h-3" />
                {s.shared_with_client ? 'Partagé client' : 'Privé'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Annotations ──────────────────────────────────────────────

function AnnotationsPanel({
  sessionId, collab, isAdmin,
}: { sessionId: string; collab: CollaborationApi; isAdmin: boolean }) {
  const validate = async (a: AnnotationItem) => {
    try {
      await collaborationApi.validateAnnotation(sessionId, a.id);
    } catch (e) {
      console.error(e);
    }
  };

  if (collab.annotations.length === 0) {
    return <p className="text-sm text-gray-500 text-center mt-6">Aucune annotation pour le moment.</p>;
  }
  return (
    <ul className="space-y-2">
      {collab.annotations.map((a) => (
        <li key={a.id} className="border-l-4 p-2 bg-gray-50 rounded-r text-xs"
            style={{ borderLeftColor: a.color || '#888' }}>
          <div className="flex justify-between">
            <span className="font-bold text-globus-blue-dark">{a.author_name || 'Anonyme'}</span>
            {a.is_validated
              ? <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2Icon className="w-3 h-3" /> Validé</span>
              : isAdmin && (
                <button onClick={() => validate(a)} className="text-globus-orange font-bold hover:underline">
                  Valider
                </button>
              )}
          </div>
          <p className="text-gray-600">
            Couche : <span className="font-semibold">{a.layer}</span> · {a.author_role}
          </p>
        </li>
      ))}
    </ul>
  );
}
