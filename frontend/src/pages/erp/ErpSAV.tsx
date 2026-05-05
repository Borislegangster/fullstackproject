import React, { useState, Children } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheckIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  SearchIcon,
  FilterIcon,
  MessageSquareIcon,
  UserIcon,
  MapPinIcon,
  ActivityIcon,
  ChevronDownIcon,
  PlusIcon,
  XIcon,
  Loader2Icon,
  DownloadIcon,
  SendIcon } from
'lucide-react';
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
const tabs = [
{
  id: 'open',
  label: 'Tickets Ouverts',
  icon: AlertTriangleIcon
},
{
  id: 'all',
  label: 'Tous les Tickets',
  icon: ShieldCheckIcon
},
{
  id: 'stats',
  label: 'Statistiques',
  icon: ActivityIcon
}];

const mockTickets = [
{
  id: 'SAV-001',
  title: 'Fuite robinet cuisine',
  category: 'Plomberie',
  priority: 'Normal',
  client: 'Jean Talla',
  project: 'Villa Bonapriso',
  status: 'Résolu',
  date: '12/04/2025',
  desc: "Léger goutte à goutte sous l'évier de la cuisine.",
  assignee: 'Paul Mbarga'
},
{
  id: 'SAV-002',
  title: 'Fissure mur salon',
  category: 'Maçonnerie',
  priority: 'Haute',
  client: 'Jean Talla',
  project: 'Villa Bonapriso',
  status: 'En cours',
  date: '20/05/2025',
  desc: 'Micro-fissure apparue près de la baie vitrée.',
  assignee: 'Paul Mbarga'
},
{
  id: 'SAV-003',
  title: 'Prise électrique défectueuse',
  category: 'Électricité',
  priority: 'Normal',
  client: 'Jean Talla',
  project: 'Villa Bonapriso',
  status: 'Ouvert',
  date: '01/06/2025',
  desc: 'La prise murale de la chambre 2 ne fonctionne plus.',
  assignee: 'Non assigné'
},
{
  id: 'SAV-004',
  title: 'Infiltration toiture',
  category: 'Étanchéité',
  priority: 'Urgente',
  client: 'Mme Ndiaye',
  project: 'Résidence Bonanjo',
  status: 'Ouvert',
  date: '15/03/2026',
  desc: "Infiltration d'eau constatée suite aux fortes pluies.",
  assignee: 'Non assigné'
},
{
  id: 'SAV-005',
  title: 'Porte garage bloquée',
  category: 'Menuiserie',
  priority: 'Normal',
  client: 'M. Essomba',
  project: 'Bureau Deïdo',
  status: 'Ouvert',
  date: '18/03/2026',
  desc: 'Le moteur de la porte de garage fait un bruit anormal.',
  assignee: 'Non assigné'
},
{
  id: 'SAV-006',
  title: 'Carrelage fissuré',
  category: 'Revêtement',
  priority: 'Basse',
  client: 'SCI Akwa',
  project: 'Immeuble Akwa',
  status: 'En cours',
  date: '10/03/2026',
  desc: "Deux carreaux fissurés dans le hall d'entrée.",
  assignee: 'Alain Messi'
},
{
  id: 'SAV-007',
  title: 'Climatisation défaillante',
  category: 'CVC',
  priority: 'Haute',
  client: 'Tech Solutions',
  project: 'Bureau Deïdo',
  status: 'Ouvert',
  date: '22/03/2026',
  desc: 'Le split du bureau de direction ne refroidit plus.',
  assignee: 'Non assigné'
},
{
  id: 'SAV-008',
  title: 'Peinture écaillée',
  category: 'Peinture',
  priority: 'Basse',
  client: 'Logistics SA',
  project: 'Entrepôt Bonabéri',
  status: 'Ouvert',
  date: '20/03/2026',
  desc: 'Retouches peinture nécessaires sur façade ouest.',
  assignee: 'Non assigné'
}];

const statsTicketsMois = [
{
  month: 'Oct',
  tickets: 4
},
{
  month: 'Nov',
  tickets: 3
},
{
  month: 'Déc',
  tickets: 5
},
{
  month: 'Jan',
  tickets: 2
},
{
  month: 'Fév',
  tickets: 6
},
{
  month: 'Mar',
  tickets: 8
}];

const statsCategory = [
{
  name: 'Plomberie',
  value: 30,
  color: '#3B82F6'
},
{
  name: 'Électricité',
  value: 25,
  color: '#F59E0B'
},
{
  name: 'Maçonnerie',
  value: 20,
  color: '#6B7280'
},
{
  name: 'Menuiserie',
  value: 15,
  color: '#8B5CF6'
},
{
  name: 'Autres',
  value: 10,
  color: '#10B981'
}];

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'Urgente':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'Haute':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Normal':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Basse':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};
const getStatusColor = (status: string) => {
  switch (status) {
    case 'Résolu':
      return 'bg-green-100 text-green-700';
    case 'En cours':
      return 'bg-blue-100 text-blue-700';
    case 'Ouvert':
      return 'bg-orange-100 text-orange-700';
    case 'Fermé':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};
const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05
    }
  }
};
const fadeUp = {
  hidden: {
    opacity: 0,
    y: 15
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3
    }
  }
};
export function ErpSAV() {
  const [activeTab, setActiveTab] = useState('open');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  // New states for interactive features
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [confirmResolve, setConfirmResolve] = useState<{
    id: string;
  } | null>(null);
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
  const handleNewTicket = () => {
    setIsProcessing('new-ticket');
    setTimeout(() => {
      setIsProcessing(null);
      setShowNewTicket(false);
      showToast('Nouveau ticket SAV créé', 'success');
    }, 1500);
  };
  const handleAssign = () => {
    setIsProcessing('assign');
    setTimeout(() => {
      setIsProcessing(null);
      setShowAssignModal(false);
      showToast('Technicien assigné au ticket', 'success');
    }, 1500);
  };
  const handleResolve = (id: string) => {
    setIsProcessing(`resolve-${id}`);
    setTimeout(() => {
      setIsProcessing(null);
      setConfirmResolve(null);
      showToast('Ticket marqué comme résolu', 'success');
    }, 1500);
  };
  const handleReply = () => {
    setIsProcessing('reply');
    setTimeout(() => {
      setIsProcessing(null);
      setShowReplyModal(false);
      showToast('Réponse envoyée au client', 'success');
    }, 1500);
  };
  const handleExport = () => {
    setIsProcessing('export');
    showToast('Génération du rapport...', 'info');
    setTimeout(() => {
      setIsProcessing(null);
      showToast('Rapport SAV exporté ✓', 'success');
    }, 1500);
  };
  const openTickets = mockTickets.filter(
    (t) => t.status === 'Ouvert' || t.status === 'En cours'
  );
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark flex items-center gap-2">
              <ShieldCheckIcon className="w-7 h-7 text-globus-orange" />
              Service Après-Vente (SAV)
            </h2>
            <p className="font-opensans text-sm text-globus-gray mt-1">
              Gestion des réclamations et garanties clients
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleExport}
              disabled={isProcessing === 'export'}
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 text-sm flex-1 sm:flex-none disabled:opacity-70">
              
              {isProcessing === 'export' ?
              <Loader2Icon className="w-4 h-4 animate-spin" /> :

              <DownloadIcon className="w-4 h-4" />
              }{' '}
              Export
            </button>
            <button
              onClick={() => setShowNewTicket(true)}
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 text-sm flex-1 sm:flex-none">
              
              <PlusIcon className="w-4 h-4" /> Nouveau Ticket
            </button>
          </div>
        </div>
        <div className="flex overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-montserrat font-semibold text-sm transition-colors relative whitespace-nowrap ${isActive ? 'text-globus-orange' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
                
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive &&
                <motion.div
                  layoutId="sav-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-globus-orange" />

                }
              </button>);

          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* TAB 1: OPEN TICKETS */}
        {activeTab === 'open' &&
        <motion.div
          key="open"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                <div className="flex items-center justify-between mb-2">
                  <p className="font-opensans text-sm text-globus-gray">
                    Tickets Ouverts
                  </p>
                  <div className="p-1.5 bg-orange-100 rounded-md">
                    <AlertTriangleIcon className="w-4 h-4 text-orange-600" />
                  </div>
                </div>
                <h3 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark">
                  5
                </h3>
              </motion.div>
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                <div className="flex items-center justify-between mb-2">
                  <p className="font-opensans text-sm text-globus-gray">
                    Temps Réponse Moyen
                  </p>
                  <div className="p-1.5 bg-blue-100 rounded-md">
                    <ClockIcon className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <h3 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark">
                  4h
                </h3>
              </motion.div>
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                <div className="flex items-center justify-between mb-2">
                  <p className="font-opensans text-sm text-globus-gray">
                    Satisfaction Client
                  </p>
                  <div className="p-1.5 bg-green-100 rounded-md">
                    <CheckCircle2Icon className="w-4 h-4 text-green-600" />
                  </div>
                </div>
                <h3 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark">
                  4.2<span className="text-lg text-gray-400">/5</span>
                </h3>
              </motion.div>
            </div>

            {/* Tickets List */}
            <div className="space-y-4">
              {openTickets.map((ticket) =>
            <motion.div
              key={ticket.id}
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              
                  <div
                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                onClick={() =>
                setExpandedTicket(
                  expandedTicket === ticket.id ? null : ticket.id
                )
                }>
                
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-mono text-xs font-bold text-gray-500">
                          {ticket.id}
                        </span>
                        <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityColor(ticket.priority)}`}>
                      
                          {ticket.priority}
                        </span>
                        <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(ticket.status)}`}>
                      
                          {ticket.status}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" /> {ticket.date}
                        </span>
                      </div>
                      <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                        {ticket.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-4 h-4" /> {ticket.client}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="w-4 h-4" /> {ticket.project}
                        </span>
                        <span className="flex items-center gap-1 text-gray-400">
                          • {ticket.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-gray-500 mb-1">Assigné à</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {ticket.assignee}
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <ChevronDownIcon
                      className={`w-5 h-5 text-gray-500 transition-transform ${expandedTicket === ticket.id ? 'rotate-180' : ''}`} />
                    
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedTicket === ticket.id &&
                <motion.div
                  initial={{
                    height: 0,
                    opacity: 0
                  }}
                  animate={{
                    height: 'auto',
                    opacity: 1
                  }}
                  exit={{
                    height: 0,
                    opacity: 0
                  }}
                  className="border-t border-gray-100 bg-gray-50/50">
                  
                        <div className="p-5">
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                            Description du problème
                          </h4>
                          <p className="text-sm text-gray-700 bg-white p-4 rounded-lg border border-gray-200 mb-5">
                            "{ticket.desc}"
                          </p>

                          <div className="flex flex-wrap gap-3">
                            <button
                        onClick={() => {
                          setSelectedTicketId(ticket.id);
                          setShowReplyModal(true);
                        }}
                        className="bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-2">
                        
                              <MessageSquareIcon className="w-4 h-4" /> Répondre
                              au client
                            </button>
                            {ticket.status === 'Ouvert' &&
                      <button
                        onClick={() => {
                          setSelectedTicketId(ticket.id);
                          setShowAssignModal(true);
                        }}
                        className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-montserrat font-bold py-2 px-4 rounded-lg text-sm transition-colors">
                        
                                Prendre en charge
                              </button>
                      }
                            <button
                        onClick={() =>
                        setConfirmResolve({
                          id: ticket.id
                        })
                        }
                        className="bg-white border border-green-500 text-green-600 hover:bg-green-50 font-montserrat font-bold py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-2 ml-auto">
                        
                              <CheckCircle2Icon className="w-4 h-4" /> Marquer
                              comme Résolu
                            </button>
                          </div>
                        </div>
                      </motion.div>
                }
                  </AnimatePresence>
                </motion.div>
            )}
            </div>
          </motion.div>
        }

        {/* TAB 2: ALL TICKETS */}
        {activeTab === 'all' &&
        <motion.div
          key="all"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-80">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                  type="text"
                  placeholder="Rechercher un ticket, client..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-globus-blue" />
                
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue flex-1 sm:flex-none">
                    <option>Tous les statuts</option>
                    <option>Ouvert</option>
                    <option>En cours</option>
                    <option>Résolu</option>
                  </select>
                  <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue flex-1 sm:flex-none">
                    <option>Toutes priorités</option>
                    <option>Urgente</option>
                    <option>Haute</option>
                    <option>Normal</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-montserrat font-bold text-gray-500 uppercase">
                      <th className="py-3 px-5">ID</th>
                      <th className="py-3 px-5">Titre</th>
                      <th className="py-3 px-5">Client / Projet</th>
                      <th className="py-3 px-5">Catégorie</th>
                      <th className="py-3 px-5">Priorité</th>
                      <th className="py-3 px-5">Statut</th>
                      <th className="py-3 px-5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm font-opensans">
                    {mockTickets.map((ticket) =>
                  <tr
                    key={ticket.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer">
                    
                        <td className="py-3 px-5 font-mono text-xs font-bold text-gray-500">
                          {ticket.id}
                        </td>
                        <td className="py-3 px-5 font-semibold text-gray-800">
                          {ticket.title}
                        </td>
                        <td className="py-3 px-5">
                          <p className="text-gray-800">{ticket.client}</p>
                          <p className="text-xs text-gray-500">
                            {ticket.project}
                          </p>
                        </td>
                        <td className="py-3 px-5 text-gray-600">
                          {ticket.category}
                        </td>
                        <td className="py-3 px-5">
                          <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityColor(ticket.priority)}`}>
                        
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="py-3 px-5">
                          <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(ticket.status)}`}>
                        
                            {ticket.status}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-gray-500 text-xs">
                          {ticket.date}
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        }

        {/* TAB 3: STATS */}
        {activeTab === 'stats' &&
        <motion.div
          key="stats"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
                  Tickets par Mois
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                    data={statsTicketsMois}
                    margin={{
                      top: 5,
                      right: 10,
                      left: -20,
                      bottom: 0
                    }}>
                    
                      <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f3f4f6" />
                    
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
                      contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '12px'
                      }} />
                    
                      <Bar
                      dataKey="tickets"
                      fill="#3B82F6"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40} />
                    
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
                  Répartition par Catégorie
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                      data={statsCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}>
                      
                        {statsCategory.map((entry, index) =>
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
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{
                        fontSize: '12px'
                      }} />
                    
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-6">
              
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2Icon className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="font-opensans text-sm text-gray-500 mb-1">
                    Taux de résolution global
                  </p>
                  <h3 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark">
                    87%
                  </h3>
                </div>
              </motion.div>
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-6">
              
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <ClockIcon className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <p className="font-opensans text-sm text-gray-500 mb-1">
                    Délai moyen de résolution
                  </p>
                  <h3 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark">
                    3.2{' '}
                    <span className="text-lg text-gray-400 font-normal">
                      jours
                    </span>
                  </h3>
                </div>
              </motion.div>
            </div>

            {/* NEW: Client Satisfaction & Guarantees */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Satisfaction Client */}
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4 flex items-center gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-globus-orange" />
                  Retours de Satisfaction Client
                </h3>
                <div className="space-y-4">
                  {[
                {
                  ticket: 'SAV-001 (Fuite robinet)',
                  client: 'Jean Talla',
                  rating: 5,
                  comment:
                  'Intervention très rapide et efficace. Le technicien était très professionnel.',
                  date: '15/04/2025'
                },
                {
                  ticket: 'SAV-006 (Carrelage fissuré)',
                  client: 'SCI Akwa',
                  rating: 4,
                  comment:
                  'Problème résolu, mais délai un peu long pour avoir les carreaux de rechange.',
                  date: '20/03/2026'
                }].
                map((review, idx) =>
                <div
                  key={idx}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                            {review.client}
                          </p>
                          <p className="text-xs text-gray-500">
                            {review.ticket}
                          </p>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) =>
                      <svg
                        key={star}
                        className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20">
                        
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                      )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 italic">
                        "{review.comment}"
                      </p>
                      <p className="text-xs text-gray-400 mt-2 text-right">
                        {review.date}
                      </p>
                    </div>
                )}
                </div>
              </motion.div>

              {/* Guarantees Tracking */}
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4 flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-globus-orange" />
                  Suivi des Garanties (Villa Bonapriso)
                </h3>
                <div className="space-y-4">
                  {[
                {
                  name: 'Garantie de parfait achèvement',
                  duration: '1 an',
                  expires: '15/06/2025',
                  status: 'Active',
                  desc: "Couvre tous les désordres signalés lors de la réception ou dans l'année qui suit."
                },
                {
                  name: 'Garantie biennale',
                  duration: '2 ans',
                  expires: '15/06/2026',
                  status: 'Active',
                  desc: "Couvre les équipements dissociables de l'ouvrage (portes, fenêtres, plomberie apparente)."
                },
                {
                  name: 'Garantie décennale',
                  duration: '10 ans',
                  expires: '15/06/2034',
                  status: 'Active',
                  desc: "Couvre les dommages compromettant la solidité de l'ouvrage ou le rendant impropre à sa destination."
                }].
                map((guarantee, idx) =>
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                  
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark">
                            {guarantee.name} ({guarantee.duration})
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                            {guarantee.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">
                          {guarantee.desc}
                        </p>
                        <p className="text-xs font-semibold text-globus-orange">
                          Expire le : {guarantee.expires}
                        </p>
                      </div>
                    </div>
                )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* New Ticket Modal */}
      <AnimatePresence>
        {showNewTicket &&
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
          onClick={() => setShowNewTicket(false)}>
          
            <motion.div
            initial={{
              scale: 0.95,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.95,
              opacity: 0
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            
              <div className="bg-globus-blue-dark p-6 text-white flex items-center justify-between">
                <h3 className="font-montserrat font-bold text-xl">
                  Nouveau Ticket SAV
                </h3>
                <button
                onClick={() => setShowNewTicket(false)}
                className="text-white/70 hover:text-white">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                    Titre du problème
                  </label>
                  <input
                  type="text"
                  placeholder="Ex: Fuite d'eau salle de bain"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                      Client
                    </label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                      <option>Jean Talla</option>
                      <option>Mme Ndiaye</option>
                      <option>SCI Akwa</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                      Projet
                    </label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                      <option>Villa Bonapriso</option>
                      <option>Résidence Bonanjo</option>
                      <option>Immeuble Akwa</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                      Catégorie
                    </label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                      <option>Plomberie</option>
                      <option>Électricité</option>
                      <option>Maçonnerie</option>
                      <option>Menuiserie</option>
                      <option>Étanchéité</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                      Priorité
                    </label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                      <option>Normal</option>
                      <option>Basse</option>
                      <option>Haute</option>
                      <option>Urgente</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                    Description détaillée
                  </label>
                  <textarea
                  rows={3}
                  placeholder="Décrivez le problème constaté..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange resize-none" />
                
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                  onClick={() => setShowNewTicket(false)}
                  className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                  
                    Annuler
                  </button>
                  <button
                  onClick={handleNewTicket}
                  disabled={isProcessing === 'new-ticket'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {isProcessing === 'new-ticket' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <PlusIcon className="w-4 h-4" />
                  }{' '}
                    Créer le ticket
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Assign Technician Modal */}
      <AnimatePresence>
        {showAssignModal &&
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
          onClick={() => setShowAssignModal(false)}>
          
            <motion.div
            initial={{
              scale: 0.95,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.95,
              opacity: 0
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Assigner un technicien
                </h3>
                <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-500 mb-2">
                  Ticket:{' '}
                  <span className="font-bold text-gray-800">
                    {selectedTicketId}
                  </span>
                </p>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Sélectionner un technicien
                  </label>
                  <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-blue">
                    <option>Paul Mbarga (Plomberie)</option>
                    <option>Alain Messi (Électricité)</option>
                    <option>Claire Fotso (Architecture)</option>
                    <option>Moi-même</option>
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg font-montserrat font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors text-sm">
                  
                    Annuler
                  </button>
                  <button
                  onClick={handleAssign}
                  disabled={isProcessing === 'assign'}
                  className="flex-1 bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-md text-sm flex items-center justify-center gap-2 disabled:opacity-70">
                  
                    {isProcessing === 'assign' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :
                  null}{' '}
                    Assigner
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Reply Modal */}
      <AnimatePresence>
        {showReplyModal &&
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
          onClick={() => setShowReplyModal(false)}>
          
            <motion.div
            initial={{
              scale: 0.95,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.95,
              opacity: 0
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            
              <div className="bg-globus-blue-dark p-6 text-white flex items-center justify-between">
                <h3 className="font-montserrat font-bold text-xl">
                  Répondre au client
                </h3>
                <button
                onClick={() => setShowReplyModal(false)}
                className="text-white/70 hover:text-white">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-500 mb-2">
                  Ticket:{' '}
                  <span className="font-bold text-gray-800">
                    {selectedTicketId}
                  </span>
                </p>
                <div>
                  <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    Votre message
                  </label>
                  <textarea
                  rows={5}
                  placeholder="Bonjour, nous avons bien pris en compte votre demande..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-blue resize-none" />
                
                </div>
                <div className="flex items-center gap-2">
                  <input
                  type="checkbox"
                  id="changeStatus"
                  className="rounded text-globus-blue focus:ring-globus-blue" />
                
                  <label
                  htmlFor="changeStatus"
                  className="text-sm text-gray-700">
                  
                    Passer le statut à "En cours"
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                  onClick={() => setShowReplyModal(false)}
                  className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                  
                    Annuler
                  </button>
                  <button
                  onClick={handleReply}
                  disabled={isProcessing === 'reply'}
                  className="bg-globus-blue hover:bg-globus-blue-dark text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {isProcessing === 'reply' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <SendIcon className="w-4 h-4" />
                  }{' '}
                    Envoyer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Resolve Confirmation Dialog */}
      <AnimatePresence>
        {confirmResolve &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          
            <motion.div
            initial={{
              scale: 0.95,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            exit={{
              scale: 0.95,
              opacity: 0
            }}
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2Icon className="w-8 h-8" />
              </div>
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                Résoudre le ticket
              </h3>
              <p className="text-gray-600 mb-6">
                Confirmez-vous que le problème du ticket {confirmResolve.id} a
                été résolu ? Le client sera notifié.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                onClick={() => setConfirmResolve(null)}
                className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                
                  Annuler
                </button>
                <button
                onClick={() => handleResolve(confirmResolve.id)}
                disabled={isProcessing?.startsWith('resolve')}
                className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-md flex items-center gap-2 disabled:opacity-70">
                
                  {isProcessing?.startsWith('resolve') ?
                <Loader2Icon className="w-4 h-4 animate-spin" /> :
                null}{' '}
                  Confirmer
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast &&
        <motion.div
          initial={{
            opacity: 0,
            y: 50,
            scale: 0.9
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1
          }}
          exit={{
            opacity: 0,
            y: 20,
            scale: 0.9
          }}
          className="fixed bottom-6 right-6 z-[70]">
          
            <div
            className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 font-montserrat font-bold text-sm text-white ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-globus-blue-dark'}`}>
            
              {toast.type === 'success' ?
            <CheckCircle2Icon className="w-5 h-5" /> :
            toast.type === 'error' ?
            <AlertTriangleIcon className="w-5 h-5" /> :

            <CheckCircle2Icon className="w-5 h-5" />
            }
              {toast.message}
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}