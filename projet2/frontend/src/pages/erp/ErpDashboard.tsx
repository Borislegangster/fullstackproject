import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateParts } from '../../utils/datetime';
import { HardHatIcon, TrendingUpIcon, UsersIcon, AlertTriangleIcon, ClockIcon, PackageIcon, ShieldAlertIcon, FileTextIcon, ArrowUpRightIcon, ArrowDownRightIcon, DownloadIcon, Loader2Icon, CheckCircle2Icon, XIcon, RefreshCwIcon, ChevronRightIcon, EyeIcon, BellIcon } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend } from
'recharts';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  useProjects, useActivityLogs,
  useDashboardStats, useDashboardAlerts, useMarginByProject,
  useExpenseBreakdown,
} from '../../hooks/useErp';
import { ChartEmpty } from '../../components/ui/ChartEmpty';
// Color palette for the expense-breakdown pie (assigned by category order).
const EXPENSE_COLORS = ['#F97316', '#1D4ED8', '#10B981', '#8B5CF6', '#EAB308', '#9CA3AF'];

const quickActions = [
{
  label: 'Nouveau Chantier',
  icon: HardHatIcon,
  link: '/erp/chantiers',
  color: 'bg-green-100 text-green-600'
},
{
  label: 'Créer Facture',
  icon: FileTextIcon,
  link: '/erp/facturation',
  color: 'bg-blue-100 text-blue-600'
},
{
  label: 'Pointage',
  icon: ClockIcon,
  link: '/erp/rh',
  color: 'bg-purple-100 text-purple-600'
},
{
  label: 'Rapport QHSE',
  icon: ShieldAlertIcon,
  link: '/erp/qhse',
  color: 'bg-red-100 text-red-600'
}];

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08
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
export function ErpDashboard() {
  const { user } = useAuth();
  const { data: projectsData } = useProjects();
  const { data: activityData } = useActivityLogs({ limit: 6 });
  const { data: stats } = useDashboardStats();
  const { data: apiAlerts } = useDashboardAlerts();
  const { data: marginData } = useMarginByProject();
  const { data: expenseRaw, isLoading: expenseLoading, isError: expenseError } = useExpenseBreakdown();

  // Expense breakdown → pie data (value = percentage, colour by order).
  const expenseChart = useMemo(() => {
    if (!Array.isArray(expenseRaw)) return [];
    return expenseRaw.map((e, i) => ({
      name: e.label,
      value: e.percentage,
      amount: e.amount,
      color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
    }));
  }, [expenseRaw]);

  const activeProjectsCount = stats?.active_projects
    ?? projectsData?.filter((p: any) => p.status === 'EN_COURS').length
    ?? 0;
  const monthlyRevenue = stats?.monthly_revenue ?? 0;
  const activeEmployees = stats?.active_employees ?? 0;
  const openAlertsCount = (apiAlerts || []).length;
  const userName = user?.first_name || 'Admin';

  // Convert backend alerts to UI alerts (color + style)
  const liveAlerts = useMemo(() => {
    if (!apiAlerts || !Array.isArray(apiAlerts)) return [];
    return apiAlerts.map((a, idx) => ({
      id: idx + 1,
      title: a.title,
      desc: a.description,
      color:
        a.severity === 'high' ? 'border-red-500' :
        a.severity === 'medium' ? 'border-orange-500' : 'border-yellow-500',
      bg:
        a.severity === 'high' ? 'bg-red-50' :
        a.severity === 'medium' ? 'bg-orange-50' : 'bg-yellow-50',
      textColor:
        a.severity === 'high' ? 'text-red-700' :
        a.severity === 'medium' ? 'text-orange-700' : 'text-yellow-700',
      link: a.link || '#alerts',
    }));
  }, [apiAlerts]);

  // Convert backend margin data to chart-friendly format (empty → [] → ChartEmpty)
  const liveMargin = useMemo(() => {
    if (!marginData || !Array.isArray(marginData)) return [];
    return marginData.slice(0, 5).map((m) => ({
      name: m.project_name,
      margin: m.margin_pct,
    }));
  }, [marginData]);

  const today = formatDateParts(new Date(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  // Download state
  const [downloadState, setDownloadState] = useState({
    active: false,
    progress: 0,
    done: false
  });
  // Dismissed alerts
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);
  // Alert detail modal
  const [alertDetail, setAlertDetail] = useState<{
    id: number; title: string; desc: string; color: string; bg: string; textColor: string; link: string;
  } | null>(null);
  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleDownload = () => {
    if (downloadState.active) return;
    setDownloadState({
      active: true,
      progress: 0,
      done: false
    });
    let p = 0;
    const interval = setInterval(() => {
      p += 5;
      setDownloadState((prev) => ({
        ...prev,
        progress: p
      }));
      if (p >= 100) {
        clearInterval(interval);
        setDownloadState((prev) => ({
          ...prev,
          done: true
        }));
        setTimeout(
          () =>
          setDownloadState({
            active: false,
            progress: 0,
            done: false
          }),
          3000
        );
      }
    }, 80);
  };
  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };
  // Use API alerts if available, otherwise fallback to static
  const visibleAlerts = liveAlerts.filter((a) => !dismissedAlerts.includes(a.id));

  // Activity log mapped from API (empty → [] → empty state in the list)
  const liveActivity = useMemo(() => {
    if (!activityData || !Array.isArray(activityData) || activityData.length === 0) {
      return [];
    }
    const moduleToVisual: Record<string, { icon: any; color: string; bg: string; link: string }> = {
      lead: { icon: FileTextIcon, color: 'text-purple-600', bg: 'bg-purple-100', link: '/erp/crm' },
      project: { icon: HardHatIcon, color: 'text-orange-600', bg: 'bg-orange-100', link: '/erp/chantiers' },
      invoice: { icon: FileTextIcon, color: 'text-blue-600', bg: 'bg-blue-100', link: '/erp/facturation' },
      document: { icon: FileTextIcon, color: 'text-gray-600', bg: 'bg-gray-100', link: '/erp/ged' },
      sav_ticket: { icon: ShieldAlertIcon, color: 'text-red-600', bg: 'bg-red-100', link: '/erp/sav' },
      employee: { icon: ClockIcon, color: 'text-green-600', bg: 'bg-green-100', link: '/erp/rh' },
      purchase_request: { icon: PackageIcon, color: 'text-blue-600', bg: 'bg-blue-100', link: '/erp/achats' },
      qhse_incident: { icon: ShieldAlertIcon, color: 'text-red-600', bg: 'bg-red-100', link: '/erp/qhse' },
      user: { icon: BellIcon, color: 'text-gray-600', bg: 'bg-gray-100', link: '/erp/parametres' },
    };
    return activityData.slice(0, 6).map((log: any, i: number) => {
      const visual = moduleToVisual[log.entity_type] || moduleToVisual.user;
      const created = log.created_at ? new Date(log.created_at) : null;
      const diff = created ? Math.floor((Date.now() - created.getTime()) / 1000) : 0;
      const time =
        diff < 60 ? "À l'instant" :
        diff < 3600 ? `Il y a ${Math.floor(diff/60)}min` :
        diff < 86400 ? `Il y a ${Math.floor(diff/3600)}h` :
        diff < 86400*2 ? 'Hier' :
        `${Math.floor(diff/86400)} jours`;
      return {
        id: log.id || i,
        icon: visual.icon,
        color: visual.color,
        bg: visual.bg,
        title: log.description || `${log.action} sur ${log.entity_type}`,
        time,
        link: visual.link,
      };
    });
  }, [activityData]);
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="space-y-6 max-w-[1400px] mx-auto">
      
      {/* Welcome */}
      <motion.div
        variants={fadeUp}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        
        <div>
          <h2 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
            Bienvenue, {userName} 👋
          </h2>
          <p className="font-opensans text-sm text-globus-gray capitalize">
            {today} — Vue d'ensemble de l'activité Globus Engineering
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="p-2 text-globus-gray hover:text-globus-orange hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualiser">
            
            <RefreshCwIcon
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-globus-orange' : ''}`} />
            
          </button>
          <button
            onClick={handleDownload}
            disabled={downloadState.active}
            className="bg-globus-orange hover:bg-globus-orange-hover disabled:opacity-60 text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
            
            {downloadState.active ?
            <Loader2Icon className="w-4 h-4 animate-spin" /> :

            <DownloadIcon className="w-4 h-4" />
            }
            Rapport Global
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-600 font-opensans">
              Opérationnel
            </span>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              to={action.link}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3 hover:shadow-md hover:border-globus-orange/30 transition-all group">
              
              <div
                className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                
                <Icon className="w-5 h-5" />
              </div>
              <span className="font-montserrat font-bold text-xs text-globus-blue-dark">
                {action.label}
              </span>
            </Link>);

        })}
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
        {
          icon: HardHatIcon,
          iconBg: 'bg-green-100',
          iconColor: 'text-green-600',
          value: String(activeProjectsCount),
          label: 'Chantiers Actifs',
          trend: stats ? 'Live' : '—',
          trendColor: 'text-green-600',
          link: '/erp/chantiers'
        },
        {
          icon: TrendingUpIcon,
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          value: monthlyRevenue >= 1_000_000
            ? `${(monthlyRevenue / 1_000_000).toFixed(0)}M`
            : monthlyRevenue >= 1_000
            ? `${(monthlyRevenue / 1_000).toFixed(0)}K`
            : `${monthlyRevenue.toFixed(0)}`,
          label: 'CA Mensuel (FCFA)',
          trend: 'Live',
          trendColor: 'text-green-600',
          link: '/erp/finances'
        },
        {
          icon: UsersIcon,
          iconBg: 'bg-purple-100',
          iconColor: 'text-purple-600',
          value: String(activeEmployees),
          label: 'Employés Actifs',
          trend: 'Live',
          trendColor: 'text-globus-gray',
          link: '/erp/rh'
        },
        {
          icon: AlertTriangleIcon,
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          value: String(visibleAlerts.length || openAlertsCount),
          label: 'Alertes Actives',
          trend: visibleAlerts.length > 0 ? 'Urgent' : 'OK',
          trendColor: visibleAlerts.length > 0 ? 'text-red-600' : 'text-green-600',
          link: '#alerts'
        }].
        map((kpi) => {
          const Icon = kpi.icon;
          return (
            <motion.div key={kpi.label} variants={fadeUp}>
              <Link
                to={kpi.link}
                className="block bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-globus-orange/20 transition-all group">
                
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg ${kpi.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    
                    <Icon className={`w-5 h-5 ${kpi.iconColor}`} />
                  </div>
                  <span
                    className={`flex items-center gap-1 text-xs font-semibold ${kpi.trendColor}`}>
                    
                    {kpi.trendColor === 'text-green-600' &&
                    <ArrowUpRightIcon className="w-3 h-3" />
                    }
                    {kpi.trendColor === 'text-red-600' &&
                    <ArrowDownRightIcon className="w-3 h-3" />
                    }
                    {kpi.trend}
                  </span>
                </div>
                <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                  {kpi.value}
                </p>
                <p className="text-xs text-globus-gray font-opensans">
                  {kpi.label}
                </p>
              </Link>
            </motion.div>);

        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          
          <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
            Rentabilité par Projet (%)
          </h3>
          <div className="h-64">
            {liveMargin.length === 0 ? (
              <ChartEmpty message="Aucune marge à afficher pour le moment" />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={liveMargin}
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
                  domain={[-10, 30]}
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
                  width={120} />
                
                <Tooltip
                  formatter={(value: number) => [`${value}%`, 'Marge']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }} />
                
                <Bar dataKey="margin" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {liveMargin.map((entry, index) =>
                  <Cell
                    key={index}
                    fill={entry.margin >= 0 ? '#10B981' : '#EF4444'} />

                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">

          <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
            Répartition des Dépenses
          </h3>
          <div className="h-64">
            {expenseLoading ? (
              <ChartEmpty state="loading" />
            ) : expenseError ? (
              <ChartEmpty state="error" />
            ) : expenseChart.length === 0 ? (
              <ChartEmpty message="Aucune dépense enregistrée" />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseChart}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  stroke="none"
                  paddingAngle={3}>

                  {expenseChart.map((entry, index) =>
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
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <motion.div
          variants={fadeUp}
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-montserrat font-bold text-base text-globus-blue-dark">
              Activité Récente
            </h3>
            <Link
              to="/erp/journal-activite"
              className="text-xs text-globus-orange font-bold hover:underline flex items-center gap-1">
              
              Voir tout <ChevronRightIcon className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {liveActivity.length === 0 && (
              <p className="font-opensans text-sm text-globus-gray text-center py-8">
                Aucune activité récente
              </p>
            )}
            {liveActivity.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.link}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group cursor-pointer">
                  
                  <div
                    className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}>
                    
                    <Icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-opensans text-sm text-gray-800 leading-snug group-hover:text-globus-orange transition-colors">
                      {item.title}
                    </p>
                    <p className="font-opensans text-xs text-globus-gray mt-0.5">
                      {item.time}
                    </p>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-globus-orange transition-colors shrink-0 mt-1" />
                </Link>);

            })}
          </div>
        </motion.div>

        {/* Alerts */}
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
          id="alerts">
          
          <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-5 flex items-center gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-red-500" /> Alertes
            Critiques
            {visibleAlerts.length > 0 &&
            <span className="ml-auto bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {visibleAlerts.length}
              </span>
            }
          </h3>
          <div className="space-y-3">
            <AnimatePresence>
              {visibleAlerts.map((alert) =>
              <motion.div
                key={alert.id}
                initial={{
                  opacity: 1,
                  height: 'auto'
                }}
                exit={{
                  opacity: 0,
                  height: 0,
                  marginBottom: 0,
                  overflow: 'hidden'
                }}
                transition={{
                  duration: 0.3
                }}
                className={`${alert.bg} border-l-4 ${alert.color} rounded-lg p-3 relative group`}>
                
                  <button
                  onClick={() =>
                  setDismissedAlerts((prev) => [...prev, alert.id])
                  }
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                  <p
                  className={`font-montserrat font-bold text-sm ${alert.textColor}`}>
                  
                    {alert.title}
                  </p>
                  <p className="font-opensans text-xs text-gray-600 mt-1">
                    {alert.desc}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                    onClick={() => setAlertDetail(alert)}
                    className="text-[10px] font-bold text-globus-blue hover:underline flex items-center gap-1">
                    
                      <EyeIcon className="w-3 h-3" /> Détails
                    </button>
                    <Link
                    to={alert.link}
                    className="text-[10px] font-bold text-globus-orange hover:underline flex items-center gap-1">
                    
                      <ChevronRightIcon className="w-3 h-3" /> Voir
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {visibleAlerts.length === 0 &&
            <div className="text-center py-6">
                <CheckCircle2Icon className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="font-opensans text-sm text-globus-gray">
                  Aucune alerte active
                </p>
              </div>
            }
          </div>
        </motion.div>
      </div>

      {/* Alert Detail Modal */}
      <AnimatePresence>
        {alertDetail &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setAlertDetail(null)}>
          
            <motion.div
            initial={{
              scale: 0.9,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.9,
              opacity: 0
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                  className={`w-10 h-10 rounded-lg ${alertDetail.bg} flex items-center justify-center`}>
                  
                    <AlertTriangleIcon
                    className={`w-5 h-5 ${alertDetail.textColor}`} />
                  
                  </div>
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    {alertDetail.title}
                  </h3>
                </div>
                <button
                onClick={() => setAlertDetail(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className={`${alertDetail.bg} rounded-lg p-4 mb-4`}>
                <p className="font-opensans text-sm text-gray-700">
                  {alertDetail.desc}
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-globus-gray font-opensans">
                    Priorité
                  </span>
                  <span
                  className={`font-montserrat font-bold ${alertDetail.textColor}`}>
                  
                    {alertDetail.color.includes('red') ?
                  'Critique' :
                  alertDetail.color.includes('orange') ?
                  'Haute' :
                  'Moyenne'}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                onClick={() => {
                  setDismissedAlerts((prev) => [...prev, alertDetail.id]);
                  setAlertDetail(null);
                }}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 font-montserrat font-bold text-sm text-globus-gray hover:bg-gray-50 transition-colors">
                
                  Marquer résolu
                </button>
                <Link
                to={alertDetail.link}
                onClick={() => setAlertDetail(null)}
                className="flex-1 py-2.5 rounded-lg bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold text-sm text-center transition-colors">
                
                  Voir le module
                </Link>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Download Toast */}
      <AnimatePresence>
        {downloadState.active &&
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
            x: 20
          }}
          animate={{
            opacity: 1,
            y: 0,
            x: 0
          }}
          exit={{
            opacity: 0,
            y: 20,
            x: 20
          }}
          className="fixed bottom-4 right-4 z-50 bg-white shadow-xl rounded-xl border border-gray-200 p-4 w-80">
          
            <div className="flex items-center gap-3 mb-3">
              {downloadState.done ?
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2Icon className="w-4 h-4 text-green-600" />
                </div> :

            <div className="w-8 h-8 rounded-full bg-globus-orange/10 flex items-center justify-center shrink-0">
                  <Loader2Icon className="w-4 h-4 text-globus-orange animate-spin" />
                </div>
            }
              <div>
                <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                  {downloadState.done ?
                'Téléchargement terminé' :
                'Préparation du rapport...'}
                </p>
                <p className="font-opensans text-xs text-globus-gray">
                  Rapport_Global_Globus.pdf
                </p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
              className={`h-full rounded-full ${downloadState.done ? 'bg-green-500' : 'bg-globus-orange'}`}
              initial={{
                width: '0%'
              }}
              animate={{
                width: `${downloadState.progress}%`
              }}
              transition={{
                duration: 0.1
              }} />
            
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

}