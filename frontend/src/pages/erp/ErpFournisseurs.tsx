import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon, SearchIcon, StarIcon, PhoneIcon, MailIcon,
  MapPinIcon, XIcon, Loader2Icon,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient as api } from '../../services/api/axiosClient';

interface Supplier {
  id: string;
  code: string;
  company_name: string;
  category: string;
  email: string;
  phone: string;
  city: string;
  status: string;
  quality_score: number;
}

export function ErpFournisseurs() {
  useEffect(() => { document.title = 'Fournisseurs | ERP Globus'; }, []);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', search, category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      const { data } = await api.get(`/suppliers?${params}`);
      return data;
    },
  });

  const suppliers: Supplier[] = data?.items || [];
  const total = data?.total || 0;

  const categories = ['Matériaux', 'Équipement', 'Outillage', 'Électricité', 'Plomberie', 'Menuiserie', 'Béton', 'Acier'];

  // Create supplier
  const [form, setForm] = useState({ company_name: '', category: '', phone: '', email: '', city: '', country: 'Cameroun' });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/suppliers', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setShowModal(false); setForm({ company_name: '', category: '', phone: '', email: '', city: '', country: 'Cameroun' }); },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-gilroy text-globus-text">Fournisseurs</h1>
          <p className="text-gray-500 text-sm">{total} fournisseur(s) enregistré(s)</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-globus-blue text-white px-4 py-2 rounded-lg font-semibold hover:bg-globus-blue-dark transition-colors">
          <PlusIcon size={18} /> Nouveau fournisseur
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un fournisseur..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue"
          />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center">
            <Loader2Icon size={24} className="animate-spin mx-auto text-globus-blue" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-10 text-center text-gray-500">Aucun fournisseur trouvé</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Nom</th>
                <th className="text-left px-4 py-3">Catégorie</th>
                <th className="text-left px-4 py-3">Ville</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-center px-4 py-3">Qualité</th>
                <th className="text-center px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs text-globus-blue">{s.code}</td>
                  <td className="px-4 py-3 font-medium text-globus-text">{s.company_name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.category}</td>
                  <td className="px-4 py-3 text-gray-600 flex items-center gap-1"><MapPinIcon size={12} /> {s.city}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-500">
                      {s.phone && <PhoneIcon size={12} />}
                      {s.email && <MailIcon size={12} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <StarIcon size={14} className="text-yellow-400 fill-yellow-400" />
                      <span className="font-semibold">{s.quality_score?.toFixed(1) || '-'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      s.status === 'ACTIF' ? 'bg-green-50 text-green-600' :
                      s.status === 'SUSPENDU' ? 'bg-yellow-50 text-yellow-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-globus-text">Nouveau fournisseur</h2>
                <button onClick={() => setShowModal(false)}><XIcon size={20} className="text-gray-400" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Raison sociale *</label>
                  <input type="text" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2">
                      <option value="">Sélectionner</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                    <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600">Annuler</button>
                <button
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.company_name || createMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-globus-blue text-white font-semibold disabled:opacity-50"
                >
                  {createMutation.isPending ? <Loader2Icon size={16} className="animate-spin" /> : 'Créer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
