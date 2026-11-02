/**
 * CollaborationToolbar — Controls for the Bureau d'Études session.
 *
 *   - Pencil / pointer toggle.
 *   - Active layer picker (color-coded).
 *   - Visibility toggles per layer.
 *   - Session mode (FREE ↔ PRESENTER) — ADMIN only.
 *   - Snapshot button.
 */
import React from 'react';
import {
  MousePointerIcon, PencilIcon, CameraIcon, UsersIcon, EyeIcon, EyeOffIcon,
  CheckCircle2Icon, XCircleIcon,
} from 'lucide-react';
import type { CollaborationApi, SessionMode } from '../../hooks/useCollaboration';
import { LAYER_COLORS, type DrawingTool } from './CollaborationCanvas';

const LAYERS = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'structure', label: 'Structure' },
  { id: 'electricite', label: 'Électricité' },
  { id: 'plomberie', label: 'Plomberie' },
  { id: 'general', label: 'Général' },
];

interface Props {
  collab: CollaborationApi;
  tool: DrawingTool;
  setTool: (t: DrawingTool) => void;
  activeLayer: string;
  setActiveLayer: (l: string) => void;
  visibleLayers: Set<string>;
  toggleLayer: (l: string) => void;
  onSnapshot: () => void;
  /** Whether the current user is the ADMIN of the session (can change mode). */
  isAdmin: boolean;
  currentUserId?: string;
}

export function CollaborationToolbar({
  collab, tool, setTool, activeLayer, setActiveLayer,
  visibleLayers, toggleLayer, onSnapshot, isAdmin, currentUserId,
}: Props) {
  const handleModeToggle = () => {
    const next: SessionMode = collab.mode === 'FREE' ? 'PRESENTER' : 'FREE';
    collab.setMode(next);
  };

  const isPresenter = !!(collab.presenterId && collab.presenterId === currentUserId);
  const presenterLockOthers = collab.mode === 'PRESENTER' && !isPresenter;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-wrap shrink-0">
      {/* Pointer / Pencil */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <ToolBtn
          active={tool === 'none'}
          onClick={() => setTool('none')}
          title="Mode pointeur"
          icon={<MousePointerIcon className="w-4 h-4" />}
          label="Pointer"
        />
        <ToolBtn
          active={tool === 'pencil'}
          onClick={() => setTool('pencil')}
          title="Dessiner une annotation"
          icon={<PencilIcon className="w-4 h-4" />}
          label="Crayon"
          disabled={presenterLockOthers}
        />
      </div>

      <div className="h-6 w-px bg-gray-200" />

      {/* Active layer */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-semibold uppercase">Couche :</span>
        <select
          value={activeLayer}
          onChange={(e) => setActiveLayer(e.target.value)}
          disabled={presenterLockOthers}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-globus-orange disabled:opacity-50"
          style={{ borderLeft: `4px solid ${LAYER_COLORS[activeLayer] || '#000'}` }}>
          {LAYERS.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="h-6 w-px bg-gray-200" />

      {/* Layer visibility */}
      <div className="flex items-center gap-1">
        {LAYERS.map((l) => {
          const visible = visibleLayers.has(l.id);
          return (
            <button
              key={l.id}
              onClick={() => toggleLayer(l.id)}
              title={`${visible ? 'Masquer' : 'Afficher'} ${l.label}`}
              className={`px-2 py-1 text-xs font-bold rounded transition-colors flex items-center gap-1
                ${visible ? 'text-gray-800' : 'text-gray-400'}`}
              style={{ borderBottom: `2px solid ${visible ? LAYER_COLORS[l.id] : 'transparent'}` }}>
              {visible ? <EyeIcon className="w-3 h-3" /> : <EyeOffIcon className="w-3 h-3" />}
              {l.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Mode + snapshot + participants */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-xs">
          <UsersIcon className="w-4 h-4 text-globus-blue-dark" />
          <span className="font-semibold">{collab.participants.length}</span>
        </span>

        {isAdmin && (
          <button
            onClick={handleModeToggle}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors
              ${collab.mode === 'PRESENTER'
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
            {collab.mode === 'PRESENTER' ? '🎤 Mode présentateur' : 'Mode libre'}
          </button>
        )}

        <span className={`flex items-center gap-1 text-xs ${collab.connected ? 'text-green-600' : 'text-red-600'}`}>
          {collab.connected
            ? <><CheckCircle2Icon className="w-3 h-3" /> Connecté</>
            : <><XCircleIcon className="w-3 h-3" /> Déconnecté</>}
        </span>

        <button
          onClick={onSnapshot}
          className="bg-globus-orange hover:bg-globus-orange-hover text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1">
          <CameraIcon className="w-3 h-3" /> Snapshot
        </button>
      </div>
    </div>
  );
}

function ToolBtn({
  active, onClick, icon, label, title, disabled,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; title: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded transition-colors
        ${active ? 'bg-white text-globus-blue-dark shadow-sm' : 'text-gray-600 hover:text-gray-800'}
        disabled:opacity-50 disabled:cursor-not-allowed`}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
