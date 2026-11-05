import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TruckIcon, PlusIcon, SearchIcon, PackageIcon,
  CheckCircle2Icon, AlertTriangleIcon,
  CalendarIcon, Loader2Icon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { axiosClient as api } from '../../services/api/axiosClient';

interface Delivery {
  id: string;
  code: string;
  supplier_id: string;
  supplier_name?: string;
  project_id: string;
  project_name?: string;
  expected_date: string;
  actual_date?: string;
  status: string;
  items: { description: string; quantity: number; unit: string }[];
  notes: string;
  created_at: string;
}

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  PLANIFIEE: { label: 'Planifiée', color: 'text-blue-600', bg: 'bg-blue-50' },
  EN_TRANSIT: { label: 'En transit', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  LIVREE: { label: 'Livrée', color: 'text-green-600', bg: 'bg-green-50' },
  PARTIELLE: { label: 'Partielle', color: 'text-orange-600', bg: 'bg-orange-50' },
  REFUSEE: { label: 'Refusée', color: 'text-red-600', bg: 'bg-red-50' },
};

export function ErpLivraisons() {
  useEffect(() => { document.title = 'Livraisons | ERP Globus'; }, []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['deliveries', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/deliveries?${params}`);
      return data;
    },
  });

  const deliveries: Delivery[] = data?.items || [];
  const total = data?.total || 0;

  const stats = {
    planned: deliveries.filter(d => d.status === 'PLANIFIEE').length,
    transit: deliveries.filter(d => d.status === 'EN_TRANSIT').length,
    delivered: deliveries.filter(d => d.status === 'LIVREE').length,
    issues: deliveries.filter(d => ['PARTIELLE', 'REFUSEE'].includes(d.status)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-gilroy text-globus-text">Livraisons</h1>
          <p className="text-gray-500 text-sm">{total} livraison(s) au total</p>
        </div>
        <button className="flex items-center gap-2 bg-globus-blue text-white px-4 py-2 rounded-lg font-semibold hover:bg-globus-blue-dark transition-colors">
          <PlusIcon size={18} /> Nouvelle livraison
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Planifiées', value: stats.planned, icon: CalendarIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'En transit', value: stats.transit, icon: TruckIcon, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Livrées', value: stats.delivered, icon: CheckCircle2Icon, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Problèmes', value: stats.issues, icon: AlertTriangleIcon, color: 'text-red-600', bg: 'bg-red-50' },
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
            placeholder="Rechercher par code ou fournisseur..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Tous les statuts</option>
          {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl p-10 text-center">
            <Loader2Icon size={24} className="animate-spin mx-auto text-globus-blue" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center text-gray-500">Aucune livraison trouvée</div>
        ) : (
          deliveries.map(d => {
            const st = statusMap[d.status] || statusMap.PLANIFIEE;
            return (
              <motion.div key={d.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg ${st.bg} flex items-center justify-center`}>
                      <TruckIcon size={20} className={st.color} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-globus-blue">{d.code}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                      </div>
                      <div className="text-sm font-medium text-globus-text">{d.supplier_name || 'Fournisseur'}</div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1"><CalendarIcon size={11} /> Prévu: {d.expected_date}</span>
                        {d.actual_date && <span className="flex items-center gap-1"><CheckCircle2Icon size={11} /> Reçu: {d.actual_date}</span>}
                        {d.items && <span className="flex items-center gap-1"><PackageIcon size={11} /> {d.items.length} article(s)</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
