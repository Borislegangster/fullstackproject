/**
 * SessionsPanel — Lists active sessions and lets the user revoke them.
 */
import { useEffect, useState } from 'react';
import { MonitorIcon, LogOutIcon, AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';
import {
  listSessionsApi, revokeSessionApi, revokeOtherSessionsApi,
  type SessionInfo,
} from '../../services/api/auth.api';
import { formatDate } from '../../utils/datetime';

function formatLastSeen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return formatDate(d);
}

export function SessionsPanel() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await listSessionsApi();
      setSessions(list);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleRevoke = async (id: string) => {
    setBusy(true);
    try {
      await revokeSessionApi(id);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeAllOthers = async () => {
    if (!confirm('Déconnecter tous les autres appareils ?')) return;
    setBusy(true);
    try {
      await revokeOtherSessionsApi();
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-montserrat font-bold text-sm text-globus-blue-dark flex items-center gap-2">
          <MonitorIcon className="w-5 h-5" /> Appareils connectés
        </h3>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={loading || busy}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1.5"
            title="Rafraîchir">
            <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {sessions.length > 1 && (
            <button
              onClick={handleRevokeAllOthers}
              disabled={busy}
              className="text-xs text-red-600 hover:text-red-700 font-semibold">
              Déconnecter tous les autres
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangleIcon className="w-3 h-3" /> {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune session active.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-globus-blue-dark truncate">
                  {s.device_label || 'Appareil inconnu'}
                </p>
                <p className="text-xs text-gray-500">
                  {s.ip_address || '—'} · {formatLastSeen(s.last_active_at)}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(s.id)}
                disabled={busy}
                title="Révoquer cette session"
                className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors">
                <LogOutIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
