import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate } from '../../utils/datetime';
import {
  HardHatIcon,
  TrendingUpIcon,
  WalletIcon,
  AlertTriangleIcon,
  SearchIcon,
  FilterIcon,
  MapPinIcon,
  CalendarIcon,
  UsersIcon,
  ChevronRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  CloudSunIcon,
  CameraIcon,
  BarChart3Icon,
  BoxIcon,
  TruckIcon,
  PlusIcon,
  XIcon,
  Loader2Icon,
  InfoIcon } from
'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend } from
'recharts';
import {
  useProjects, useCreateProject, useCreateIncident,
  useResourceAllocation, useTeamAssignments, useCreateTeamAssignment, useDeleteTeamAssignment,
  useProjectGallery, useQHSEStats, useEquipment, useStock,
} from '../../hooks/useErp';
import { ExportButton } from '../../components/ui/ExportButton';
import { ChartEmpty } from '../../components/ui/ChartEmpty';
import { exportProjectsXlsx } from '../../services/api/downloads';
const tabs = [
{
  id: 'overview',
  label: "Vue d'ensemble",
  icon: BarChart3Icon
},
{
  id: 'detail',
  label: 'Détail Projet',
  icon: HardHatIcon
},
{
  id: 'team',
  label: 'Équipe & Ressources',
  icon: UsersIcon
}];





const formatCurrency = (value: number) =>
new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0
}).format(value) + ' FCFA';
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
function statusColorFor(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'EN_RETARD': return 'bg-red-100 text-red-700';
    case 'SUSPENDU': return 'bg-yellow-100 text-yellow-700';
    case 'TERMINE': return 'bg-green-100 text-green-700';
    case 'ARCHIVE': return 'bg-gray-100 text-gray-600';
    default: return 'bg-blue-100 text-blue-700';
  }
}

function statusLabelFor(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'EN_RETARD': return 'En retard';
    case 'SUSPENDU': return 'En pause';
    case 'TERMINE': return 'Terminé';
    case 'ARCHIVE': return 'Archivé';
    case 'EN_COURS': return 'En cours';
    default: return status || '';
  }
}

export function ErpChantiers() {
  // API hooks
  const { data: apiProjects } = useProjects();
  const { data: apiAssignments } = useTeamAssignments();
  const { data: apiResource } = useResourceAllocation();
  const createProjectMutation = useCreateProject();
  const createIncidentMutation = useCreateIncident();
  const createAssignmentMutation = useCreateTeamAssignment();
  const deleteAssignmentMutation = useDeleteTeamAssignment();

  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');

  // Team assignments from API (no local state / mock).
  const teamAssignments = useMemo(() => {
    if (!Array.isArray(apiAssignments)) return [];
    return apiAssignments.map((a: any) => ({
      id: a.id,
      name: a.member_name,
      role: a.role,
      project: a.project_name || '—',
      hours: a.hours || 0,
      status: a.status || 'Sur site',
    }));
  }, [apiAssignments]);

  // Resource allocation → stacked bar (workers + equipment per project).
  const resourceData = useMemo(() => {
    if (!Array.isArray(apiResource)) return [];
    return apiResource.map((r: any) => ({
      name: r.project_name,
      Ouvriers: r.workers || 0,
      Équipements: r.equipment || 0,
    }));
  }, [apiResource]);
  const resourceHasData = resourceData.some((r) => r.Ouvriers > 0 || r['Équipements'] > 0);

  // Map API projects → UI shape (live, no local state)
  const projects = useMemo(() => {
    if (!Array.isArray(apiProjects) || apiProjects.length === 0) return [];
    return apiProjects.map((p: any) => ({
      id: p.id,
      code: p.code || '',
      name: p.name || '',
      client: p.client_name || '',
      client_id: p.client_id,
      location: p.location || '',
      progress: p.progress || 0,
      budget: p.budget_initial || 0,
      spent: p.budget_spent || 0,
      status: statusLabelFor(p.status),
      raw_status: p.status,
      statusColor: statusColorFor(p.status),
      startDate: formatDate(p.start_date, 'À définir'),
      endDate: formatDate(p.estimated_end_date || p.end_date, 'À définir'),
      team: [],
    }));
  }, [apiProjects]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId]
  );
  const { data: galleryRaw } = useProjectGallery((selectedProject as any)?.id || '');
  const liveGallery = useMemo(() => {
    if (!Array.isArray(galleryRaw)) return [] as { url: string; caption: string }[];
    return galleryRaw
      .map((m: any) => ({ url: m.url || '', caption: m.caption || '' }))
      .filter((m) => m.url);
  }, [galleryRaw]);
  // Real cross-module counts (no hardcoded figures).
  const { data: qhseStats } = useQHSEStats();
  const openIncidents = Number((qhseStats as any)?.open_incidents ?? 0);
  const { data: equipmentData } = useEquipment();
  const equipmentList: any[] = Array.isArray(equipmentData) ? equipmentData : [];
  const equipmentInMaintenance = equipmentList.filter(
    (e: any) => /maintenance/i.test(e.status || ''),
  ).length;
  const { data: stockData } = useStock();
  const stockList: any[] = Array.isArray(stockData) ? stockData : [];
  const lowStockCount = stockList.filter(
    (s: any) => (s.quantity ?? 0) <= (s.threshold ?? s.min_quantity ?? 0),
  ).length;
  const timeline: any[] = Array.isArray((selectedProject as any)?.phases)
    ? (selectedProject as any).phases.map((ph: any) => ({
        name: ph.name || '',
        status: (ph.status === 'TERMINEE' || ph.status === 'TERMINE') ? 'done'
          : ph.status === 'EN_COURS' ? 'current' : 'upcoming',
        date: formatDate(ph.end_date || ph.start_date),
      }))
    : [];
  // UI States
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    active: boolean;
    message: string;
    type: 'success' | 'info';
  }>({
    active: false,
    message: '',
    type: 'success'
  });
  // Modals
  const [newProjectModal, setNewProjectModal] = useState(false);
  const [incidentModal, setIncidentModal] = useState<{
    isOpen: boolean;
    project: any;
  }>({
    isOpen: false,
    project: null
  });
  const [assignTeamModal, setAssignTeamModal] = useState(false);
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.client.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Tous' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({
      active: true,
      message,
      type
    });
    setTimeout(
      () =>
      setToast({
        active: false,
        message: '',
        type: 'success'
      }),
      3000
    );
  };
  const handleNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('new-project');
    const form = e.target as HTMLFormElement;
    try {
      await createProjectMutation.mutateAsync({
        name: (form.elements.namedItem('name') as HTMLInputElement).value,
        location: (form.elements.namedItem('location') as HTMLInputElement).value,
        budget_initial: parseFloat(
          (form.elements.namedItem('budget') as HTMLInputElement).value
        ) || 0,
        description: '',
      });
      setNewProjectModal(false);
      showToast('Nouveau chantier créé avec succès');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || "Erreur lors de la création", 'info');
    } finally {
      setProcessingId(null);
    }
  };
  const handleReportIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('incident');
    const form = e.target as HTMLFormElement;
    const project = incidentModal.project;
    if (!project) {
      setProcessingId(null);
      return;
    }
    try {
      await createIncidentMutation.mutateAsync({
        project_id: project.id,
        title: (form.elements.namedItem('title') as HTMLInputElement)?.value || 'Incident',
        description: (form.elements.namedItem('description') as HTMLTextAreaElement)?.value || '',
        severity: (form.elements.namedItem('severity') as HTMLSelectElement)?.value || 'MINEUR',
        category: '',
        location: project.location || '',
        incident_date: new Date().toISOString(),
      });
      setIncidentModal({ isOpen: false, project: null });
      showToast('Incident signalé et notifié au responsable QHSE');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur lors du signalement', 'info');
    } finally {
      setProcessingId(null);
    }
  };
  const handleAssignTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('assign');
    const form = e.target as HTMLFormElement;
    try {
      await createAssignmentMutation.mutateAsync({
        project_id: (form.elements.namedItem('project') as HTMLSelectElement).value,
        member_name: (form.elements.namedItem('name') as HTMLInputElement).value,
        role: (form.elements.namedItem('role') as HTMLInputElement).value,
        hours: parseInt((form.elements.namedItem('hours') as HTMLInputElement).value) || 0,
        status: 'Sur site',
      });
      setAssignTeamModal(false);
      showToast('Membre assigné avec succès');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || "Échec de l'affectation", 'info');
    } finally {
      setProcessingId(null);
    }
  };
  const CircularProgress = ({ percentage }: {percentage: number;}) => {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - percentage / 100 * circumference;
    return (
      <div className="relative w-14 h-14 flex items-center justify-center">
        <svg className="transform -rotate-90 w-14 h-14">
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-gray-200" />
          
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`${percentage >= 80 ? 'text-green-500' : percentage >= 40 ? 'text-blue-500' : 'text-orange-500'} transition-all duration-1000 ease-out`} />
          
        </svg>
        <span className="absolute text-xs font-bold text-gray-700">
          {percentage}%
        </span>
      </div>);

  };
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark flex items-center gap-2">
              <HardHatIcon className="w-7 h-7 text-globus-orange" />
              Gestion des Chantiers
            </h2>
            <p className="font-opensans text-sm text-globus-gray mt-1">
              Suivi, planification et allocation des ressources
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <ExportButton onAction={exportProjectsXlsx} />
            <button
              onClick={() => setNewProjectModal(true)}
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
              <PlusIcon className="w-4 h-4" /> Nouveau Chantier
            </button>
          </div>
        </div>
        <div className="flex overflow-x-auto">
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
                  layoutId="chantiers-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-globus-orange" />

                }
              </button>);

          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' &&
        <motion.div
          key="overview"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <HardHatIcon className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                  {projects.filter((p) => p.status === 'En cours').length}
                </p>
                <p className="text-xs text-globus-gray font-opensans">
                  Chantiers Actifs
                </p>
              </motion.div>
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <TrendingUpIcon className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                  {projects.length ?
                  Math.round(
                    projects.reduce((acc, p) => acc + p.progress, 0) /
                    projects.length
                  ) :
                  0}
                  %
                </p>
                <p className="text-xs text-globus-gray font-opensans">
                  Taux Avancement Moyen
                </p>
              </motion.div>
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <WalletIcon className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                  {(
                projects.reduce((acc, p) => acc + p.budget, 0) / 1000000000).
                toFixed(1)}{' '}
                  Mrd
                </p>
                <p className="text-xs text-globus-gray font-opensans">
                  Budget Total Engagé (FCFA)
                </p>
              </motion.div>
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangleIcon className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                  {openIncidents}
                </p>
                <p className="text-xs text-globus-gray font-opensans">
                  Incidents Ouverts
                </p>
              </motion.div>
            </div>

            {/* Filters */}
            <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            
              <div className="relative w-full sm:w-96">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                type="text"
                placeholder="Rechercher un chantier, client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-globus-blue focus:ring-1 focus:ring-globus-blue/30" />
              
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <FilterIcon className="w-4 h-4 text-gray-400" />
                <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue">
                
                  <option value="Tous">Tous les statuts</option>
                  <option value="En cours">En cours</option>
                  <option value="En retard">En retard</option>
                  <option value="En pause">En pause</option>
                  <option value="Terminé">Terminé</option>
                </select>
              </div>
            </motion.div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AnimatePresence>
                {filteredProjects.map((project) => {
                const budgetPercent = project.spent / project.budget * 100;
                const budgetColor =
                budgetPercent > 95 ?
                'bg-red-500' :
                budgetPercent > 80 ?
                'bg-orange-500' :
                'bg-green-500';
                return (
                  <motion.div
                    key={project.id}
                    layout
                    initial={{
                      opacity: 0,
                      scale: 0.95
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.95
                    }}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-gray-400">
                              {project.id}
                            </span>
                            <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${project.statusColor}`}>
                            
                              {project.status}
                            </span>
                          </div>
                          <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                            {project.name}
                          </h3>
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <MapPinIcon className="w-3.5 h-3.5" />{' '}
                            {project.location}
                          </p>
                        </div>
                        <CircularProgress percentage={project.progress} />
                      </div>

                      <div className="space-y-4 mb-5">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">
                              Budget consommé
                            </span>
                            <span className="font-semibold text-gray-700">
                              {formatCurrency(project.spent)} /{' '}
                              {formatCurrency(project.budget)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                            className={`h-2 rounded-full ${budgetColor}`}
                            style={{
                              width: `${Math.min(budgetPercent, 100)}%`
                            }}>
                          </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg">
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
                              Client
                            </p>
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {project.client}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
                              Dates
                            </p>
                            <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />{' '}
                              {project.startDate} - {project.endDate}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex -space-x-2">
                          {project.team.map((initials, i) =>
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full bg-globus-blue text-white flex items-center justify-center text-xs font-bold border-2 border-white">
                          
                              {initials}
                            </div>
                        )}
                        </div>
                        <div className="flex gap-2">
                          <button
                          onClick={() =>
                          setIncidentModal({
                            isOpen: true,
                            project
                          })
                          }
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Signaler un problème">
                          
                            <AlertTriangleIcon className="w-4 h-4" />
                          </button>
                          <button
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setActiveTab('detail');
                          }}
                          className="flex items-center gap-1 text-sm font-semibold text-globus-blue hover:text-globus-orange transition-colors">

                            Détails <ChevronRightIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>);

              })}
              </AnimatePresence>
            </div>
          </motion.div>
        }

        {activeTab === 'detail' &&
        <motion.div
          key="detail"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            {/* Project Header */}
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                      {selectedProject.name}
                    </h2>
                    <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${selectedProject.statusColor}`}>
                    
                      {selectedProject.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="w-4 h-4" />{' '}
                      {selectedProject.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <UsersIcon className="w-4 h-4" /> Client:{' '}
                      {selectedProject.client}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />{' '}
                      {selectedProject.startDate} au {selectedProject.endDate}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">
                      Avancement Global
                    </p>
                    <p className="font-montserrat font-bold text-2xl text-globus-blue">
                      {selectedProject.progress}%
                    </p>
                  </div>
                  <CircularProgress percentage={selectedProject.progress} />
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Timeline */}
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-5 flex items-center gap-2">
                  <ClockIcon className="w-5 h-5 text-gray-400" /> Planning &
                  Jalons
                </h3>
                <div className="relative border-l-2 border-gray-100 ml-3 space-y-6">
                  {timeline.length === 0 &&
                <p className="text-sm text-gray-400 italic pl-6">Aucun jalon défini pour ce chantier.</p>
                }
                  {timeline.map((step: any, idx: number) =>
                <div key={idx} className="relative pl-6">
                      <div
                    className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 bg-white ${step.status === 'done' ? 'border-green-500' : step.status === 'current' ? 'border-blue-500' : 'border-gray-300'}`}>
                    
                        {step.status === 'done' &&
                    <CheckCircle2Icon className="w-full h-full text-green-500 scale-110 -ml-[2px] -mt-[2px]" />
                    }
                        {step.status === 'current' &&
                    <div className="w-2 h-2 bg-blue-500 rounded-full m-auto mt-[2px]"></div>
                    }
                      </div>
                      <p
                    className={`font-semibold text-sm ${step.status === 'upcoming' ? 'text-gray-500' : 'text-gray-800'}`}>
                    
                        {step.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {step.date}
                      </p>
                    </div>
                )}
                </div>
              </motion.div>

              {/* Budget, Weather & Client Visibility */}
              <div className="lg:col-span-2 space-y-6">
                {/* NEW: Visibilité Portail Client */}
                <motion.div
                variants={fadeUp}
                className="bg-gradient-to-r from-globus-blue-dark to-globus-blue rounded-xl shadow-sm border border-gray-200 p-5 text-white">
                
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-montserrat font-bold text-base flex items-center gap-2">
                      <SearchIcon className="w-5 h-5 text-globus-orange" />{' '}
                      Visibilité Portail Client
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                      <div className="flex items-center gap-2 mb-1">
                        <CameraIcon className="w-4 h-4 text-blue-200" />
                        <p className="text-xs text-blue-100 uppercase font-bold">
                          Galerie Photos
                        </p>
                      </div>
                      <p className="font-montserrat font-bold text-xl">
                        {liveGallery.length}{' '}
                        <span className="text-sm font-normal text-blue-200">
                          partagées
                        </span>
                      </p>
                    </div>

                    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                        <p className="text-xs text-blue-100 uppercase font-bold">
                          Caméra Live
                        </p>
                      </div>
                      <p className="font-montserrat font-bold text-xl text-blue-200">
                        Non configurée
                      </p>
                    </div>

                    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                      <div className="flex items-center gap-2 mb-1">
                        <BoxIcon className="w-4 h-4 text-blue-200" />
                        <p className="text-xs text-blue-100 uppercase font-bold">
                          Modèle 3D BIM
                        </p>
                      </div>
                      <p className="font-montserrat font-bold text-xl text-blue-200">
                        Non disponible
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                variants={fadeUp}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                
                  <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-5 flex items-center gap-2">
                    <WalletIcon className="w-5 h-5 text-gray-400" /> Suivi
                    Budgétaire
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                          <th className="pb-3 font-semibold">Catégorie</th>
                          <th className="pb-3 font-semibold text-right">
                            Prévu
                          </th>
                          <th className="pb-3 font-semibold text-right">
                            Engagé
                          </th>
                          <th className="pb-3 font-semibold text-right">
                            Reste
                          </th>
                          <th className="pb-3 font-semibold text-right">%</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {(() => {
                        const prevu = selectedProject?.budget || 0;
                        const engage = selectedProject?.spent || 0;
                        const reste = prevu - engage;
                        const pct = prevu > 0 ? Math.round((engage / prevu) * 100) : 0;
                        if (prevu === 0 && engage === 0) {
                          return (
                            <tr>
                                <td colSpan={5} className="py-6 text-center text-gray-400 italic">
                                  Aucune donnée budgétaire disponible pour ce chantier
                                </td>
                              </tr>);

                        }
                        return (
                          <tr className="bg-gray-50">
                              <td className="py-3 px-2 font-bold text-gray-800">
                                Budget global
                              </td>
                              <td className="py-3 text-right font-bold text-gray-800">
                                {formatCurrency(prevu)}
                              </td>
                              <td className="py-3 text-right font-bold text-globus-blue">
                                {formatCurrency(engage)}
                              </td>
                              <td className={`py-3 text-right font-bold ${reste < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                {formatCurrency(reste)}
                              </td>
                              <td className={`py-3 text-right font-bold ${pct > 100 ? 'text-red-500' : ''}`}>
                                {pct}%
                              </td>
                            </tr>);

                      })()}
                      </tbody>
                    </table>
                  </div>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <motion.div
                  variants={fadeUp}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  
                    <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4 flex items-center gap-2">
                      <CloudSunIcon className="w-5 h-5 text-gray-400" /> Météo
                      Chantier
                    </h3>
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">
                          {selectedProject.location || 'Localisation non définie'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Données météo non disponibles pour le moment.
                        </p>
                      </div>
                      <CloudSunIcon className="w-10 h-10 text-gray-300 ml-auto" />
                    </div>
                  </motion.div>

                  <motion.div
                  variants={fadeUp}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  
                    <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-4 flex items-center gap-2">
                      <CameraIcon className="w-5 h-5 text-gray-400" /> Galerie
                      Récente
                    </h3>
                    {liveGallery.length === 0 ?
                  <p className="text-sm text-gray-400 italic py-4">
                        Aucune photo partagée pour ce chantier.
                      </p> :

                  <div className="grid grid-cols-2 gap-2">
                        {liveGallery.slice(0, 6).map((photo, i) =>
                    <div
                      key={i}
                      className="aspect-video bg-gray-200 rounded-lg overflow-hidden relative group cursor-pointer">

                            <img
                        src={photo.url}
                        alt={photo.caption || 'Chantier'}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform" />

                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <SearchIcon className="text-white w-5 h-5" />
                            </div>
                          </div>
                    )}
                      </div>
                  }
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        }

        {activeTab === 'team' &&
        <motion.div
          key="team"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Team Table */}
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-montserrat font-bold text-base text-globus-blue-dark flex items-center gap-2">
                    <UsersIcon className="w-5 h-5 text-gray-400" /> Équipe
                    Assignée
                  </h3>
                  <button
                  onClick={() => setAssignTeamModal(true)}
                  className="text-sm text-globus-blue font-semibold hover:underline flex items-center gap-1">
                  
                    <PlusIcon className="w-4 h-4" /> Assigner
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                        <th className="pb-3 font-semibold">Nom</th>
                        <th className="pb-3 font-semibold">Rôle</th>
                        <th className="pb-3 font-semibold">Projet</th>
                        <th className="pb-3 font-semibold text-center">
                          Heures/Sem
                        </th>
                        <th className="pb-3 font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {teamAssignments.length === 0 &&
                        <tr><td colSpan={5} className="py-8 text-center text-globus-gray">
                          Aucun membre assigné
                        </td></tr>
                      }
                      {teamAssignments.map((member, idx) =>
                    <tr
                      key={idx}
                      className="border-b border-gray-100 hover:bg-gray-50">

                          <td className="py-3 font-medium text-gray-800">
                            {member.name}
                          </td>
                          <td className="py-3 text-gray-600">{member.role}</td>
                          <td className="py-3 text-gray-600">
                            {member.project}
                          </td>
                          <td className="py-3 text-center font-semibold">
                            {member.hours}h
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <span
                            className={`px-2 py-1 rounded-full text-[10px] font-bold ${member.status === 'Sur site' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>

                                {member.status}
                              </span>
                              <button
                                onClick={async () => {
                                  try {
                                    await deleteAssignmentMutation.mutateAsync(member.id);
                                    showToast('Membre retiré');
                                  } catch { showToast('Échec du retrait', 'info'); }
                                }}
                                title="Retirer"
                                className="text-gray-300 hover:text-red-500 transition-colors">
                                <XIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                    )}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* Resource Chart */}
              <motion.div
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-5 flex items-center gap-2">
                  <BarChart3Icon className="w-5 h-5 text-gray-400" />{' '}
                  Répartition Main d'Œuvre
                </h3>
                <div className="h-64">
                  {!resourceHasData ? (
                    <ChartEmpty message="Aucune ressource allouée sur les chantiers actifs" />
                  ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                    data={resourceData}
                    layout="vertical"
                    margin={{
                      top: 0,
                      right: 0,
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
                      allowDecimals={false}
                      tick={{
                        fontSize: 11,
                        fill: '#6b7280'
                      }}
                      axisLine={false}
                      tickLine={false} />

                      <YAxis
                      type="category"
                      dataKey="name"
                      tick={{
                        fontSize: 11,
                        fill: '#374151'
                      }}
                      axisLine={false}
                      tickLine={false}
                      width={100} />

                      <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '12px'
                      }} />

                      <Legend
                      wrapperStyle={{
                        fontSize: '11px',
                        paddingTop: '10px'
                      }} />

                      <Bar
                      dataKey="Ouvriers"
                      stackId="a"
                      fill="#3B82F6"
                      barSize={20} />

                      <Bar
                      dataKey="Équipements"
                      stackId="a"
                      fill="#F97316"
                      radius={[0, 4, 4, 0]} />

                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </motion.div>

              {/* Equipment & Material Summary */}
              <motion.div
              variants={fadeUp}
              className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
              
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                    <TruckIcon className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-montserrat font-bold text-gray-800">
                      Matériel Roulant & Lourd
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {equipmentList.length} engin{equipmentList.length > 1 ? 's' : ''} au parc · {equipmentInMaintenance} en maintenance.
                    </p>
                    <button
                    onClick={() =>
                    showToast(
                      'Redirection vers le module Parc Matériel...',
                      'info'
                    )
                    }
                    className="mt-3 text-sm text-globus-blue font-semibold hover:underline">
                    
                      Voir le parc matériel
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                    <BoxIcon className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-montserrat font-bold text-gray-800">
                      Stocks Matériaux
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {lowStockCount} alerte{lowStockCount > 1 ? 's' : ''} de stock bas sur {stockList.length} article{stockList.length > 1 ? 's' : ''}.
                    </p>
                    <button
                    onClick={() =>
                    showToast(
                      'Redirection vers le module Achats & Stocks...',
                      'info'
                    )
                    }
                    className="mt-3 text-sm text-globus-blue font-semibold hover:underline">
                    
                      Voir les stocks
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* MODALS */}

      {/* New Project Modal */}
      <AnimatePresence>
        {newProjectModal &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark flex items-center gap-2">
                  <HardHatIcon className="w-5 h-5 text-globus-orange" /> Nouveau
                  Chantier
                </h3>
                <button
                onClick={() => setNewProjectModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleNewProject} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Nom du projet
                    </label>
                    <input
                    name="name"
                    type="text"
                    required
                    placeholder="Ex: Construction Villa R+1"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Client
                    </label>
                    <input
                    name="client"
                    type="text"
                    required
                    placeholder="Nom du client"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Localisation
                    </label>
                    <input
                    name="location"
                    type="text"
                    required
                    placeholder="Ex: Douala, Bonapriso"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Budget Alloué (FCFA)
                    </label>
                    <input
                    name="budget"
                    type="number"
                    required
                    min="1000000"
                    placeholder="Ex: 50000000"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Date de début
                    </label>
                    <input
                    name="startDate"
                    type="date"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Date de fin prévue
                    </label>
                    <input
                    name="endDate"
                    type="date"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                  
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                  <button
                  type="button"
                  onClick={() => setNewProjectModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'new-project'}
                  className="bg-globus-blue hover:bg-globus-blue/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'new-project' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }
                    Créer Chantier
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Incident Modal */}
      <AnimatePresence>
        {incidentModal.isOpen && incidentModal.project &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50">
                <h3 className="font-montserrat font-bold text-lg text-red-700 flex items-center gap-2">
                  <AlertTriangleIcon className="w-5 h-5" /> Signaler un Incident
                </h3>
                <button
                onClick={() =>
                setIncidentModal({
                  isOpen: false,
                  project: null
                })
                }
                className="text-red-400 hover:text-red-600 bg-white rounded-full p-1 shadow-sm">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleReportIncident} className="p-6 space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 text-center">
                  <p className="font-mono text-xs font-bold text-globus-blue mb-1">
                    {incidentModal.project.id}
                  </p>
                  <p className="font-bold text-sm text-gray-800">
                    {incidentModal.project.name}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Type d'incident
                  </label>
                  <select
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none">
                  
                    <option value="">Sélectionner...</option>
                    <option value="Securite">Accident / Sécurité</option>
                    <option value="Materiel">Panne Matériel</option>
                    <option value="Approvisionnement">Rupture de stock</option>
                    <option value="Qualite">Défaut de qualité</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Description
                  </label>
                  <textarea
                  required
                  rows={4}
                  placeholder="Décrivez l'incident en détail..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none resize-none">
                </textarea>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Gravité
                  </label>
                  <select
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none">
                  
                    <option value="Faible">
                      Faible (Bloque partiellement)
                    </option>
                    <option value="Moyenne">Moyenne (Retard prévisible)</option>
                    <option value="Critique">
                      Critique (Arrêt de chantier)
                    </option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                  <button
                  type="button"
                  onClick={() =>
                  setIncidentModal({
                    isOpen: false,
                    project: null
                  })
                  }
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'incident'}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'incident' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <AlertTriangleIcon className="w-4 h-4" />
                  }
                    Signaler
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Assign Team Modal */}
      <AnimatePresence>
        {assignTeamModal &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark flex items-center gap-2">
                  <UsersIcon className="w-5 h-5 text-globus-orange" /> Assigner
                  un membre
                </h3>
                <button
                onClick={() => setAssignTeamModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAssignTeam} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Nom de l'employé
                  </label>
                  <input
                  name="name"
                  type="text"
                  required
                  placeholder="Ex: Jean Dupont"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Rôle
                  </label>
                  <select
                  name="role"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">
                  
                    <option value="Chef de Projet">Chef de Projet</option>
                    <option value="Chef Chantier">Chef Chantier</option>
                    <option value="Architecte">Architecte</option>
                    <option value="Ingénieur">Ingénieur</option>
                    <option value="Maçon">Maçon</option>
                    <option value="Électricien">Électricien</option>
                    <option value="Plombier">Plombier</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Chantier
                  </label>
                  <select
                  name="project"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">
                  
                    {projects.map((p) =>
                  <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                  )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Heures par semaine
                  </label>
                  <input
                  name="hours"
                  type="number"
                  required
                  min="1"
                  max="60"
                  defaultValue="40"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                  <button
                  type="button"
                  onClick={() => setAssignTeamModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'assign'}
                  className="bg-globus-blue hover:bg-globus-blue/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'assign' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <CheckCircle2Icon className="w-4 h-4" />
                  }
                    Assigner
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Global Toast */}
      <AnimatePresence>
        {toast.active &&
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
            scale: 0.9,
            transition: {
              duration: 0.2
            }
          }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl">
          
            {toast.type === 'success' ?
          <CheckCircle2Icon className="w-5 h-5 text-green-400" /> :

          <InfoIcon className="w-5 h-5 text-blue-400" />
          }
            <span className="font-opensans text-sm font-medium">
              {toast.message}
            </span>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}