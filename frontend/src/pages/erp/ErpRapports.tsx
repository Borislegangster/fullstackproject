import React, { useState, Children } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ActivityIcon,
  FileTextIcon,
  DownloadIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarIcon,
  PieChartIcon,
  ClockIcon,
  MailIcon,
  PlusIcon,
  CheckCircle2Icon,
  PauseCircleIcon,
  PlayCircleIcon,
  Trash2Icon,
  Loader2Icon,
  XIcon,
  SaveIcon } from
'lucide-react';
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

const revenueData = [
{
  month: 'Jan',
  current: 45,
  previous: 38
},
{
  month: 'Fév',
  current: 52,
  previous: 42
},
{
  month: 'Mar',
  current: 68,
  previous: 55
},
{
  month: 'Avr',
  current: 75,
  previous: 60
},
{
  month: 'Mai',
  current: 82,
  previous: 65
},
{
  month: 'Juin',
  current: 95,
  previous: 70
},
{
  month: 'Juil',
  current: 88,
  previous: 75
},
{
  month: 'Aoû',
  current: 70,
  previous: 68
},
{
  month: 'Sep',
  current: 105,
  previous: 85
},
{
  month: 'Oct',
  current: 112,
  previous: 90
},
{
  month: 'Nov',
  current: 98,
  previous: 95
},
{
  month: 'Déc',
  current: 125,
  previous: 110
}];

const performanceData = [
{
  name: 'Paul Mbarga',
  score: 92
},
{
  name: 'Claire Fotso',
  score: 88
},
{
  name: 'Jacques Nkoulou',
  score: 85
},
{
  name: 'Alain Messi',
  score: 76
}];

const projectTypeData = [
{
  name: 'Résidentiel',
  value: 45,
  color: '#3B82F6'
},
{
  name: 'Commercial',
  value: 25,
  color: '#8B5CF6'
},
{
  name: 'Industriel',
  value: 15,
  color: '#F59E0B'
},
{
  name: 'Infrastructure',
  value: 10,
  color: '#10B981'
},
{
  name: 'Rénovation',
  value: 5,
  color: '#6B7280'
}];

const qhseData = [
{
  month: 'Oct',
  incidents: 2
},
{
  month: 'Nov',
  incidents: 1
},
{
  month: 'Déc',
  incidents: 3
},
{
  month: 'Jan',
  incidents: 2
},
{
  month: 'Fév',
  incidents: 4
},
{
  month: 'Mar',
  incidents: 3
}];

const topProjects = [
{
  name: 'Villa Bonapriso',
  revenue: 95000000,
  costs: 74100000,
  margin: 20900000,
  marginPct: 22,
  status: 'En cours'
},
{
  name: 'Bureau Deïdo',
  revenue: 45000000,
  costs: 36000000,
  margin: 9000000,
  marginPct: 20,
  status: 'Terminé'
},
{
  name: 'Immeuble Akwa',
  revenue: 320000000,
  costs: 272000000,
  margin: 48000000,
  marginPct: 15,
  status: 'En cours'
},
{
  name: 'Résidence Bonanjo',
  revenue: 150000000,
  costs: 138000000,
  margin: 12000000,
  marginPct: 8,
  status: 'En cours'
},
{
  name: 'Centre Commercial Bali',
  revenue: 850000000,
  costs: 807500000,
  margin: 42500000,
  marginPct: 5,
  status: 'Démarrage'
}];

const predefinedReports = [
{
  id: 1,
  title: 'Bilan Financier Mensuel',
  desc: 'Synthèse des revenus, dépenses et marges par projet.',
  lastRun: '01/03/2026',
  format: 'PDF, Excel',
  icon: '📊'
},
{
  id: 2,
  title: "Suivi Main d'Œuvre",
  desc: 'Heures travaillées, coûts salariaux et pointage.',
  lastRun: '15/03/2026',
  format: 'Excel',
  icon: '👷'
},
{
  id: 3,
  title: 'État des Stocks',
  desc: 'Inventaire actuel, valorisation et alertes de réapprovisionnement.',
  lastRun: "Aujourd'hui",
  format: 'PDF',
  icon: '📦'
},
{
  id: 4,
  title: 'Bilan QHSE',
  desc: 'Registre des incidents, audits et conformité sécurité.',
  lastRun: '28/02/2026',
  format: 'PDF',
  icon: '🛡️'
},
{
  id: 5,
  title: 'Avancement Chantiers',
  desc: 'Progression physique vs planning prévisionnel.',
  lastRun: 'Hier',
  format: 'PDF, PPT',
  icon: '🏗️'
},
{
  id: 6,
  title: 'Performance Sous-traitants',
  desc: 'Évaluation, facturation et respect des délais.',
  lastRun: '10/03/2026',
  format: 'Excel',
  icon: '📈'
}];

const scheduledReports = [
{
  id: 1,
  name: 'Rapport Financier',
  frequency: 'Mensuel',
  recipients: 'admin@globus-btp.com, direction@globus-btp.com',
  nextRun: '01/04/2026',
  active: true
},
{
  id: 2,
  name: 'Avancement Chantiers',
  frequency: 'Hebdomadaire',
  recipients: 'equipe-technique@globus-btp.com',
  nextRun: '27/03/2026',
  active: true
},
{
  id: 3,
  name: 'État des Stocks',
  frequency: 'Hebdomadaire',
  recipients: 'logistique@globus-btp.com',
  nextRun: '28/03/2026',
  active: true
},
{
  id: 4,
  name: 'Bilan QHSE',
  frequency: 'Mensuel',
  recipients: 'qhse@globus-btp.com',
  nextRun: '01/04/2026',
  active: false
}];

const formatCurrency = (value: number) =>
new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0
}).format(value) + ' FCFA';
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
  const [activeTab, setActiveTab] = useState('analytics');
  const [isGenerating, setIsGenerating] = useState<number | string | null>(null);
  const [exportModule, setExportModule] = useState('all');
  const [exportFormat, setExportFormat] = useState('pdf');
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
  const handleGenerate = (id: number) => {
    setIsGenerating(id);
    setTimeout(() => {
      setIsGenerating(null);
      showToast('Rapport généré et téléchargé avec succès');
    }, 2000);
  };
  const handleManualExport = () => {
    setIsGenerating('manual-export');
    setTimeout(() => {
      setIsGenerating(null);
      showToast('Export terminé avec succès');
    }, 2000);
  };
  const handleCreateCustomReport = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating('custom-report');
    setTimeout(() => {
      setIsGenerating(null);
      setShowCustomReportModal(false);
      showToast('Rapport personnalisé créé et planifié');
    }, 1500);
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
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
          {
            label: 'CA Cumulé Annuel',
            value: '890M',
            suffix: 'FCFA',
            trend: '+22%',
            up: true,
            color: 'bg-green-100 text-green-600'
          },
          {
            label: 'Marge Nette Moyenne',
            value: '14.2%',
            suffix: '',
            trend: '-1.8 pts',
            up: false,
            color: 'bg-blue-100 text-blue-600'
          },
          {
            label: 'Livraison à Temps',
            value: '72%',
            suffix: '',
            trend: 'Obj: 85%',
            up: false,
            color: 'bg-orange-100 text-orange-600'
          },
          {
            label: 'Satisfaction Client',
            value: '4.6',
            suffix: '/5',
            trend: '+0.3',
            up: true,
            color: 'bg-purple-100 text-purple-600'
          }].
          map((kpi, i) =>
          <motion.div
            key={i}
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            
                <div className="flex items-center justify-between mb-3">
                  <div
                className={`w-10 h-10 rounded-lg ${kpi.color.split(' ')[0]} flex items-center justify-center`}>
                
                    {i === 0 &&
                <TrendingUpIcon
                  className={`w-5 h-5 ${kpi.color.split(' ')[1]}`} />

                }
                    {i === 1 &&
                <PieChartIcon
                  className={`w-5 h-5 ${kpi.color.split(' ')[1]}`} />

                }
                    {i === 2 &&
                <ClockIcon
                  className={`w-5 h-5 ${kpi.color.split(' ')[1]}`} />

                }
                    {i === 3 &&
                <CheckCircle2Icon
                  className={`w-5 h-5 ${kpi.color.split(' ')[1]}`} />

                }
                  </div>
                  <span
                className={`flex items-center gap-1 text-xs font-semibold ${kpi.up ? 'text-green-600' : 'text-orange-600'}`}>
                
                    {kpi.up ?
                <TrendingUpIcon className="w-3 h-3" /> :

                <TrendingDownIcon className="w-3 h-3" />
                }
                    {kpi.trend}
                  </span>
                </div>
                <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                  {kpi.value}
                  <span className="text-sm font-bold text-gray-400 ml-1">
                    {kpi.suffix}
                  </span>
                </p>
                <p className="text-xs text-globus-gray font-opensans">
                  {kpi.label}
                </p>
              </motion.div>
          )}
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
                2026 vs 2025 (en millions FCFA)
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                  data={revenueData}
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
                      <linearGradient
                      id="colorPrevious"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1">
                      
                        <stop
                        offset="5%"
                        stopColor="#94A3B8"
                        stopOpacity={0.2} />
                      
                        <stop
                        offset="95%"
                        stopColor="#94A3B8"
                        stopOpacity={0} />
                      
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
                    `${value}M FCFA`,
                    name === 'current' ? '2026' : '2025']
                    }
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }} />
                  
                    <Area
                    type="monotone"
                    dataKey="previous"
                    stroke="#94A3B8"
                    strokeWidth={2}
                    fill="url(#colorPrevious)"
                    strokeDasharray="5 5" />
                  
                    <Area
                    type="monotone"
                    dataKey="current"
                    stroke="#F97316"
                    strokeWidth={2.5}
                    fill="url(#colorCurrent)" />
                  
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            
              <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-1">
                Performance Chefs de Projet
              </h3>
              <p className="font-opensans text-xs text-gray-400 mb-4">
                Score global (%)
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                  data={performanceData}
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
                      {performanceData.map((entry, index) =>
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
              </div>
            </motion.div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            
              <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
                Répartition CA par Type de Projet
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                    data={projectTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    stroke="none"
                    paddingAngle={3}>
                    
                      {projectTypeData.map((entry, index) =>
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
              </div>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            
              <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
                Incidents QHSE (6 derniers mois)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                  data={qhseData}
                  margin={{
                    top: 5,
                    right: 10,
                    left: 0,
                    bottom: 0
                  }}>
                  
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
                  {topProjects.map((project, i) =>
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
                  <CalendarIcon className="w-3 h-3" />
                  Dernier: {report.lastRun}
                </span>
                <span className="flex items-center gap-1">
                  <FileTextIcon className="w-3 h-3" />
                  {report.format}
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
                      Générer PDF
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
                  defaultValue="2026-01-01"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange/30" />
                
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-sm text-globus-blue-dark mb-2">
                    Au
                  </label>
                  <input
                  type="date"
                  defaultValue="2026-03-23"
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
              {scheduledReports.map((report) =>
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
                      <button className="p-1 text-gray-400 hover:text-globus-blue">
                        {report.active ?
                    <PauseCircleIcon className="w-4 h-4" /> :

                    <PlayCircleIcon className="w-4 h-4" />
                    }
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-500">
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
    </motion.div>);

}