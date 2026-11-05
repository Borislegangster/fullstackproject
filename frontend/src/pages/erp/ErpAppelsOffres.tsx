import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileTextIcon, PlusIcon, SearchIcon, UsersIcon,
  CalendarIcon, DollarSignIcon,
  XIcon, Loader2Icon,
  AwardIcon, ScaleIcon,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient as api } from '../../services/api/axiosClient';

interface Tender {
  id: string;
  code: string;
  title: string;
  project_id: string;
  project_name?: string;
  lot_id?: string;
  category: string;
  status: string;
  deadline: string;
  budget_estimate: number;
  bid_count: number;
  created_at: string;
}

interface Dispute {
  id: string;
  code: string;
  title: string;
  supplier_name?: string;
  status: string;
  amount: number;
  created_at: string;
}

const tenderStatus: Record<string, { label: string; color: string; bg: string }> = {
  BROUILLON: { label: 'Brouillon', color: 'text-gray-600', bg: 'bg-gray-100' },
  PUBLIE: { label: 'Publié', color: 'text-blue-600', bg: 'bg-blue-50' },
  EN_EVALUATION: { label: 'Évaluation', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ATTRIBUE: { label: 'Attribué', color: 'text-green-600', bg: 'bg-green-50' },
  ANNULE: { label: 'Annulé', color: 'text-red-600', bg: 'bg-red-50' },
  CLOS: { label: 'Clôturé', color: 'text-gray-600', bg: 'bg-gray-100' },
};

const disputeStatus: Record<string, { label: string; color: string; bg: string }> = {
  OUVERT: { label: 'Ouvert', color: 'text-red-600', bg: 'bg-red-50' },
  EN_NEGOCIATION: { label: 'Négociation', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  RESOLU: { label: 'Résolu', color: 'text-green-600', bg: 'bg-green-50' },
  ESCALADE: { label: 'Escaladé', color: 'text-purple-600', bg: 'bg-purple-50' },
};

export function ErpAppelsOffres() {
  useEffect(() => { document.title = 'Appels d\'offres | ERP Globus'; }, []);
  const [tab, setTab] = useState<'tenders' | 'disputes'>('tenders');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const { data: tenderData, isLoading: loadingTenders } = useQuery({
    queryKey: ['tenders', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/tenders?${params}`);
      return data;
    },
    enabled: tab === 'tenders',
  });

  const { data: disputeData, isLoading: loadingDisputes } = useQuery({
    queryKey: ['disputes', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const { data } = await api.get(`/disputes?${params}`);
      return data;
    },
    enabled: tab === 'disputes',
  });

  const tenders: Tender[] = tenderData?.items || [];
  const disputes: Dispute[] = disputeData?.items || [];

  const fmtXAF = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n || 0);

  const [form, setForm] = useState({ title: '', category: '', deadline: '', budget_estimate: '', project_id: '' });
  const createTender = useMutation({
    mutationFn: (body: any) => api.post('/tenders', { ...body, budget_estimate: parseInt(body.budget_estimate) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenders'] }); setShowModal(false); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-gilroy text-globus-text">Appels d'offres & Litiges</h1>
          <p className="text-gray-500 text-sm">Gestion des consultations et contentieux fournisseurs</p>
        </div>
        {tab === 'tenders' && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-globus-blue text-white px-4 py-2 rounded-lg font-semibold hover:bg-globus-blue-dark transition-colors">
            <PlusIcon size={18} /> Nouvel appel d'offres
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Appels actifs', value: tenders.filter(t => ['PUBLIE', 'EN_EVALUATION'].includes(t.status)).length, icon: FileTextIcon, color: 'text-globus-blue', bg: 'bg-blue-50' },
          { label: 'Attribués', value: tenders.filter(t => t.status === 'ATTRIBUE').length, icon: AwardIcon, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Litiges ouverts', value: disputes.filter(d => ['OUVERT', 'EN_NEGOCIATION'].includes(d.status)).length, icon: ScaleIcon, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Offres reçues', value: tenders.reduce((a, t) => a + (t.bid_count || 0), 0), icon: UsersIcon, color: 'text-purple-600', bg: 'bg-purple-50' },
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => { setTab('tenders'); setSearch(''); setStatusFilter(''); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'tenders' ? 'bg-white shadow text-globus-blue' : 'text-gray-600'}`}>
          Appels d'offres
        </button>
        <button onClick={() => { setTab('disputes'); setSearch(''); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'disputes' ? 'bg-white shadow text-globus-blue' : 'text-gray-600'}`}>
          Litiges
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'tenders' ? 'Rechercher un appel d\'offres...' : 'Rechercher un litige...'}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" />
        </div>
        {tab === 'tenders' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Tous les statuts</option>
            {Object.entries(tenderStatus).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
      </div>

      {/* Tenders */}
      {tab === 'tenders' && (
        <div className="space-y-3">
          {loadingTenders ? (
            <div className="bg-white rounded-xl p-10 text-center"><Loader2Icon size={24} className="animate-spin mx-auto text-globus-blue" /></div>
          ) : tenders.length === 0 ? (
            <div className="bg-white rounded-xl p-10 text-center text-gray-500">Aucun appel d'offres</div>
          ) : (
            tenders.map(t => {
              const st = tenderStatus[t.status] || tenderStatus.BROUILLON;
              return (
                <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-globus-blue">{t.code}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                        {t.category && <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{t.category}</span>}
                      </div>
                      <h3 className="font-semibold text-globus-text">{t.title}</h3>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                        <span className="flex items-center gap-1"><CalendarIcon size={11} /> Deadline: {t.deadline}</span>
                        <span className="flex items-center gap-1"><DollarSignIcon size={11} /> Budget: {fmtXAF(t.budget_estimate)}</span>
                        <span className="flex items-center gap-1"><UsersIcon size={11} /> {t.bid_count || 0} offre(s)</span>
                      </div>
                    </div>
                    <button className="text-sm text-globus-blue hover:underline">Détails</button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Disputes */}
      {tab === 'disputes' && (
        <div className="space-y-3">
          {loadingDisputes ? (
            <div className="bg-white rounded-xl p-10 text-center"><Loader2Icon size={24} className="animate-spin mx-auto text-globus-blue" /></div>
          ) : disputes.length === 0 ? (
            <div className="bg-white rounded-xl p-10 text-center text-gray-500">Aucun litige en cours</div>
          ) : (
            disputes.map(d => {
              const st = disputeStatus[d.status] || disputeStatus.OUVERT;
              return (
                <motion.div key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-red-400">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-red-600">{d.code}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                      </div>
                      <h3 className="font-semibold text-globus-text">{d.title}</h3>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        {d.supplier_name && <span>{d.supplier_name}</span>}
                        <span className="flex items-center gap-1"><DollarSignIcon size={11} /> Montant: {fmtXAF(d.amount)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Create Tender Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-globus-text">Nouvel appel d'offres</h2>
                <button onClick={() => setShowModal(false)}><XIcon size={20} className="text-gray-400" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                  <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2">
                      <option value="">Sélectionner</option>
                      <option value="GROS_OEUVRE">Gros oeuvre</option>
                      <option value="SECOND_OEUVRE">Second oeuvre</option>
                      <option value="MATERIAUX">Matériaux</option>
                      <option value="EQUIPEMENT">Équipement</option>
                      <option value="ETUDES">Études</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date limite</label>
                    <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget estimé (FCFA)</label>
                  <input type="number" value={form.budget_estimate} onChange={e => setForm(f => ({ ...f, budget_estimate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600">Annuler</button>
                <button onClick={() => createTender.mutate(form)}
                  disabled={!form.title || createTender.isPending}
                  className="px-4 py-2 rounded-lg bg-globus-blue text-white font-semibold disabled:opacity-50">
                  {createTender.isPending ? <Loader2Icon size={16} className="animate-spin" /> : 'Créer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
