import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MailIcon, PlusIcon, SendIcon, Users2Icon,
  EyeIcon, XIcon, Loader2Icon,
  CalendarIcon, TrendingUpIcon,
  SearchIcon,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient as api } from '../../services/api/axiosClient';

interface Campaign {
  id: string;
  subject: string;
  status: string;
  sent_count: number;
  open_rate: number;
  click_rate: number;
  scheduled_at?: string;
  sent_at?: string;
  created_at: string;
}

interface Subscriber {
  id: string;
  email: string;
  name?: string;
  universe?: string;
  status: string;
  subscribed_at: string;
}

const statusStyles: Record<string, { label: string; color: string; bg: string }> = {
  BROUILLON: { label: 'Brouillon', color: 'text-gray-600', bg: 'bg-gray-100' },
  PLANIFIE: { label: 'Planifié', color: 'text-blue-600', bg: 'bg-blue-50' },
  EN_COURS: { label: 'En cours', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ENVOYE: { label: 'Envoyé', color: 'text-green-600', bg: 'bg-green-50' },
};

export function ErpNewsletter() {
  useEffect(() => { document.title = 'Newsletter & Marketing | ERP Globus'; }, []);
  const [tab, setTab] = useState<'campaigns' | 'subscribers'>('campaigns');
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: campaignData, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['newsletter-campaigns', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const { data } = await api.get(`/newsletter/campaigns?${params}`);
      return data;
    },
    enabled: tab === 'campaigns',
  });

  const { data: subscriberData, isLoading: loadingSubs } = useQuery({
    queryKey: ['newsletter-subscribers', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const { data } = await api.get(`/newsletter/subscribers?${params}`);
      return data;
    },
    enabled: tab === 'subscribers',
  });

  const campaigns: Campaign[] = campaignData?.items || [];
  const subscribers: Subscriber[] = subscriberData?.items || [];
  const totalSubs = subscriberData?.total || 0;

  // Campaign form
  const [form, setForm] = useState({ subject: '', body_html: '', universe: '' });
  const createCampaign = useMutation({
    mutationFn: (body: typeof form) => api.post('/newsletter/campaigns', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['newsletter-campaigns'] }); setShowModal(false); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-gilroy text-globus-text">Newsletter & Marketing</h1>
          <p className="text-gray-500 text-sm">Campagnes email et gestion des abonnés</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-globus-blue text-white px-4 py-2 rounded-lg font-semibold hover:bg-globus-blue-dark transition-colors">
          <PlusIcon size={18} /> Nouvelle campagne
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Abonnés', value: totalSubs, icon: Users2Icon, color: 'text-globus-blue', bg: 'bg-blue-50' },
          { label: 'Campagnes', value: campaigns.length, icon: MailIcon, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Taux ouverture moy.', value: campaigns.length ? `${(campaigns.reduce((a, c) => a + (c.open_rate || 0), 0) / campaigns.length).toFixed(0)}%` : '-', icon: EyeIcon, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Taux clic moy.', value: campaigns.length ? `${(campaigns.reduce((a, c) => a + (c.click_rate || 0), 0) / campaigns.length).toFixed(0)}%` : '-', icon: TrendingUpIcon, color: 'text-orange-600', bg: 'bg-orange-50' },
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
        <button onClick={() => setTab('campaigns')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'campaigns' ? 'bg-white shadow text-globus-blue' : 'text-gray-600'}`}>
          Campagnes
        </button>
        <button onClick={() => setTab('subscribers')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'subscribers' ? 'bg-white shadow text-globus-blue' : 'text-gray-600'}`}>
          Abonnés
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'campaigns' ? 'Rechercher une campagne...' : 'Rechercher un abonné...'}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-globus-blue/20 focus:border-globus-blue" />
      </div>

      {/* Campaigns Tab */}
      {tab === 'campaigns' && (
        <div className="space-y-3">
          {loadingCampaigns ? (
            <div className="bg-white rounded-xl p-10 text-center"><Loader2Icon size={24} className="animate-spin mx-auto text-globus-blue" /></div>
          ) : campaigns.length === 0 ? (
            <div className="bg-white rounded-xl p-10 text-center text-gray-500">Aucune campagne</div>
          ) : (
            campaigns.map(c => {
              const st = statusStyles[c.status] || statusStyles.BROUILLON;
              return (
                <motion.div key={c.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-globus-text">{c.subject}</h3>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {c.sent_at && <span className="flex items-center gap-1"><SendIcon size={11} /> Envoyé: {new Date(c.sent_at).toLocaleDateString('fr-FR')}</span>}
                        {c.scheduled_at && <span className="flex items-center gap-1"><CalendarIcon size={11} /> Planifié: {new Date(c.scheduled_at).toLocaleDateString('fr-FR')}</span>}
                        <span className="flex items-center gap-1"><Users2Icon size={11} /> {c.sent_count} destinataires</span>
                      </div>
                    </div>
                    {c.status === 'ENVOYE' && (
                      <div className="flex gap-6 text-center">
                        <div>
                          <div className="text-lg font-bold text-green-600">{c.open_rate?.toFixed(0) || 0}%</div>
                          <div className="text-xs text-gray-500">Ouvertures</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-globus-blue">{c.click_rate?.toFixed(0) || 0}%</div>
                          <div className="text-xs text-gray-500">Clics</div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Subscribers Tab */}
      {tab === 'subscribers' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loadingSubs ? (
            <div className="p-10 text-center"><Loader2Icon size={24} className="animate-spin mx-auto text-globus-blue" /></div>
          ) : subscribers.length === 0 ? (
            <div className="p-10 text-center text-gray-500">Aucun abonné</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Nom</th>
                  <th className="text-left px-4 py-3">Univers</th>
                  <th className="text-center px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Inscrit le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subscribers.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-globus-text">{s.email}</td>
                    <td className="px-4 py-3 text-gray-600">{s.name || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.universe || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        s.status === 'ACTIF' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(s.subscribed_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create Campaign Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-globus-text">Nouvelle campagne</h2>
                <button onClick={() => setShowModal(false)}><XIcon size={20} className="text-gray-400" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sujet *</label>
                  <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2" placeholder="Objet de l'email" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Univers cible</label>
                  <select value={form.universe} onChange={e => setForm(f => ({ ...f, universe: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2">
                    <option value="">Tous les abonnés</option>
                    <option value="HOME">Home</option>
                    <option value="BUSINESS">Business</option>
                    <option value="PREMIUM">Premium</option>
                    <option value="DIASPORA">Diaspora</option>
                    <option value="ENGINEERING">Engineering Services</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contenu HTML</label>
                  <textarea value={form.body_html} onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))}
                    rows={6} className="w-full border border-gray-200 rounded-lg px-3 py-2 font-mono text-xs"
                    placeholder="<h1>Titre</h1><p>Contenu...</p>" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600">Annuler</button>
                <button onClick={() => createCampaign.mutate(form)}
                  disabled={!form.subject || createCampaign.isPending}
                  className="px-4 py-2 rounded-lg bg-globus-blue text-white font-semibold disabled:opacity-50">
                  {createCampaign.isPending ? <Loader2Icon size={16} className="animate-spin" /> : 'Créer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
