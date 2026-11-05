import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3Icon, TrendingUpIcon, DollarSignIcon,
  UsersIcon, FolderIcon, PackageIcon, TruckIcon, ActivityIcon,
  ArrowUpRightIcon, ArrowDownRightIcon,
  Loader2Icon, DownloadIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { axiosClient as api } from '../../services/api/axiosClient';

interface DashboardData {
  projects: { total: number; active: number; completed: number; on_hold: number };
  finance: { revenue_total: number; expenses_total: number; margin_pct: number; monthly: { month: string; revenue: number; expenses: number }[] };
  commercial: { prospects: number; devis_sent: number; conversion_rate: number };
  supply_chain: { suppliers: number; pending_deliveries: number; pending_invoices: number };
}

export function ErpAnalytics() {
  useEffect(() => { document.title = 'Tableau de bord analytique | ERP Globus'; }, []);
  const [period, setPeriod] = useState('12');

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/analytics/dashboard');
        return data as DashboardData;
      } catch {
        return null;
      }
    },
  });

  const { data: financeTrends } = useQuery({
    queryKey: ['analytics-finance', period],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/analytics/finance?months=${period}`);
        return data;
      } catch {
        return { months: [] };
      }
    },
  });

  const { data: activityFeed } = useQuery({
    queryKey: ['analytics-activity'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/analytics/activity?limit=10');
        return data;
      } catch {
        return [];
      }
    },
  });

  const fmtXAF = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n || 0);

  const months = financeTrends?.months || dashboard?.finance?.monthly || [];
  const maxRevenue = Math.max(...months.map((m: any) => m.revenue || 0), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-gilroy text-globus-text">Tableau de bord</h1>
          <p className="text-gray-500 text-sm">Vue d'ensemble analytique de l'entreprise</p>
        </div>
        <div className="flex gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="3">3 mois</option>
            <option value="6">6 mois</option>
            <option value="12">12 mois</option>
          </select>
          <button className="flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            <DownloadIcon size={16} /> Exporter
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl p-20 text-center">
          <Loader2Icon size={32} className="animate-spin mx-auto text-globus-blue" />
          <p className="text-gray-500 mt-3">Chargement du tableau de bord...</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Chiffre d\'affaires', value: fmtXAF(dashboard?.finance?.revenue_total || 0), icon: DollarSignIcon, color: 'text-green-600', bg: 'bg-green-50', trend: '+12%', up: true },
              { label: 'Projets actifs', value: dashboard?.projects?.active || 0, icon: FolderIcon, color: 'text-globus-blue', bg: 'bg-blue-50', trend: `${dashboard?.projects?.total || 0} total`, up: true },
              { label: 'Marge nette', value: `${dashboard?.finance?.margin_pct?.toFixed(1) || 0}%`, icon: TrendingUpIcon, color: 'text-purple-600', bg: 'bg-purple-50', trend: 'vs 18% N-1', up: true },
              { label: 'Taux conversion', value: `${dashboard?.commercial?.conversion_rate?.toFixed(0) || 0}%`, icon: UsersIcon, color: 'text-orange-600', bg: 'bg-orange-50', trend: `${dashboard?.commercial?.prospects || 0} prospects`, up: true },
            ].map(kpi => (
              <motion.div key={kpi.label}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className={`${kpi.bg} rounded-xl p-5`}
              >
                <div className="flex items-center justify-between mb-2">
                  <kpi.icon size={20} className={kpi.color} />
                  <span className={`text-xs flex items-center gap-0.5 ${kpi.up ? 'text-green-600' : 'text-red-500'}`}>
                    {kpi.up ? <ArrowUpRightIcon size={12} /> : <ArrowDownRightIcon size={12} />}
                    {kpi.trend}
                  </span>
                </div>
                <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-xs text-gray-600 mt-1">{kpi.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-globus-text mb-4 flex items-center gap-2">
                <BarChart3Icon size={16} /> Revenus & Dépenses
              </h3>
              {months.length > 0 ? (
                <div className="flex items-end gap-2 h-48">
                  {months.map((m: any, i: number) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex gap-0.5 items-end" style={{ height: '160px' }}>
                        <div className="flex-1 bg-globus-blue rounded-t" style={{ height: `${(m.revenue / maxRevenue) * 100}%` }} />
                        <div className="flex-1 bg-globus-orange/60 rounded-t" style={{ height: `${(m.expenses / maxRevenue) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500">{m.month?.substring(5) || ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Pas de données</div>
              )}
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-globus-blue" /> Revenus</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-globus-orange/60" /> Dépenses</span>
              </div>
            </div>

            {/* Projects Donut */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-globus-text mb-4 flex items-center gap-2">
                <FolderIcon size={16} /> Projets par statut
              </h3>
              <div className="space-y-3 mt-6">
                {[
                  { label: 'Actifs', value: dashboard?.projects?.active || 0, color: 'bg-globus-blue' },
                  { label: 'Terminés', value: dashboard?.projects?.completed || 0, color: 'bg-green-500' },
                  { label: 'En pause', value: dashboard?.projects?.on_hold || 0, color: 'bg-yellow-400' },
                ].map(p => {
                  const total = (dashboard?.projects?.total || 1);
                  const pct = ((p.value / total) * 100).toFixed(0);
                  return (
                    <div key={p.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{p.label}</span>
                        <span className="font-semibold">{p.value} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${p.color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Supply Chain */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-globus-text mb-4 flex items-center gap-2">
                <TruckIcon size={16} /> Chaîne d'approvisionnement
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <PackageIcon size={20} className="mx-auto text-globus-blue mb-1" />
                  <div className="text-xl font-bold text-globus-text">{dashboard?.supply_chain?.suppliers || 0}</div>
                  <div className="text-xs text-gray-500">Fournisseurs</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <TruckIcon size={20} className="mx-auto text-yellow-600 mb-1" />
                  <div className="text-xl font-bold text-globus-text">{dashboard?.supply_chain?.pending_deliveries || 0}</div>
                  <div className="text-xs text-gray-500">Livraisons en attente</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <DollarSignIcon size={20} className="mx-auto text-red-500 mb-1" />
                  <div className="text-xl font-bold text-globus-text">{dashboard?.supply_chain?.pending_invoices || 0}</div>
                  <div className="text-xs text-gray-500">Factures en attente</div>
                </div>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-globus-text mb-4 flex items-center gap-2">
                <ActivityIcon size={16} /> Activité récente
              </h3>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {(activityFeed || []).length > 0 ? (
                  (activityFeed || []).map((a: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-globus-blue mt-1.5 flex-shrink-0" />
                      <div>
                        <span className="text-globus-text">{a.description || a.action}</span>
                        <span className="text-xs text-gray-400 ml-2">{a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR') : ''}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm">Aucune activité récente</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
