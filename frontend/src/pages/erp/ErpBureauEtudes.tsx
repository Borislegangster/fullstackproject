/**
 * ErpBureauEtudes — Bureau d'Études Virtuel & Collaboratif
 *
 * Two distinct screens served by the same route:
 *   /erp/bureau-etudes           → Session list (create / join / archive)
 *   /erp/bureau-etudes/:id       → Live collaborative viewer
 */
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCollaboration } from '../../hooks/useCollaboration';
import type { DrawingTool } from '../../components/bim/CollaborationCanvas';
import { collaborationApi, type CollaborationSession } from '../../services/api/collaboration.api';
import { ForgeViewer } from '../../components/bim/ForgeViewer';
import { CollaborationCanvas } from '../../components/bim/CollaborationCanvas';
import { CollaborationToolbar } from '../../components/bim/CollaborationToolbar';
import { SessionSidebar } from '../../components/bim/SessionSidebar';
import { VideoGrid } from '../../components/bim/VideoGrid';
import { useWebRTC } from '../../hooks/useWebRTC';
import { VideoIcon, HardHatIcon } from 'lucide-react';
import { formatDateTime } from '../../utils/datetime';

// ── Entry point ──────────────────────────────────────────────

export function ErpBureauEtudes() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  if (sessionId) return <CollaborativeViewer sessionId={sessionId} />;
  return <SessionsListScreen />;
}

// ── Sessions list ────────────────────────────────────────────

function SessionsListScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<CollaborationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await collaborationApi.listSessions();
      setSessions(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'CHEF_PROJET';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-montserrat font-bold text-globus-blue-dark">
            Bureau d'Études Virtuel
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Collaboration temps réel sur plans 2D/3D — annotations, curseurs partagés, snapshots
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-globus-blue-dark text-white px-4 py-2 rounded-lg hover:bg-globus-blue transition-colors font-medium text-sm">
            + Nouvelle session
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: '🖥️', title: 'Viewer BIM/2D', desc: 'Revit, DWG, IFC dans le navigateur via Autodesk APS' },
          { icon: '👥', title: 'Multi-utilisateurs', desc: 'Curseurs colorés, annotations par couche, mode présentateur' },
          { icon: '📸', title: 'Snapshots', desc: 'Capture annotée partageable avec le client' },
        ].map((f) => (
          <div key={f.title} className="p-4 rounded-xl border bg-white flex items-start gap-3">
            <span className="text-2xl">{f.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">{f.title}</h3>
              <p className="text-xs text-gray-600 mt-1">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Sessions actives & archivées</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-globus-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState onCreate={() => setShowCreateModal(true)} canCreate={canCreate} />
        ) : (
          <div className="divide-y divide-gray-100">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} onJoin={() => navigate(`/erp/bureau-etudes/${s.id}`)} />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => navigate(`/erp/bureau-etudes/${id}`)}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate, canCreate }: { onCreate: () => void; canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <span className="text-4xl">🔬</span>
      </div>
      <h3 className="font-semibold text-gray-700 mb-2">Aucune session</h3>
      <p className="text-sm text-gray-400 max-w-sm mb-6">
        Créez une session de revue pour commencer à collaborer sur vos plans en temps réel.
      </p>
      {canCreate && (
        <button
          onClick={onCreate}
          className="bg-globus-blue-dark text-white px-6 py-2.5 rounded-lg hover:bg-globus-blue transition-colors font-medium text-sm">
          Créer ma première session
        </button>
      )}
    </div>
  );
}

function SessionRow({ session, onJoin }: { session: CollaborationSession; onJoin: () => void }) {
  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    ENDED: 'bg-gray-100 text-gray-500',
  };
  return (
    <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <span className="text-lg">📐</span>
        </div>
        <div>
          <p className="font-medium text-sm text-gray-800">
            Session {session.id.slice(0, 8)} · Projet {session.project_id.slice(0, 6)}
          </p>
          <p className="text-xs text-gray-400">
            {session.participants?.length ?? 0} participant(s) · {formatDateTime(session.started_at)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[session.status] || ''}`}>
          {session.status === 'ACTIVE' ? '● Actif' : 'Terminé'}
        </span>
        {session.status === 'ACTIVE' && (
          <button
            onClick={onJoin}
            className="text-sm bg-globus-blue-dark text-white px-3 py-1.5 rounded-lg hover:bg-globus-blue transition-colors font-medium">
            Rejoindre
          </button>
        )}
      </div>
    </div>
  );
}

// ── Create modal ─────────────────────────────────────────────

function CreateSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [projectId, setProjectId] = useState('');
  const [planUrn, setPlanUrn] = useState('');
  const [bimFile, setBimFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!projectId) { setError('Project ID requis'); return; }
    setError('');
    setCreating(true);
    try {
      let urn = planUrn.trim();
      if (!urn && bimFile) {
        const uploaded = await collaborationApi.uploadBim(projectId, bimFile);
        urn = uploaded.urn;
      }
      if (!urn) { setError('URN ou fichier BIM requis'); return; }
      const session = await collaborationApi.createSession({ project_id: projectId, plan_urn: urn });
      onCreated(session.session_id);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur création session');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Nouvelle session collaborative</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID du Projet</label>
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="ex: PRJ-2026-001"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URN du Plan (APS)</label>
            <input
              value={planUrn}
              onChange={(e) => setPlanUrn(e.target.value)}
              placeholder="dXJuOmFkc2sub2JqZWN0czEv... (laisser vide pour uploader un fichier)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-globus-blue" />
          </div>
          <div className="text-center text-xs text-gray-400">— OU —</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uploader un fichier BIM</label>
            <input
              type="file"
              accept=".rvt,.dwg,.ifc,.nwd"
              onChange={(e) => setBimFile(e.target.files?.[0] || null)}
              className="w-full text-sm" />
            <p className="text-xs text-gray-400 mt-1">.rvt, .dwg, .ifc, .nwd — max 500 MB</p>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !projectId}
              className="flex-1 bg-globus-blue-dark text-white rounded-lg py-2 text-sm font-medium hover:bg-globus-blue disabled:opacity-50">
              {creating ? 'Création...' : 'Créer la session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Live collaborative viewer ────────────────────────────────

function CollaborativeViewer({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [tool, setTool] = useState<DrawingTool>('none');
  const [activeLayer, setActiveLayer] = useState('architecture');
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    new Set(['architecture', 'structure', 'electricite', 'plomberie', 'decisions', 'general'])
  );
  const viewerRef = useRef<any>(null);

  const collab = useCollaboration({
    sessionId,
    onSessionEnded: () => navigate('/erp/bureau-etudes'),
  });

  const [visioOn, setVisioOn] = useState(false);
  // "Mode terrain" (tablette durcie) : vue seule + audio + pointeur, sans
  // barre d'outils ni panneau latéral. Auto-activé sur petit écran.
  const [fieldMode, setFieldMode] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 820
  );
  const rtc = useWebRTC({
    sessionId,
    send: collab.send,
    participants: collab.participants,
    enabled: visioOn,
  });

  // En mode terrain, la visio passe en audio seul (réseau chantier).
  useEffect(() => {
    if (fieldMode && visioOn) rtc.degrade();
  }, [fieldMode, visioOn, rtc]);

  // Pull the session metadata + existing annotations
  useEffect(() => {
    collaborationApi.getSession(sessionId)
      .then(setSession)
      .catch((err) => {
        console.error(err);
        navigate('/erp/bureau-etudes');
      });
  }, [sessionId, navigate]);

  const toggleLayer = (layer: string) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  const handleSnapshot = async () => {
    // Capture the viewer canvas; if not ready, capture the whole stage as fallback.
    let imageData = '';
    try {
      const screenshot = viewerRef.current?.getScreenShot?.(800, 600);
      if (typeof screenshot === 'string') imageData = screenshot;
    } catch (e) { /* viewer may not be ready */ }

    if (!imageData) {
      alert('Le viewer n\'est pas encore prêt — réessayez dans quelques secondes.');
      return;
    }
    try {
      // Phase 7 will upload to /admin/media/upload. For now we send the data URL straight.
      await collaborationApi.takeSnapshot(sessionId, {
        image_url: imageData,
        notes: '',
        shared_with_client: false,
      });
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erreur capture');
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col -m-4 lg:-m-6 bg-gray-100">
      {/* Header */}
      <div className="h-12 bg-gray-900 text-white flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/erp/bureau-etudes')}
            className="text-gray-400 hover:text-white transition-colors text-sm">
            ← Quitter
          </button>
          <div className={`w-2 h-2 rounded-full ${collab.connected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
          <span className="font-semibold text-sm">Bureau d'Études Virtuel</span>
          <span className="text-gray-400 text-xs">— Session {sessionId.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setVisioOn((v) => !v)}
            title={visioOn ? 'Quitter la visio' : 'Lancer la visioconférence'}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${visioOn ? 'bg-globus-orange text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <VideoIcon className="w-3.5 h-3.5" /> Visio
          </button>
          <button
            onClick={() => setFieldMode((v) => !v)}
            title={fieldMode ? 'Repasser en mode complet' : 'Mode terrain (vue + audio + pointeur)'}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${fieldMode ? 'bg-globus-orange text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <HardHatIcon className="w-3.5 h-3.5" /> Terrain
          </button>
          <div className="flex -space-x-2">
          {collab.participants.slice(0, 5).map((p) => (
            <div
              key={p.id}
              title={`${p.name} (${p.role})`}
              className="w-7 h-7 rounded-full border-2 border-gray-900 flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: p.color }}>
              {p.name?.charAt(0) || '?'}
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* Toolbar (masquée en mode terrain) */}
      {!fieldMode && (
        <CollaborationToolbar
          collab={collab}
          tool={tool}
          setTool={setTool}
          activeLayer={activeLayer}
          setActiveLayer={setActiveLayer}
          visibleLayers={visibleLayers}
          toggleLayer={toggleLayer}
          onSnapshot={handleSnapshot}
          isAdmin={isAdmin}
          currentUserId={user?.id}
        />
      )}

      {/* Stage = viewer + collab canvas + sidebar */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative">
          {session ? (
            <>
              <ForgeViewer
                urn={session.plan_urn}
                onViewerReady={(v) => { viewerRef.current = v; }}
                className="absolute inset-0" />
              <CollaborationCanvas
                collab={collab}
                activeLayer={activeLayer}
                tool={fieldMode ? 'none' : tool}
                visibleLayers={visibleLayers} />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {!fieldMode && (
          <SessionSidebar
            sessionId={sessionId}
            collab={collab}
            currentUserId={user?.id}
            isAdmin={isAdmin} />
        )}
      </div>

      {visioOn && (
        <VideoGrid
          localStream={rtc.localStream}
          remote={rtc.remote}
          micOn={rtc.micOn}
          camOn={rtc.camOn}
          recording={rtc.recording}
          error={rtc.error}
          toggleMic={rtc.toggleMic}
          toggleCam={rtc.toggleCam}
          degrade={rtc.degrade}
          startRecording={rtc.startRecording}
          stopRecording={rtc.stopRecording}
          selfName={user?.full_name || 'Moi'}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
