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
import { useProjects } from '../../hooks/useErp';
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
  // Vrais projets — plus de saisie libre d'ID (source d'erreurs 404).
  const { data: projects } = useProjects();
  const projectOptions: any[] = Array.isArray(projects) ? projects : [];

  const handleCreate = async () => {
    if (!projectId) { setError('Sélectionnez un projet'); return; }
    setError('');
    setCreating(true);
    try {
      let urn = planUrn.trim();
      if (!urn && bimFile) {
        // L'upload BIM nécessite Autodesk APS — une erreur ici n'empêche pas
        // de créer la session en mode annotation libre (sans maquette).
        const uploaded = await collaborationApi.uploadBim(projectId, bimFile);
        urn = uploaded.urn;
      }
      // La maquette est OPTIONNELLE : sans URN, la session s'ouvre en mode
      // « annotation libre » (curseurs, annotations, chat, visio, snapshots).
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Projet</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue bg-white">
              <option value="">— Sélectionner un projet —</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>
              ))}
            </select>
            {projectOptions.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Aucun projet — créez d'abord un chantier (ou convertissez un lead CRM).
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maquette BIM <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              value={planUrn}
              onChange={(e) => setPlanUrn(e.target.value)}
              placeholder="URN APS (dXJuOmFkc2su...) — ou uploadez un fichier ci-dessous"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-globus-blue" />
          </div>
          <div>
            <input
              type="file"
              accept=".rvt,.dwg,.ifc,.nwd"
              onChange={(e) => setBimFile(e.target.files?.[0] || null)}
              className="w-full text-sm" />
            <p className="text-xs text-gray-400 mt-1">
              .rvt, .dwg, .ifc, .nwd — max 500 MB (nécessite Autodesk APS configuré)
            </p>
            <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
              💡 Sans maquette, la session s'ouvre en <b>mode annotation libre</b> :
              curseurs partagés, annotations par calque, chat, visio et snapshots restent disponibles.
            </p>
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

  // Capture silencieuse du viewer → data URL base64. IMPORTANT: getScreenShot
  // SANS callback ouvre la capture dans un nouvel onglet (comportement
  // Autodesk) — on passe donc toujours un callback et on convertit le blob.
  const captureViewerImage = (): Promise<string> =>
    new Promise((resolve) => {
      const v = viewerRef.current;
      if (!v?.getScreenShot) return resolve('');
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; resolve(''); } }, 4000);
      try {
        v.getScreenShot(1024, 768, async (blobUrl: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try {
            const blob = await fetch(blobUrl).then((r) => r.blob());
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          } catch {
            resolve('');
          } finally {
            try { URL.revokeObjectURL(blobUrl); } catch { /* noop */ }
          }
        });
      } catch {
        clearTimeout(timer);
        if (!settled) { settled = true; resolve(''); }
      }
    });

  const handleSnapshot = async () => {
    // Capture the viewer canvas; if not ready, capture the whole stage as fallback.
    let imageData = '';
    try {
      imageData = await captureViewerImage();
    } catch (e) { /* viewer may not be ready */ }

    // En mode annotation libre (pas de maquette), le snapshot est archivé
    // sans image de fond (les annotations + notes restent dans le PDF GED).
    if (!imageData && session?.plan_urn) {
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
              {session.plan_urn ? (
                <ForgeViewer
                  urn={session.plan_urn}
                  onViewerReady={(v) => { viewerRef.current = v; }}
                  className="absolute inset-0" />
              ) : (
                /* Mode annotation libre — pas de maquette BIM : fond quadrillé
                   type table à dessin, toutes les fonctions collab actives. */
                <div
                  className="absolute inset-0 bg-white"
                  style={{
                    backgroundImage:
                      'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px), linear-gradient(#f3f4f6 1px, transparent 1px), linear-gradient(90deg, #f3f4f6 1px, transparent 1px)',
                    backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
                  }}>
                  <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-gray-400 bg-white/80 px-3 py-1 rounded-full border border-gray-200">
                    Mode annotation libre — aucune maquette BIM associée
                  </span>
                </div>
              )}
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
