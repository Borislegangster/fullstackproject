import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheckIcon, AlertTriangleIcon, CheckCircle2Icon, ClockIcon, SearchIcon, MessageSquareIcon, UserIcon, MapPinIcon, ActivityIcon, ChevronDownIcon, PlusIcon, XIcon, Loader2Icon, DownloadIcon, SendIcon } from 'lucide-react';
import { formatDate, formatDateParts } from '../../utils/datetime';
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
import { useSAVTickets, useCreateSAVTicket, useAssignSAVTicket, useResolveSAVTicket, useReplySAVTicket, useSAVByCategory, useSAVStats, useProjects, useEmployees, useUsers, useWarranties } from '../../hooks/useErp';
import { downloadCSV } from '../../utils/download';
import { ChartEmpty } from '../../components/ui/ChartEmpty';

const SAV_CAT_COLORS = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444', '#9CA3AF'];
const SAV_CAT_LABELS: Record<string, string> = {
  plomberie: 'Plomberie', electricite: 'Électricité', structure: 'Structure',
  finitions: 'Finitions', general: 'Général',
};
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
function ticketStatusToUi(status: string): string {
  switch (status) {
    case 'OUVERT': return 'Ouvert';
    case 'EN_COURS': return 'En cours';
    case 'RESOLU': return 'Résolu';
    case 'FERME': return 'Fermé';
    default: return status;
  }
}
function ticketPriorityToUi(p: string): string {
  switch (p) {
    case 'URGENTE': return 'Urgente';
    case 'HAUTE': return 'Haute';
    case 'NORMALE': return 'Normal';
    case 'BASSE': return 'Basse';
    default: return p;
  }
}
function ticketCategoryToUi(c: string): string {
  if (!c) return 'Général';
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export function ErpSAV() {
  const { data: apiTickets } = useSAVTickets();
  const { data: apiWarranties } = useWarranties();
  const { data: apiByCategory } = useSAVByCategory();
  const { data: apiSAVStats } = useSAVStats();
  const savStats = apiSAVStats || { open: 0, in_progress: 0, resolved: 0, avg_rating: 0 };
  const createTicketMutation = useCreateSAVTicket();
  const assignMutation = useAssignSAVTicket();
  const { data: apiProjects } = useProjects();
  const { data: apiEmployees } = useEmployees();
  const { data: apiUsers } = useUsers();
  const projectOptions: any[] = Array.isArray(apiProjects) ? apiProjects : [];
  const employeeOptions: any[] = Array.isArray(apiEmployees) ? apiEmployees : [];
  const clientOptions: any[] = Array.isArray(apiUsers) ? apiUsers.filter((u: any) => u.role === 'CLIENT') : [];
  const resolveMutation = useResolveSAVTicket();
  const replyMutation = useReplySAVTicket();

  const tickets = useMemo(() => {
    if (!Array.isArray(apiTickets)) return [];
    return apiTickets.map((t: any) => ({
      id: t.code || t.id,
      raw_id: t.id,
      title: t.subject || '',
      category: ticketCategoryToUi(t.category),
      priority: ticketPriorityToUi(t.priority),
      client: t.client_id || '',
      project: t.project_id || '',
      status: ticketStatusToUi(t.status),
      date: formatDate(t.created_at),
      desc: t.description || '',
      assignee: t.assigned_to || '',
      rating: t.rating || 0,
      ratingComment: t.rating_comment || '',
    }));
  }, [apiTickets]);

  const liveWarranties = useMemo(() => {
    if (!Array.isArray(apiWarranties)) return [] as any[];
    return apiWarranties.map((w: any) => ({
      id: w.id,
      name: w.name || '',
      duration: w.duration || '',
      description: w.description || '',
      status: w.status === 'ACTIVE' ? 'Active' : 'Expirée',
      expires: formatDate(w.expires_at),
    }));
  }, [apiWarranties]);

  const reviews = useMemo(
    () => tickets.filter((t: any) => t.rating > 0).map((t: any) => ({
      id: t.id, title: t.title, rating: t.rating, comment: t.ratingComment, date: t.date,
    })),
    [tickets],
  );

  // SAV by-category → pie (from /sav/stats/by-category).
  const statsCategory = useMemo(() => {
    if (!Array.isArray(apiByCategory)) return [];
    return apiByCategory.map((c: any, i: number) => ({
      name: SAV_CAT_LABELS[c.category] || c.category || 'Autre',
      value: c.count || 0,
      color: SAV_CAT_COLORS[i % SAV_CAT_COLORS.length],
    }));
  }, [apiByCategory]);

  // Monthly ticket volume → bar (derived from the raw tickets list).
  const statsTicketsMois = useMemo(() => {
    if (!Array.isArray(apiTickets) || apiTickets.length === 0) return [];
    const buckets: Record<string, number> = {};
    for (const t of apiTickets) {
      if (!t.created_at) continue;
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = (buckets[key] || 0) + 1;
    }
    return Object.keys(buckets).sort().slice(-6).map((k) => ({
      month: formatDateParts(k + '-01', { month: 'short' }),
      tickets: buckets[k],
    }));
  }, [apiTickets]);

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
  const handleNewTicket = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsProcessing('new-ticket');
    const form = e?.target as HTMLFormElement | undefined;
    try {
      await createTicketMutation.mutateAsync({
        project_id: form ? (form.elements.namedItem('project_id') as HTMLSelectElement)?.value || '' : '',
        subject: form ? (form.elements.namedItem('subject') as HTMLInputElement)?.value || 'Ticket' : 'Ticket',
        description: form ? (form.elements.namedItem('description') as HTMLTextAreaElement)?.value || '' : '',
        category: form ? (form.elements.namedItem('category') as HTMLSelectElement)?.value || 'general' : 'general',
        priority: form ? (form.elements.namedItem('priority') as HTMLSelectElement)?.value || 'NORMALE' : 'NORMALE',
      });
      setShowNewTicket(false);
      showToast('Nouveau ticket SAV créé', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleAssign = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsProcessing('assign');
    const form = e?.target as HTMLFormElement | undefined;
    const ticket = tickets.find((t) => t.id === selectedTicketId);
    try {
      if (!ticket) throw new Error('Ticket introuvable');
      const assigneeId = form
        ? (form.elements.namedItem('assignee') as HTMLSelectElement)?.value || ''
        : '';
      if (!assigneeId) throw new Error('Veuillez sélectionner un technicien');
      await assignMutation.mutateAsync({
        id: (ticket as any).raw_id || ticket.id,
        assigneeId,
      });
      setShowAssignModal(false);
      showToast('Technicien assigné au ticket', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || err?.message || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleResolve = async (id: string) => {
    setIsProcessing(`resolve-${id}`);
    const ticket = tickets.find((t) => t.id === id);
    try {
      await resolveMutation.mutateAsync((ticket as any)?.raw_id || id);
      setConfirmResolve(null);
      showToast('Ticket marqué comme résolu', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsProcessing('reply');
    const form = e?.target as HTMLFormElement | undefined;
    const ticket = tickets.find((t) => t.id === selectedTicketId);
    try {
      if (!ticket) throw new Error('Ticket introuvable');
      await replyMutation.mutateAsync({
        id: (ticket as any).raw_id || ticket.id,
        data: {
          content: form ? (form.elements.namedItem('content') as HTMLTextAreaElement)?.value || '' : '',
          is_internal: form ? !!(form.elements.namedItem('is_internal') as HTMLInputElement)?.checked : false,
        },
      });
      setShowReplyModal(false);
      showToast('Réponse envoyée au client', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || err?.message || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleExport = () => {
    if (tickets.length === 0) {
      showToast('Aucun ticket à exporter', 'info');
      return;
    }
    setIsProcessing('export');
    try {
      const projName = (id: string) =>
        projectOptions.find((p: any) => p.id === id)?.name || id || '';
      const cliName = (id: string) => {
        const u = clientOptions.find((c: any) => c.id === id);
        return u
          ? u.name ||
              `${u.first_name || ''} ${u.last_name || ''}`.trim() ||
              u.email ||
              id
          : id || '';
      };
      downloadCSV(
        `sav-tickets-${new Date().toISOString().slice(0, 10)}.csv`,
        tickets.map((t: any) => ({
          id: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          status: t.status,
          client: cliName(t.client),
          project: projName(t.project),
          date: t.date,
          rating: t.rating || '',
          comment: t.ratingComment || '',
        })),
        [
          { key: 'id', label: 'Référence' },
          { key: 'title', label: 'Sujet' },
          { key: 'category', label: 'Catégorie' },
          { key: 'priority', label: 'Priorité' },
          { key: 'status', label: 'Statut' },
          { key: 'client', label: 'Client' },
          { key: 'project', label: 'Projet' },
          { key: 'date', label: 'Date' },
          { key: 'rating', label: 'Note' },
          { key: 'comment', label: 'Commentaire' },
        ],
      );
      showToast('Rapport SAV exporté ✓', 'success');
    } catch {
      showToast("Échec de l'export", 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const openTickets = tickets.filter(
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
                  {openTickets.length}
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
                  {(() => {
                    const resolved = Array.isArray(apiTickets) ? apiTickets.filter((t: any) => t.resolved_at && t.created_at) : [];
                    if (resolved.length === 0) return '—';
                    const totalHours = resolved.reduce((sum: number, t: any) => {
                      const diff = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
                      return sum + diff / (1000 * 60 * 60);
                    }, 0);
                    const avg = totalHours / resolved.length;
                    return avg < 24 ? `${Math.round(avg)}h` : `${(avg / 24).toFixed(1)}j`;
                  })()}
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
                  {savStats.avg_rating || '—'}<span className="text-lg text-gray-400">/5</span>
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
                    {tickets.map((ticket) =>
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
                  {statsTicketsMois.length === 0 ? (
                    <ChartEmpty message="Aucun ticket sur la période" />
                  ) : (
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
                  )}
                </div>
              </motion.div>

              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">

                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4">
                  Répartition par Catégorie
                </h3>
                <div className="h-64">
                  {statsCategory.length === 0 ? (
                    <ChartEmpty message="Aucune donnée par catégorie" />
                  ) : (
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
                  )}
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
                    {(() => {
                      const total = savStats.open + savStats.in_progress + savStats.resolved;
                      return total > 0 ? `${Math.round((savStats.resolved / total) * 100)}%` : '—';
                    })()}
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
                    {(() => {
                      const resolved = Array.isArray(apiTickets) ? apiTickets.filter((t: any) => t.resolved_at && t.created_at) : [];
                      if (resolved.length === 0) return '—';
                      const totalDays = resolved.reduce((sum: number, t: any) => {
                        const diff = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
                        return sum + diff / (1000 * 60 * 60 * 24);
                      }, 0);
                      return (totalDays / resolved.length).toFixed(1);
                    })()}{' '}
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
                {reviews.length === 0 ?
              <p className="text-sm text-gray-400 italic">Aucun retour de satisfaction pour le moment.</p> :
              <div className="space-y-4">
                  {reviews.map((rv) =>
                <div key={rv.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-montserrat font-bold text-sm text-globus-blue-dark">{rv.title}</p>
                          <p className="text-xs text-gray-500">{rv.id}</p>
                        </div>
                        <span className="text-sm font-bold text-yellow-500">{rv.rating}/5 ★</span>
                      </div>
                      {rv.comment &&
                  <p className="text-sm text-gray-600 italic">"{rv.comment}"</p>
                  }
                      <p className="text-xs text-gray-400 mt-2 text-right">{rv.date}</p>
                    </div>
                )}
                </div>
              }
              </motion.div>

              {/* Guarantees Tracking */}
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4 flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-globus-orange" />
                  Suivi des Garanties
                </h3>
                {liveWarranties.length === 0 ?
              <p className="text-sm text-gray-400 italic">Aucune garantie suivie pour le moment.</p> :
              <div className="space-y-4">
                  {liveWarranties.map((w) =>
                <div key={w.id} className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark">
                            {w.name}{w.duration ? ` (${w.duration})` : ''}
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${w.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {w.status}
                          </span>
                        </div>
                        {w.description &&
                    <p className="text-xs text-gray-600 mb-1">{w.description}</p>
                    }
                        {w.expires &&
                    <p className="text-xs font-semibold text-globus-orange">Expire le : {w.expires}</p>
                    }
                      </div>
                    </div>
                )}
                </div>
              }
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
                      <option value="">— Sélectionner —</option>
                      {clientOptions.map((c) =>
                      <option key={c.id} value={c.id}>{`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                      Projet
                    </label>
                    <select name="project_id" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
                      <option value="">— Sélectionner un projet —</option>
                      {projectOptions.map((pr) =>
                      <option key={pr.id} value={pr.id}>{pr.name || pr.code}</option>
                      )}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
                      Catégorie
                    </label>
                    <select name="category" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">
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
                  <select name="assignee" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-blue">
                    <option value="">— Sélectionner un technicien —</option>
                    {employeeOptions.map((emp) =>
                    <option key={emp.id} value={emp.id}>{`${emp.first_name || ''} ${emp.last_name || ''}`.trim()}{emp.position ? ` (${emp.position})` : ''}</option>
                    )}
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