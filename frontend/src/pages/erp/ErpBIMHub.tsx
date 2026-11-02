import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BoxIcon, UploadIcon, SearchIcon,
  Layers, Eye, Download,
  AlertCircleIcon, CheckCircle2Icon, Loader2Icon,
  RefreshCwIcon, ExternalLinkIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { axiosClient as api } from '../../services/api/axiosClient';

interface BimModel {
  id: string;
  name: string;
  project_id: string;
  project_name?: string;
  urn: string;
  file_size: number;
  format: string;
  version: number;
  status: string;
  discipline: string;
  uploaded_by: string;
  created_at: string;
}

const disciplineColors: Record<string, string> = {
  ARCHITECTURE: 'bg-blue-100 text-blue-700',
  STRUCTURE: 'bg-red-100 text-red-700',
  MEP: 'bg-green-100 text-green-700',
  ELECTRICITE: 'bg-yellow-100 text-yellow-700',
  PLOMBERIE: 'bg-cyan-100 text-cyan-700',
  CVC: 'bg-purple-100 text-purple-700',
  COORDINATION: 'bg-gray-100 text-gray-700',
};

export function ErpBIMHub() {
  useEffect(() => { document.title = 'Hub BIM | ERP Globus'; }, []);
  const [search, setSearch] = useState('');
  const [discipline, setDiscipline] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bim-models', search, discipline],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (discipline) params.set('discipline', discipline);
      const { data } = await api.get(`/bim/models?${params}`);
      return data;
    },
  });

  const models: BimModel[] = data?.items || [];

  const { data: clashData } = useQuery({
    queryKey: ['bim-clashes'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/bim/clashes?status=OUVERT');
        return data;
      } catch { return { items: [], total: 0 }; }
    },
  });

  const openClashes = clashData?.total || 0;

  const formatSize = (bytes: number) => {
    if (!bytes) return '-';
    if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} Go`;
    if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} Mo`;
    return `${(bytes / 1e3).toFixed(0)} Ko`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-gilroy text-globus-text">Hub BIM</h1>
          <p className="text-gray-500 text-sm">Gestion des maquettes numériques et coordination BIM</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            <RefreshCwIcon size={16} /> Synchroniser APS
          </button>
          <button className="flex items-center gap-2 bg-globus-blue text-white px-4 py-2 rounded-lg font-semibold hover:bg-globus-blue-dark transition-colors">
            <UploadIcon size={18} /> Charger modèle
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Modèles', value: models.length, icon: BoxIcon, color: 'text-globus-blue', bg: 'bg-blue-50' },
          { label: 'Disciplines', value: new Set(models.map(m => m.discipline)).size || 0, icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Clashs ouverts', value: openClashes, icon: AlertCircleIcon, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Dernière sync', value: 'Auj.', icon: RefreshCwIcon, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
            <s.icon size={24} className={s.color} />
            <div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-600">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un modèle..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" />
        </div>
        <select value={discipline} onChange={e => setDiscipline(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Toutes disciplines</option>
          {Object.keys(disciplineColors).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Models Grid */}
      {isLoading ? (
        <div className="bg-white rounded-xl p-10 text-center">
          <Loader2Icon size={24} className="animate-spin mx-auto text-globus-blue" />
        </div>
      ) : models.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center">
          <BoxIcon size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Aucun modèle BIM trouvé</p>
          <p className="text-xs text-gray-400 mt-1">Chargez un fichier IFC, RVT ou NWD pour commencer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map(m => (
            <motion.div key={m.id}
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="bg-gray-900 h-36 flex items-center justify-center relative">
                <BoxIcon size={40} className="text-gray-600" />
                <span className="absolute top-2 right-2 text-xs font-mono text-gray-400 bg-black/50 px-2 py-0.5 rounded">
                  v{m.version}
                </span>
                <span className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded ${disciplineColors[m.discipline] || 'bg-gray-100 text-gray-600'}`}>
                  {m.discipline}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-globus-text truncate">{m.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{m.project_name || 'Projet'}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                  <span>{formatSize(m.file_size)}</span>
                  <span>{m.format?.toUpperCase()}</span>
                  <span>{new Date(m.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 flex items-center justify-center gap-1 text-xs text-globus-blue bg-blue-50 py-1.5 rounded-lg hover:bg-blue-100">
                    <Eye size={12} /> Voir
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-600 bg-gray-50 py-1.5 rounded-lg hover:bg-gray-100">
                    <Download size={12} /> Exporter
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Clash Detection Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-globus-text flex items-center gap-2">
            <AlertCircleIcon size={18} className="text-red-500" /> Détection de clashs
          </h2>
          <button className="text-sm text-globus-blue hover:underline flex items-center gap-1">
            Lancer une analyse <ExternalLinkIcon size={12} />
          </button>
        </div>
        {openClashes > 0 ? (
          <div className="text-sm text-gray-600">
            <span className="font-bold text-red-600">{openClashes}</span> clash(s) ouvert(s) nécessitant résolution.
          </div>
        ) : (
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <CheckCircle2Icon size={14} className="text-green-500" /> Aucun clash détecté
          </div>
        )}
      </div>
    </div>
  );
}
