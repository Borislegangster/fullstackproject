import React, { useMemo, useState } from 'react';
import { formatDate, formatDateParts } from '../../utils/datetime';
import {
  useDashboardStats, useRevenueByMonth, useMarginByProject,
  useScheduledReports, useCreateScheduledReport, useToggleScheduledReport,
  useDeleteScheduledReport,
  useProjectPerformance, useProjectsByType, useQHSEStats, useSAVStats,
} from '../../hooks/useErp';
import { ChartEmpty } from '../../components/ui/ChartEmpty';
import { downloadCSV, downloadAuthedFile } from '../../utils/download';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityIcon, FileTextIcon, DownloadIcon, TrendingUpIcon, CalendarIcon, PieChartIcon, ClockIcon, MailIcon, PlusIcon, CheckCircle2Icon, PauseCircleIcon, PlayCircleIcon, Trash2Icon, Loader2Icon, XIcon } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend } from
'recharts';
const tabs = [
{
  id: 'analytics',
  label: 'Tableau de Bord Analytique',
  icon: ActivityIcon
},
{
  id: 'predefined',
  label: 'Rapports Prédéfinis',
  icon: FileTextIcon
},
{
  id: 'export',
  label: 'Export & Planification',
  icon: DownloadIcon
}];

// Color palettes for the analytics charts (assigned by index).
const PROJECT_TYPE_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#6B7280', '#EF4444'];

const predefinedReports = [
{
  id: 1,
  title: 'Bilan Financier Mensuel',
  desc: 'Synthèse des revenus, dépenses et marges par projet.',
  format: 'CSV',
  icon: '📊'
},
{
  id: 2,
  title: "Suivi Main d'Œuvre",
  desc: 'Heures travaillées, coûts salariaux et pointage.',
  format: 'Excel',
  icon: '👷'
},
{
  id: 3,
  title: 'État des Stocks',
  desc: 'Inventaire actuel, valorisation et alertes de réapprovisionnement.',
  format: 'Excel',
  icon: '📦'
},
{
  id: 4,
  title: 'Bilan QHSE',
  desc: 'Registre des incidents, audits et conformité sécurité.',
  format: 'CSV',
  icon: '🛡️'
},
{
  id: 5,
  title: 'Avancement Chantiers',
  desc: 'Progression physique vs planning prévisionnel.',
  format: 'Excel',
  icon: '🏗️'
},
{
  id: 6,
  title: 'Performance Sous-traitants',
  desc: 'Évaluation, facturation et respect des délais.',
  format: 'Excel',
  icon: '📈'
}];


const formatCurrency = (value: number) =>
new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0
}).format(value) + ' FCFA';
/** Compact money label, e.g. 890_000_000 → "890 M". */
const compactAmount = (v: number): string => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(v % 1_000_000_000 === 0 ? 0 : 1)} Md`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)} M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)} K`;
  return String(Math.round(v));
};
const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06
    }
  }
};
const fadeUp = {
  hidden: {
    opacity: 0,
    y: 20
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4
    }
  }
};
export function ErpRapports() {
  // API hooks
  const { data: stats } = useDashboardStats();
  const { data: revenue } = useRevenueByMonth(12);
  const { data: margin } = useMarginByProject();
  const { data: liveScheduled } = useScheduledReports();
  const { data: perfRaw } = useProjectPerformance();
  const { data: typeRaw } = useProjectsByType();
  const { data: qhseStats } = useQHSEStats();
  const { data: savStats } = useSAVStats();
  void stats;
  const createScheduledMutation = useCreateScheduledReport();
  const toggleScheduledMutation = useToggleScheduledReport();
  const deleteScheduledMutation = useDeleteScheduledReport();

  // Derived live data — empty arrays surface a <ChartEmpty>, never mock.
  const liveRevenueData = useMemo(() => {
    if (!Array.isArray(revenue)) return [];
    return revenue.map((r: any) => ({
      month: r.month.split('-')[1] ? formatDateParts(r.month + '-01', { month: 'short' }) : r.month,
      current: (r.revenue || 0) / 1_000_000,    // encaissements (cash-basis), millions FCFA
      invoiced: (r.invoiced || 0) / 1_000_000,  // facturé soldé (accrual), millions FCFA
    }));
  }, [revenue]);

  const liveProfitData = useMemo(() => {
    if (!Array.isArray(margin)) return [];
    return margin.map((m: any) => ({
      name: m.project_name,
      revenue: m.revenue,
      costs: m.spent,
      margin: m.revenue - m.spent,
      marginPct: m.margin_pct,
      status: m.margin_pct < 0 ? 'Perte' : m.margin_pct < 10 ? 'À surveiller' : 'En cours',
    }));
  }, [margin]);

  // Per-project progress (replaces the per-chef mock).
  const livePerformance = useMemo(() => {
    if (!Array.isArray(perfRaw)) return [];
    return perfRaw.slice(0, 8).map((p) => ({ name: p.project_name, score: p.progress }));
  }, [perfRaw]);

  // Projects-by-type distribution (count) → pie.
  const liveProjectType = useMemo(() => {
    if (!Array.isArray(typeRaw)) return [];
    return typeRaw.map((t, i) => ({
      name: t.type, value: t.count,
      color: PROJECT_TYPE_COLORS[i % PROJECT_TYPE_COLORS.length],
    }));
  }, [typeRaw]);

  // QHSE aggregate counts → bar chart.
  const liveQhse = useMemo(() => {
    if (!qhseStats) return [];
    const s: any = qhseStats;
    const bars = [
      { label: 'Ouverts', incidents: s.open_incidents || 0 },
      { label: 'Graves', incidents: s.severe_incidents || 0 },
      { label: 'Clôturés', incidents: s.closed_incidents || 0 },
      { label: 'Audits', incidents: s.completed_audits || 0 },
    ];
    return bars.every((b) => b.incidents === 0) ? [] : bars;
  }, [qhseStats]);

  const scheduled = useMemo(() => {
    if (!Array.isArray(liveScheduled)) return [];
    return liveScheduled.map((s: any) => ({
      id: s.id,
      name: s.name,
      type: s.report_type,
      frequency: s.frequency,
      recipients: Array.isArray(s.recipients) ? s.recipients.join(', ') : '',
      nextRun: formatDate(s.next_run_at, '—'),
      active: !!s.is_active,
    }));
  }, [liveScheduled]);

  // Real KPI row — computed entirely from live API data (no mock, no fake trends).
  const kpis = useMemo(() => {
    const totalRevenue = Array.isArray(revenue)
      ? revenue.reduce((s: number, r: any) => s + (r.revenue || 0), 0) : 0;
    const sumRev = liveProfitData.reduce((s, p: any) => s + (p.revenue || 0), 0);
    const sumMargin = liveProfitData.reduce((s, p: any) => s + (p.margin || 0), 0);
    const marginPct = sumRev > 0 ? (sumMargin / sumRev) * 100 : 0;
    const avgProgress = livePerformance.length
      ? livePerformance.reduce((s, p: any) => s + (p.score || 0), 0) / livePerformance.length : 0;
    const satisfaction = Number((savStats as any)?.avg_rating || 0);
    return [
      { label: 'CA Encaissé (12 mois)', value: compactAmount(totalRevenue), suffix: 'FCFA',
        Icon: TrendingUpIcon, bg: 'bg-green-100', fg: 'text-green-600' },
      { label: 'Marge Nette Moyenne', value: marginPct.toFixed(1), suffix: '%',
        Icon: PieChartIcon, bg: 'bg-blue-100', fg: 'text-blue-600' },
      { label: 'Avancement Moyen', value: String(Math.round(avgProgress)), suffix: '%',
        Icon: ClockIcon, bg: 'bg-orange-100', fg: 'text-orange-600' },
      { label: 'Satisfaction Client', value: satisfaction ? satisfaction.toFixed(1) : '—',
        suffix: satisfaction ? '/5' : '', Icon: CheckCircle2Icon, bg: 'bg-purple-100', fg: 'text-purple-600' },
    ];
  }, [revenue, liveProfitData, livePerformance, savStats]);

  const [activeTab, setActiveTab] = useState('analytics');
  const [isGenerating, setIsGenerating] = useState<number | string | null>(null);
  const [exportModule, setExportModule] = useState('all');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [exportFrom, setExportFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [exportTo, setExportTo] = useState(new Date().toISOString().slice(0, 10));
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [showCustomReportModal, setShowCustomReportModal] = useState(false);
  const showToast = (
  message: string,
  type: 'success' | 'error' | 'info' = 'success') =>
  {
    setToast({
      message,
      type
    });
    setTimeout(() => setToast(null), 3000);
  };
  const handleGenerate = async (id: number) => {
    setIsGenerating(id);
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      if (id === 1) {
        if (liveProfitData.length === 0)
          throw new Error('Aucune donnée financière à exporter');
        downloadCSV(
          `bilan-financier-${stamp}.csv`,
          liveProfitData.map((p: any) => ({
            name: p.name, revenue: p.revenue, costs: p.costs,
            margin: p.margin, marginPct: p.marginPct, status: p.status,
          })),
          [
            { key: 'name', label: 'Projet' },
            { key: 'revenue', label: 'Revenus (FCFA)' },
            { key: 'costs', label: 'Dépenses (FCFA)' },
            { key: 'margin', label: 'Marge (FCFA)' },
            { key: 'marginPct', label: 'Marge %' },
            { key: 'status', label: 'Statut' },
          ],
        );
      } else if (id === 4) {
        if (liveQhse.length === 0)
          throw new Error('Aucune donnée QHSE à exporter');
        downloadCSV(`bilan-qhse-${stamp}.csv`, liveQhse, [
          { key: 'label', label: 'Indicateur' },
          { key: 'incidents', label: 'Nombre' },
        ]);
      } else {
        const map: Record<number, { path: string; name: string }> = {
          2: { path: '/exports/payroll.xlsx', name: 'suivi-main-oeuvre' },
          3: { path: '/exports/stock.xlsx', name: 'etat-stocks' },
          5: { path: '/exports/projects.xlsx', name: 'avancement-chantiers' },
          6: { path: '/exports/subcontractor-invoices.xlsx', name: 'performance-sous-traitants' },
        };
        const t = map[id];
        if (!t) throw new Error('Rapport inconnu');
        await downloadAuthedFile(t.path, `${t.name}-${stamp}.xlsx`);
      }
      showToast('Rapport généré et téléchargé avec succès');
    } catch (e: any) {
      showToast(
        e?.response?.data?.detail || e?.message || 'Échec de la génération',
        'error',
      );
    } finally {
      setIsGenerating(null);
    }
  };
  const handleManualExport = async () => {
    const map: Record<string, { path: string; name: string }> = {
      finances: { path: '/exports/invoices.xlsx', name: 'factures' },
      rh: { path: '/exports/employees.xlsx', name: 'employes' },
      achats: { path: '/exports/purchase-requests.xlsx', name: 'achats' },
      materiel: { path: '/exports/stock.xlsx', name: 'stock' },
      chantiers: { path: '/exports/projects.xlsx', name: 'chantiers' },
      crm: { path: '/exports/leads.xlsx', name: 'leads' },
    };
    const t = map[exportModule];
    if (!t) {
      showToast('Sélectionnez un module spécifique à exporter', 'info');
      return;
    }
    setIsGenerating('manual-export');
    // Format choisi (excel → xlsx) + plage de dates → query string réelle.
    const fmt = exportFormat === 'excel' ? 'xlsx' : exportFormat; // 'pdf' | 'xlsx' | 'csv'
    const params = new URLSearchParams({ fmt });
    if (exportFrom) params.set('date_from', exportFrom);
    if (exportTo) params.set('date_to', exportTo);
    try {
      await downloadAuthedFile(
        `${t.path}?${params.toString()}`,
        `${t.name}-${new Date().toISOString().slice(0, 10)}.${fmt}`,
      );
      showToast('Export terminé avec succès');
    } catch (e: any) {
      showToast(
        e?.response?.data?.detail || "Échec de l'export",
        'error',
      );
    } finally {
      setIsGenerating(null);
    }
  };
  const handleCreateCustomReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating('custom-report');
    const form = e.target as HTMLFormElement;
    try {
      await createScheduledMutation.mutateAsync({
        name: (form.elements.namedItem('name') as HTMLInputElement)?.value || 'Rapport',
        report_type: (form.elements.namedItem('type') as HTMLSelectElement)?.value || 'dashboard_summary',
        frequency: (form.elements.namedItem('frequency') as HTMLSelectElement)?.value || 'WEEKLY',
        recipients: ((form.elements.namedItem('recipients') as HTMLInputElement)?.value || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setShowCustomReportModal(false);
      showToast('Rapport personnalisé créé et planifié');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsGenerating(null);
    }
  };
  const handleToggleScheduled = async (id: string) => {
    try {
      await toggleScheduledMutation.mutateAsync(id);
    } catch (err) {
      console.error(err);
    }
  };
  const handleDeleteScheduled = async (id: string) => {
    try {
      await deleteScheduledMutation.mutateAsync(id);
      showToast('Rapport planifié supprimé', 'info');
    } catch (err) {
      console.error(err);
    }
  };
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="max-w-[1400px] mx-auto space-y-6 relative">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast &&
        <motion.div
          initial={{
            opacity: 0,
            y: 50
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: 50
          }}
          className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 text-white font-opensans text-sm ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
          
            {toast.type === 'success' ?
          <CheckCircle2Icon className="w-5 h-5" /> :

          <ActivityIcon className="w-5 h-5" />
          }
            {toast.message}
          </motion.div>
        }
      </AnimatePresence>

      {/* Header & Tabs */}
      <motion.div
        variants={fadeUp}
        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
              Rapports & Analytics
            </h2>
            <p className="font-opensans text-sm text-globus-gray mt-1">
              Analyse transversale et génération de rapports
            </p>
          </div>
          <button
            onClick={() => setShowCustomReportModal(true)}
            className="flex items-center gap-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold text-sm py-2.5 px-5 rounded-lg transition-colors shadow-sm">
            
            <PlusIcon className="w-4 h-4" />
            Rapport Personnalisé
          </button>
        </div>
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3.5 text-sm font-montserrat font-semibold whitespace-nowrap border-b-2 transition-colors ${isActive ? 'border-globus-orange text-globus-orange bg-orange-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>);

          })}
        </div>
      </motion.div>

      {/* Tab: Analytics */}
      {activeTab === 'analytics' &&
      <>
          {/* KPI Row — valeurs réelles dérivées de l'API */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, i) => {
              const Icon = kpi.Icon;
              return (
              <motion.div
                key={i}
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">

                  <div className="flex items-center mb-3">
                    <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${kpi.fg}`} />
                    </div>
                  </div>
                  <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                    {kpi.value}
                    {kpi.suffix &&
                    <span className="text-sm font-bold text-gray-400 ml-1">
                      {kpi.suffix}
                    </span>
                    }
                  </p>
                  <p className="text-xs text-globus-gray font-opensans">
                    {kpi.label}
                  </p>
                </motion.div>);
            })}
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            
              <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-1">
                Évolution CA Mensuel
              </h3>
              <p className="font-opensans text-xs text-gray-400 mb-4">
                Encaissé (cash) vs facturé soldé — 12 mois (millions FCFA)
              </p>
              <div className="h-64">
                {liveRevenueData.length === 0 ? (
                  <ChartEmpty message="Aucune donnée de revenus sur la période" />
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                  data={liveRevenueData}
                  margin={{
                    top: 5,
                    right: 10,
                    left: 0,
                    bottom: 0
                  }}>
                  
                    <defs>
                      <linearGradient
                      id="colorCurrent"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1">
                      
                        <stop
                        offset="5%"
                        stopColor="#F97316"
                        stopOpacity={0.3} />
                      
                        <stop
                        offset="95%"
                        stopColor="#F97316"
                        stopOpacity={0} />

                      </linearGradient>
                      <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                    dataKey="month"
                    tick={{
                      fontSize: 11,
                      fill: '#6b7280'
                    }}
                    axisLine={false}
                    tickLine={false} />
                  
                    <YAxis
                    tick={{
                      fontSize: 11,
                      fill: '#6b7280'
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}M`} />
                  
                    <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} M FCFA`,
                      name === 'current' ? 'Encaissé' : 'Facturé soldé',
                    ]}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }} />

                    <Legend
                    iconType="plainline"
                    formatter={(v) => (v === 'current' ? 'Encaissé' : 'Facturé soldé')}
                    wrapperStyle={{ fontSize: '11px' }} />

                    <Area
                    type="monotone"
                    dataKey="invoiced"
                    stroke="#94A3B8"
                    strokeWidth={2}
                    fill="url(#colorInvoiced)"
                    strokeDasharray="5 5" />

                    <Area
                    type="monotone"
                    dataKey="current"
                    stroke="#F97316"
                    strokeWidth={2.5}
                    fill="url(#colorCurrent)" />

                  </AreaChart>
                </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            
              <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-1">
                Avancement par Projet (%)
              </h3>
              <p className="font-opensans text-xs text-gray-400 mb-4">
                Score global (%)
              </p>
              <div className="h-64">
                {livePerformance.length === 0 ? (
                  <ChartEmpty message="Aucun projet à afficher" />
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                  data={livePerformance}
                  layout="vertical"
                  margin={{
                    top: 0,
                    right: 20,
                    left: 0,
                    bottom: 0
                  }}>
                  
                    <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                    stroke="#f3f4f6" />
                  
                    <XAxis
                    type="number"
                    tick={{
                      fontSize: 11,
                      fill: '#6b7280'
                    }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`} />
                  
                    <YAxis
                    type="category"
                    dataKey="name"
                    tick={{
                      fontSize: 11,
                      fill: '#374151'
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={110} />
                  
                    <Tooltip
                    formatter={(value: number) => [`${value}%`, 'Score']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }} />
                  
                    <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {livePerformance.map((entry, index) =>
                    <Cell
                      key={index}
                      fill={
                      entry.score >= 85 ?
                      '#10B981' :
                      entry.score >= 75 ?
                      '#F59E0B' :
                      '#EF4444'
                      } />

                    )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
            </motion.div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            
              <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
                Répartition des Projets par Type
              </h3>
              <div className="h-64">
                {liveProjectType.length === 0 ? (
                  <ChartEmpty message="Aucun projet à répartir" />
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                    data={liveProjectType}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    stroke="none"
                    paddingAngle={3}>
                    
                      {liveProjectType.map((entry, index) =>
                    <Cell key={index} fill={entry.color} />
                    )}
                    </Pie>
                    <Tooltip
                    formatter={(value: number) => [`${value}%`, '']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }} />
                  
                    <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{
                      fontSize: '11px'
                    }} />
                  
                  </PieChart>
                </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            
              <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
                Synthèse QHSE (incidents & audits)
              </h3>
              <div className="h-64">
                {liveQhse.length === 0 ? (
                  <ChartEmpty message="Aucune donnée QHSE" />
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                  data={liveQhse}
                  margin={{
                    top: 5,
                    right: 10,
                    left: 0,
                    bottom: 0
                  }}>

                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: '#6b7280'
                    }}
                    axisLine={false}
                    tickLine={false} />
                  
                    <YAxis
                    tick={{
                      fontSize: 11,
                      fill: '#6b7280'
                    }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false} />
                  
                    <Tooltip
                    formatter={(value: number) => [`${value}`, 'Incidents']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }} />
                  
                    <Bar
                    dataKey="incidents"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32} />
                  
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
            </motion.div>
          </div>

          {/* Top Projects Table */}
          <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          
            <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
              Top 5 Projets par Rentabilité
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 font-montserrat font-bold text-xs text-gray-500 uppercase">
                      Projet
                    </th>
                    <th className="text-right py-3 px-3 font-montserrat font-bold text-xs text-gray-500 uppercase">
                      CA
                    </th>
                    <th className="text-right py-3 px-3 font-montserrat font-bold text-xs text-gray-500 uppercase">
                      Coûts
                    </th>
                    <th className="text-right py-3 px-3 font-montserrat font-bold text-xs text-gray-500 uppercase">
                      Marge
                    </th>
                    <th className="text-center py-3 px-3 font-montserrat font-bold text-xs text-gray-500 uppercase">
                      Marge %
                    </th>
                    <th className="text-center py-3 px-3 font-montserrat font-bold text-xs text-gray-500 uppercase">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {liveProfitData.length === 0 &&
                    <tr><td colSpan={6} className="py-8 text-center text-globus-gray font-opensans text-sm">
                      Aucun projet à afficher
                    </td></tr>
                  }
                  {liveProfitData.map((project, i) =>
                <tr
                  key={i}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  
                      <td className="py-3 px-3 font-montserrat font-bold text-globus-blue-dark">
                        {project.name}
                      </td>
                      <td className="py-3 px-3 text-right font-opensans text-gray-700">
                        {formatCurrency(project.revenue)}
                      </td>
                      <td className="py-3 px-3 text-right font-opensans text-gray-500">
                        {formatCurrency(project.costs)}
                      </td>
                      <td className="py-3 px-3 text-right font-opensans font-semibold text-green-600">
                        {formatCurrency(project.margin)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${project.marginPct >= 15 ? 'bg-green-100 text-green-700' : project.marginPct >= 8 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                      
                          {project.marginPct}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${project.status === 'Terminé' ? 'bg-green-100 text-green-700' : project.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      
                          {project.status}
                        </span>
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      }

      {/* Tab: Predefined Reports */}
      {activeTab === 'predefined' &&
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {predefinedReports.map((report) =>
        <motion.div
          key={report.id}
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
          
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">{report.icon}</span>
                <div className="flex-1">
                  <h3 className="font-montserrat font-bold text-sm text-globus-blue-dark">
                    {report.title}
                  </h3>
                  <p className="font-opensans text-xs text-gray-500 mt-1">
                    {report.desc}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-opensans text-gray-400 mb-4">
                <span className="flex items-center gap-1">
                  <FileTextIcon className="w-3 h-3" />
                  Format: {report.format}
                </span>
              </div>
              <div className="mt-auto flex gap-2">
                <button
              onClick={() => handleGenerate(report.id)}
              disabled={isGenerating === report.id}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold text-xs rounded-lg transition-colors disabled:opacity-60">
              
                  {isGenerating === report.id ?
              <>
                      <Loader2Icon className="w-4 h-4 animate-spin" />
                      Génération...
                    </> :

              <>
                      <DownloadIcon className="w-3.5 h-3.5" />
                      Générer
                    </>
              }
                </button>
                <button className="py-2.5 px-4 border border-gray-200 text-gray-600 font-montserrat font-bold text-xs rounded-lg hover:bg-gray-50 transition-colors">
                  Voir dernier
                </button>
              </div>
            </motion.div>
        )}
        </div>
      }

      {/* Tab: Export & Scheduling */}
      {activeTab === 'export' &&
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Manual Export */}
          <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          
            <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-5">
              Export Manuel
            </h3>

            <div className="space-y-5">
              <div>
                <label className="block font-montserrat font-semibold text-sm text-globus-blue-dark mb-2">
                  Module
                </label>
                <select
                value={exportModule}
                onChange={(e) => setExportModule(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange/30">
                
                  <option value="all">Tous les modules</option>
                  <option value="rh">Ressources Humaines</option>
                  <option value="finances">Comptabilité</option>
                  <option value="achats">Achats & Stocks</option>
                  <option value="chantiers">Chantiers</option>
                  <option value="qhse">QHSE</option>
                  <option value="materiel">Parc Matériel</option>
                  <option value="crm">CRM & Devis</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-montserrat font-semibold text-sm text-globus-blue-dark mb-2">
                    Du
                  </label>
                  <input
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange/30" />

                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-sm text-globus-blue-dark mb-2">
                    Au
                  </label>
                  <input
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange/30" />
                
                </div>
              </div>

              <div>
                <label className="block font-montserrat font-semibold text-sm text-globus-blue-dark mb-3">
                  Format
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                {
                  id: 'pdf',
                  label: 'PDF',
                  icon: '📄'
                },
                {
                  id: 'excel',
                  label: 'Excel',
                  icon: '📊'
                },
                {
                  id: 'csv',
                  label: 'CSV',
                  icon: '📝'
                }].
                map((format) =>
                <button
                  key={format.id}
                  onClick={() => setExportFormat(format.id)}
                  className={`py-2.5 px-3 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${exportFormat === format.id ? 'border-globus-orange bg-orange-50 text-globus-orange' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                  
                      <span>{format.icon}</span>
                      {format.label}
                    </button>
                )}
                </div>
              </div>

              <button
              onClick={handleManualExport}
              disabled={isGenerating === 'manual-export'}
              className="w-full py-3 bg-globus-blue-dark hover:bg-globus-blue text-white font-montserrat font-bold text-sm rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
              
                {isGenerating === 'manual-export' ?
              <>
                    <Loader2Icon className="w-5 h-5 animate-spin" /> Exportation
                    en cours...
                  </> :

              <>
                    <DownloadIcon className="w-5 h-5" /> Exporter les données
                  </>
              }
              </button>
            </div>
          </motion.div>

          {/* Scheduled Reports */}
          <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                Rapports Planifiés
              </h3>
              <button
              onClick={() => setShowCustomReportModal(true)}
              className="text-sm font-semibold text-globus-blue hover:text-globus-blue-dark flex items-center gap-1">
              
                <PlusIcon className="w-4 h-4" /> Planifier
              </button>
            </div>

            <div className="space-y-3">
              {scheduled.map((report) =>
            <div
              key={report.id}
              className={`p-4 rounded-lg border ${report.active ? 'border-blue-100 bg-blue-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
              
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-montserrat font-bold text-sm text-gray-800">
                        {report.name}
                      </h4>
                      <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${report.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    
                        {report.active ? 'Actif' : 'En pause'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                    onClick={() => handleToggleScheduled(report.id)}
                    title={report.active ? 'Mettre en pause' : 'Activer'}
                    className="p-1 text-gray-400 hover:text-globus-blue">
                        {report.active ?
                    <PauseCircleIcon className="w-4 h-4" /> :

                    <PlayCircleIcon className="w-4 h-4" />
                    }
                      </button>
                      <button
                    onClick={() => handleDeleteScheduled(report.id)}
                    title="Supprimer"
                    className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 font-opensans">
                    <p className="flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5" />
                      {report.frequency}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      Prochain: {report.nextRun}
                    </p>
                    <p className="col-span-2 flex items-center gap-1.5 mt-1">
                      <MailIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{report.recipients}</span>
                    </p>
                  </div>
                </div>
            )}
            </div>
          </motion.div>
        </div>
      }

      {/* ── Plan a scheduled report modal ─────────────────────── */}
      <AnimatePresence>
        {showCustomReportModal &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCustomReportModal(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                Planifier un rapport
              </h3>
              <button onClick={() => setShowCustomReportModal(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomReport} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Nom du rapport</label>
                <input name="name" required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Type</label>
                <select name="type"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange">
                  <option value="dashboard_summary">Synthèse Dashboard</option>
                  <option value="financial">Financier</option>
                  <option value="hr">Ressources Humaines</option>
                  <option value="projects">Chantiers</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Fréquence</label>
                <select name="frequency"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange">
                  <option value="DAILY">Quotidien</option>
                  <option value="WEEKLY">Hebdomadaire</option>
                  <option value="MONTHLY">Mensuel</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Destinataires</label>
                <input name="recipients" placeholder="email1@x.com, email2@y.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCustomReportModal(false)}
                  className="px-4 py-2 rounded-lg font-bold text-globus-gray hover:bg-gray-100 text-sm">Annuler</button>
                <button type="submit" disabled={isGenerating === 'custom-report'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-bold py-2 px-5 rounded-lg text-sm flex items-center gap-2 disabled:opacity-70">
                  {isGenerating === 'custom-report' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :
                  <PlusIcon className="w-4 h-4" />}
                  Planifier
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
    </motion.div>);

}