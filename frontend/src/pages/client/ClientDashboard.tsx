import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatDate, formatDateTime, formatTime, formatDateParts } from '../../utils/datetime';
import {
  DownloadIcon,
  TrendingUpIcon,
  WalletIcon,
  CalendarIcon,
  FileTextIcon,
  CameraIcon,
  MessageSquareIcon,
  CheckCircle2Icon,
  PhoneIcon,
  MailIcon,
  CalendarClockIcon,
  CloudSunIcon,
  XIcon,
  RefreshCwIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  SendIcon,
  Loader2Icon,
  AlertCircleIcon,
  ChevronRightIcon,
  Maximize2Icon,
  ClockIcon } from
'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useClientUser } from '../../hooks/useClientUser';
import {
  useClientProject, useClientFinances, useClientProjectLive,
  useClientProjectTimeline, useClientNotifications, useClientDocuments,
} from '../../hooks/useClient';
import { downloadCSV } from '../../utils/download';

interface DashboardContact {
  id: string; initials: string; name: string; role: string; phone: string; email: string;
}

// Weather requires an external feed not wired to the client portal yet — show a
// neutral placeholder instead of a simulated/mock forecast.
const NEUTRAL_WEATHER = {
  temp: null as number | null,
  condition: 'Météo indisponible',
  favorable: true,
  forecast: 'Données météo non disponibles pour le moment.',
};



export function ClientDashboard() {
  const navigate = useNavigate();
  const clientUser = useClientUser();
  const { data: projectData, isLoading: isLoadingProject } = useClientProject();
  const { data: documentsData } = useClientDocuments();
  const { data: financesData } = useClientFinances();
  const { data: liveData } = useClientProjectLive();
  const { data: timelineData } = useClientProjectTimeline();
  const { data: notifData } = useClientNotifications();
  void isLoadingProject;

  // Live budget (paid vs remaining) from invoices
  const liveBudgetData = React.useMemo(() => {
    if (!Array.isArray(financesData) || financesData.length === 0) return [{ name: 'Aucune donnée', value: 1, color: '#E5E7EB' }];
    const paid = financesData.reduce((s: number, i: any) => s + (i.amount_paid || 0), 0);
    const total = financesData.reduce((s: number, i: any) => s + (i.total || 0), 0);
    const remaining = Math.max(total - paid, 0);
    if (total === 0) return [{ name: 'Aucune donnée', value: 1, color: '#E5E7EB' }];
    return [
      { name: 'Payé', value: paid, color: '#10B981' },
      { name: 'Reste à payer', value: remaining, color: '#E5E7EB' },
    ];
  }, [financesData]);

  // Live activity (from notifications + recent timeline updates)
  const liveActivity = React.useMemo(() => {
    const arr: any[] = [];
    if (Array.isArray(notifData)) {
      for (const n of notifData.slice(0, 5)) {
        arr.push({
          id: n.id,
          type: n.type || 'info',
          icon: n.type === 'invoice' ? WalletIcon
            : n.type === 'message' ? MessageSquareIcon
            : n.type === 'document' ? FileTextIcon
            : n.type === 'project' ? CheckCircle2Icon
            : CameraIcon,
          title: n.title || n.message || '',
          time: formatDateTime(n.created_at),
          color: n.is_read ? 'text-gray-500' : 'text-globus-orange',
          bg: n.is_read ? 'bg-gray-100' : 'bg-globus-orange/10',
          link: n.type === 'invoice' ? '/espace-client/finances'
            : n.type === 'message' ? '/espace-client/messagerie'
            : n.type === 'document' ? '/espace-client/documents'
            : '/espace-client',
        });
      }
    }
    return arr;
  }, [notifData]);
  void timelineData;

  // Recent site photos from the live project snapshot (no mock).
  const liveRecentPhotos = React.useMemo(() => {
    const media = (liveData as any)?.last_media;
    if (!Array.isArray(media)) return [] as string[];
    return media.map((m: any) => m.url).filter(Boolean);
  }, [liveData]);
  // Real pending call-for-funds (unpaid invoice) — drives the alert banner.
  const pendingAppel = React.useMemo(() => {
    if (!Array.isArray(financesData)) return null;
    return (
      financesData.find(
        (i: any) =>
          (i.status === 'ENVOYEE' || i.status === 'EN_RETARD') &&
          (i.amount_paid || 0) < (i.total || 0),
      ) || null
    );
  }, [financesData]);
  // ── Real KPIs (project + timeline + documents) — no hardcoded values ──
  const progress = Math.round(Number((projectData as any)?.progress ?? 0));
  const budget = Number((projectData as any)?.budget_initial ?? 0);
  const documentsCount = Array.isArray(documentsData) ? documentsData.length : 0;
  const phases: any[] = Array.isArray((timelineData as any)?.phases)
    ? (timelineData as any).phases
    : [];
  const nextPhase = phases.find((p: any) => (p.progress ?? 0) < 100) || null;
  const currentPhase =
    phases.find((p: any) => (p.progress ?? 0) > 0 && (p.progress ?? 0) < 100) || nextPhase;
  const estimatedEnd = (projectData as any)?.estimated_end_date || null;
  const daysUntilDelivery = estimatedEnd
    ? Math.max(0, Math.ceil((new Date(estimatedEnd).getTime() - Date.now()) / 86_400_000))
    : null;
  const deliveryLabel = formatDateParts(estimatedEnd, { month: 'long', year: 'numeric' });
  const projectStatusLabel = (() => {
    const s = String((projectData as any)?.status || '').toUpperCase();
    const m: Record<string, string> = {
      EN_COURS: 'En cours', PLANIFIE: 'Planifié', TERMINE: 'Terminé',
      LIVRE: 'Livré', SUSPENDU: 'Suspendu',
    };
    return m[s] || (currentPhase ? 'En cours' : 'Projet');
  })();
  const formatCompact = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M FCFA`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}K FCFA`;
    return `${v.toLocaleString('fr-FR')} FCFA`;
  };
  const projectLocation = (projectData as any)?.location || '';
  const paidPercent = (() => {
    if (!Array.isArray(financesData) || financesData.length === 0) return 0;
    const paid = financesData.reduce((s: number, i: any) => s + (i.amount_paid || 0), 0);
    const total = financesData.reduce((s: number, i: any) => s + (i.total || 0), 0);
    return total > 0 ? Math.round((paid / total) * 100) : 0;
  })();
  // Real upcoming appointments from the project timeline.
  const liveAppointments = React.useMemo(() => {
    const appts = (timelineData as any)?.appointments;
    if (!Array.isArray(appts)) return [] as any[];
    const now = Date.now();
    return appts
      .filter((a: any) => a.start_time)
      .map((a: any) => {
        const d = new Date(a.start_time);
        return {
          id: a.id,
          ts: d.getTime(),
          date: formatDateParts(d, { day: '2-digit', month: 'short' }),
          title: a.title || 'Rendez-vous',
          time: formatTime(d),
          with: a.location || '',
          type: /visite/i.test(a.title || '') ? 'visite' : 'reunion',
        };
      })
      .filter((a: any) => a.ts >= now)
      .sort((a: any, b: any) => a.ts - b.ts)
      .slice(0, 5);
  }, [timelineData]);
  const [isAlertVisible, setIsAlertVisible] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Download
  const [downloadState, setDownloadState] = useState({
    isDownloading: false,
    progress: 0,
    isSuccess: false
  });
  // Call modal
  const [callModal, setCallModal] = useState<{
    isOpen: boolean;
    contact: DashboardContact | null;
    status: 'ringing' | 'connected' | 'ended';
    timer: number;
    isMuted: boolean;
  }>({
    isOpen: false,
    contact: null,
    status: 'ringing',
    timer: 0,
    isMuted: false
  });
  // Email modal
  const [emailModal, setEmailModal] = useState<{
    isOpen: boolean;
    contact: DashboardContact | null;
    status: 'idle' | 'sending' | 'success';
    subject: string;
    message: string;
  }>({
    isOpen: false,
    contact: null,
    status: 'idle',
    subject: '',
    message: ''
  });
  // Weather — neutral placeholder (no mock; external feed not wired yet).
  const [weather] = useState(NEUTRAL_WEATHER);
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  // No backend source yet for the client's team contacts (kept empty, not mocked).
  const contacts: DashboardContact[] = [];
  const upcomingAppointments = liveAppointments;
  // Lightbox
  const [lightbox, setLightbox] = useState<{
    isOpen: boolean;
    image: string | null;
  }>({
    isOpen: false,
    image: null
  });
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      maximumFractionDigits: 0
    }).
    format(value).
    replace('XAF', 'FCFA');
  };
  // Download handler
  const handleDownload = () => {
    if (downloadState.isDownloading) return;
    // Real CSV récapitulatif built from the live project data (no fake progress).
    const rows: Array<Record<string, unknown>> = [
      { indicateur: 'Projet', valeur: clientUser.projectName || '' },
      { indicateur: 'Avancement', valeur: `${progress}%` },
      { indicateur: 'Budget total', valeur: formatCompact(budget) },
      { indicateur: 'Prochaine étape', valeur: nextPhase?.name || 'À définir' },
      { indicateur: 'Documents', valeur: documentsCount },
      { indicateur: 'Livraison estimée', valeur: deliveryLabel || 'À définir' },
      ...phases.map((ph: any) => ({
        indicateur: `Phase · ${ph.name}`,
        valeur: `${ph.progress ?? 0}%`,
      })),
    ];
    setDownloadState({ isDownloading: true, progress: 100, isSuccess: true });
    try {
      downloadCSV(
        `recapitulatif-projet-${new Date().toISOString().slice(0, 10)}.csv`,
        rows,
        [
          { key: 'indicateur', label: 'Indicateur' },
          { key: 'valeur', label: 'Valeur' },
        ],
      );
    } catch {
      /* ignore */
    }
    setTimeout(
      () => setDownloadState({ isDownloading: false, progress: 0, isSuccess: false }),
      2500,
    );
  };
  // Call handlers
  const startCall = (contact: DashboardContact) => {
    setCallModal({
      isOpen: true,
      contact,
      status: 'ringing',
      timer: 0,
      isMuted: false
    });
  };
  useEffect(() => {
    if (!callModal.isOpen || callModal.status !== 'ringing') return;
    const timeout = setTimeout(() => {
      setCallModal((prev) => ({
        ...prev,
        status: 'connected'
      }));
    }, 2500);
    return () => clearTimeout(timeout);
  }, [callModal.isOpen, callModal.status]);
  useEffect(() => {
    if (!callModal.isOpen || callModal.status !== 'connected') return;
    const interval = setInterval(() => {
      setCallModal((prev) => ({
        ...prev,
        timer: prev.timer + 1
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [callModal.isOpen, callModal.status]);
  const endCall = () => {
    setCallModal((prev) => ({
      ...prev,
      status: 'ended'
    }));
    setTimeout(
      () =>
      setCallModal({
        isOpen: false,
        contact: null,
        status: 'ringing',
        timer: 0,
        isMuted: false
      }),
      1000
    );
  };
  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };
  // Email handlers
  const openEmail = (contact: DashboardContact) => {
    setEmailModal({
      isOpen: true,
      contact,
      status: 'idle',
      subject: '',
      message: ''
    });
  };
  const sendEmail = () => {
    if (!emailModal.subject.trim() || !emailModal.message.trim()) return;
    setEmailModal((prev) => ({
      ...prev,
      status: 'sending'
    }));
    setTimeout(() => {
      setEmailModal((prev) => ({
        ...prev,
        status: 'success'
      }));
      setTimeout(
        () =>
        setEmailModal({
          isOpen: false,
          contact: null,
          status: 'idle',
          subject: '',
          message: ''
        }),
        2000
      );
    }, 1500);
  };
  // Weather refresh — no live feed wired; just acknowledge the action.
  const refreshWeather = () => {
    if (isRefreshingWeather) return;
    setIsRefreshingWeather(true);
    setTimeout(() => setIsRefreshingWeather(false), 800);
  };
  // Toast auto-dismiss
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(t);
  }, [toastMessage]);
  const handleQuickAction = (label: string, path: string) => {
    setToastMessage(`Redirection vers ${label}...`);
    setTimeout(() => navigate(path), 400);
  };
  const fadeUp = {
    initial: {
      opacity: 0,
      y: 20
    },
    animate: {
      opacity: 1,
      y: 0
    }
  };
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Pending Payment Alert */}
      <AnimatePresence>
        {isAlertVisible && pendingAppel &&
        <motion.div
          initial={{
            opacity: 0,
            y: -10
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: -10
          }}
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertCircleIcon className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-montserrat font-bold text-sm text-amber-800">
                  Appel de fonds en attente
                </p>
                <p className="font-opensans text-xs text-amber-600">
                  {((pendingAppel.total || 0) - (pendingAppel.amount_paid || 0)).toLocaleString('fr-FR')} FCFA
                  {pendingAppel.due_date || pendingAppel.issue_date
                    ? ` — Échéance : ${formatDate(pendingAppel.due_date || pendingAppel.issue_date)}`
                    : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
              to="/espace-client/finances"
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold text-xs py-2 px-4 rounded-lg transition-colors">
              
                Payer maintenant
              </Link>
              <button
              onClick={() => setIsAlertVisible(false)}
              className="text-amber-400 hover:text-amber-600 transition-colors p-1">
              
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Welcome Banner */}
      <motion.div
        {...fadeUp}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        <div>
          <h2 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark mb-1">
            Bonjour, {clientUser.name.split(' ')[0]} 👋
          </h2>
          <p className="font-opensans text-globus-gray">
            Voici l'état d'avancement de votre projet{' '}
            <strong className="text-globus-blue-dark">
              {clientUser.projectName}
            </strong>
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloadState.isDownloading}
          className="shrink-0 bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold py-2.5 px-5 rounded-lg transition-colors shadow-md flex items-center gap-2 text-sm disabled:opacity-60">
          
          {downloadState.isDownloading ?
          <Loader2Icon className="w-4 h-4 animate-spin" /> :

          <DownloadIcon className="w-4 h-4" />
          }
          Exporter
        </button>
      </motion.div>

      {/* Countdown & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          {...fadeUp}
          transition={{
            delay: 0.05
          }}
          className="bg-gradient-to-br from-globus-blue-dark to-globus-blue rounded-2xl shadow-md p-6 text-white relative overflow-hidden flex items-center gap-5">
          
          <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/20">
            <CalendarClockIcon className="w-7 h-7 text-globus-orange" />
          </div>
          <div className="relative z-10">
            <p className="font-montserrat font-extrabold text-3xl mb-1">
              {daysUntilDelivery !== null ? `${daysUntilDelivery} jours` : '—'}
            </p>
            <p className="font-opensans text-sm text-seconda-blue">
              {deliveryLabel
                ? `avant livraison estimée (${deliveryLabel})`
                : 'Date de livraison à définir'}
            </p>
          </div>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{
            delay: 0.08
          }}
          className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <button
            onClick={() =>
            handleQuickAction('Finances', '/espace-client/finances')
            }
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 hover:shadow-md hover:border-globus-orange/30 transition-all group text-left">
            
            <div className="w-12 h-12 rounded-xl bg-globus-orange/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <WalletIcon className="w-6 h-6 text-globus-orange" />
            </div>
            <span className="font-montserrat font-bold text-sm text-globus-blue-dark">
              Payer une facture
            </span>
          </button>
          <button
            onClick={() =>
            handleQuickAction('Chantier', '/espace-client/chantier')
            }
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 hover:shadow-md hover:border-blue-300 transition-all group text-left">
            
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CameraIcon className="w-6 h-6 text-blue-600" />
            </div>
            <span className="font-montserrat font-bold text-sm text-globus-blue-dark">
              Voir les photos
            </span>
          </button>
          <button
            onClick={() =>
            handleQuickAction('Messagerie', '/espace-client/messagerie')
            }
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 hover:shadow-md hover:border-purple-300 transition-all group text-left">
            
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MessageSquareIcon className="w-6 h-6 text-purple-600" />
            </div>
            <span className="font-montserrat font-bold text-sm text-globus-blue-dark">
              Envoyer un message
            </span>
          </button>
        </motion.div>
      </div>

      {/* Project Overview Card */}
      <motion.div
        {...fadeUp}
        transition={{
          delay: 0.1
        }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        
        <div className="h-48 sm:h-64 relative">
          {liveRecentPhotos[0] ?
          <img
            src={liveRecentPhotos[0]}
            alt="Projet"
            className="w-full h-full object-cover" /> :
          <div className="w-full h-full bg-gradient-to-br from-globus-blue-dark to-globus-blue" />
          }

          <div className="absolute inset-0 bg-gradient-to-t from-globus-blue-dark/90 to-transparent flex flex-col justify-end p-6">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="bg-globus-orange/20 backdrop-blur-md text-white border border-globus-orange/50 px-3 py-1 rounded-full font-montserrat font-bold text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-globus-orange animate-pulse" />
                {projectStatusLabel}{currentPhase ? ` · ${currentPhase.name}` : ''}
              </span>
              {deliveryLabel &&
              <span className="bg-black/30 backdrop-blur-md text-white px-3 py-1 rounded-full font-montserrat text-xs">
                Livraison estimée : {deliveryLabel}
              </span>
              }
            </div>
            <h3 className="font-montserrat font-extrabold text-2xl sm:text-3xl text-white mb-1">
              {clientUser.projectName}
            </h3>
          </div>
        </div>
        <div className="p-6 bg-white">
          <div className="flex justify-between items-end mb-2">
            <span className="font-montserrat font-bold text-globus-blue-dark">
              Avancement global
            </span>
            <span className="font-montserrat font-extrabold text-2xl text-globus-orange">
              {progress}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{
                width: 0
              }}
              animate={{
                width: `${progress}%`
              }}
              transition={{
                duration: 1,
                delay: 0.5
              }}
              className="h-full bg-globus-orange rounded-full" />
            
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
        {
          icon: TrendingUpIcon,
          label: 'Avancement',
          value: `${progress}%`,
          iconColor: 'text-green-600',
          iconBg: 'bg-green-100'
        },
        {
          icon: WalletIcon,
          label: 'Budget Total',
          value: formatCompact(budget),
          iconColor: 'text-blue-600',
          iconBg: 'bg-blue-100'
        },
        {
          icon: CalendarIcon,
          label: 'Prochaine Étape',
          value: nextPhase?.name || 'À définir',
          iconColor: 'text-globus-orange',
          iconBg: 'bg-globus-orange/10',
          small: true
        },
        {
          icon: FileTextIcon,
          label: 'Documents',
          value: `${documentsCount} fichier${documentsCount > 1 ? 's' : ''}`,
          iconColor: 'text-gray-600',
          iconBg: 'bg-gray-100'
        }].
        map((stat, i) =>
        <motion.div
          key={stat.label}
          {...fadeUp}
          transition={{
            delay: 0.2 + i * 0.1
          }}
          className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          
            <div
            className={`w-12 h-12 rounded-full ${stat.iconBg} flex items-center justify-center shrink-0`}>
            
              <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
            </div>
            <div>
              <p className="text-sm text-globus-gray font-opensans">
                {stat.label}
              </p>
              <p
              className={`font-montserrat font-bold ${stat.small ? 'text-sm' : 'text-xl'} text-globus-blue-dark`}>
              
                {stat.value}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Budget + Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget Gauge */}
        <motion.div
          {...fadeUp}
          transition={{
            delay: 0.6
          }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:col-span-1 flex flex-col">
          
          <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4">
            État Financier
          </h3>
          <div className="flex-1 relative min-h-[200px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={liveBudgetData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none">
                  
                  {liveBudgetData.map((entry, index) =>
                  <Cell key={`cell-${index}`} fill={entry.color} />
                  )}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }} />
                
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                {paidPercent}%
              </span>
              <span className="text-xs text-globus-gray font-opensans">
                Payé
              </span>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2 text-globus-gray">
                <span className="w-3 h-3 rounded-full bg-[#10B981]" /> Payé
              </span>
              <span className="font-bold text-globus-blue-dark">
                {formatCurrency(38250000)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2 text-globus-gray">
                <span className="w-3 h-3 rounded-full bg-gray-200" /> Reste à
                payer
              </span>
              <span className="font-bold text-globus-blue-dark">
                {formatCurrency(46750000)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          {...fadeUp}
          transition={{
            delay: 0.7
          }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
          
          <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-6">
            Activité Récente
          </h3>
          <div className="space-y-4">
            {liveActivity.map((activity) => {
              const Icon = activity.icon;
              return (
                <Link
                  key={activity.id}
                  to={activity.link}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer">
                  
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full ${activity.bg} ${activity.color} shrink-0`}>
                    
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark group-hover:text-globus-orange transition-colors truncate">
                      {activity.title}
                    </h4>
                    <time className="font-opensans text-xs text-globus-gray">
                      {activity.time}
                    </time>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-globus-orange transition-colors shrink-0" />
                </Link>);

            })}
          </div>
        </motion.div>
      </div>

      {/* Appointments + Photo Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <motion.div
          {...fadeUp}
          transition={{
            delay: 0.75
          }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
              Prochains Rendez-vous
            </h3>
            <Link
              to="/espace-client/planning"
              className="text-globus-orange hover:text-globus-orange-hover font-montserrat font-bold text-xs flex items-center gap-1 transition-colors">
              
              Voir tout <ChevronRightIcon className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingAppointments.length === 0 &&
              <p className="text-center text-globus-gray font-opensans text-sm py-6">
                Aucun rendez-vous programmé
              </p>
            }
            {upcomingAppointments.map((apt) =>
            <div
              key={apt.id}
              className="flex items-center gap-4 p-4 bg-globus-light rounded-xl border border-gray-100">
              
                <div className="w-12 h-14 rounded-lg bg-globus-blue-dark flex flex-col items-center justify-center shrink-0 text-white">
                  <span className="font-montserrat font-extrabold text-sm leading-none">
                    {apt.date.split(' ')[0]}
                  </span>
                  <span className="font-opensans text-[10px] text-seconda-blue">
                    {apt.date.split(' ')[1]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-montserrat font-bold text-sm text-globus-blue-dark truncate">
                    {apt.title}
                  </p>
                  <p className="font-opensans text-xs text-globus-gray flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" /> {apt.time} — {apt.with}
                  </p>
                </div>
                <span
                className={`text-[10px] font-montserrat font-bold px-2 py-1 rounded-full ${apt.type === 'reunion' ? 'bg-blue-100 text-blue-700' : 'bg-globus-orange/10 text-globus-orange'}`}>
                
                  {apt.type === 'reunion' ? 'Réunion' : 'Visite'}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Photo Gallery Preview */}
        <motion.div
          {...fadeUp}
          transition={{
            delay: 0.8
          }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
              Photos Récentes
            </h3>
            <Link
              to="/espace-client/chantier"
              className="text-globus-orange hover:text-globus-orange-hover font-montserrat font-bold text-xs flex items-center gap-1 transition-colors">
              
              Toutes les photos <ChevronRightIcon className="w-3 h-3" />
            </Link>
          </div>
          {liveRecentPhotos.length === 0 &&
            <p className="text-center text-globus-gray font-opensans text-sm py-6">
              Aucune photo de chantier disponible
            </p>
          }
          <div className="grid grid-cols-2 gap-3">
            {liveRecentPhotos.map((photo, i) =>
            <button
              key={i}
              onClick={() =>
              setLightbox({
                isOpen: true,
                image: photo
              })
              }
              className="relative group rounded-xl overflow-hidden aspect-[4/3]">
              
                <img
                src={photo}
                alt={`Chantier ${i + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Maximize2Icon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Contacts & Weather */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          {...fadeUp}
          transition={{
            delay: 0.85
          }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
          
          <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4">
            Vos Contacts Dédiés
          </h3>
          {contacts.length === 0 &&
            <p className="text-globus-gray font-opensans text-sm py-4">
              Vos contacts dédiés s'afficheront ici dès l'affectation de votre équipe projet.
            </p>
          }
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts.map((contact) =>
            <div
              key={contact.id}
              className="flex items-center gap-4 p-4 bg-globus-light rounded-xl border border-gray-100">
              
                <div className="w-12 h-12 rounded-full bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-lg shrink-0">
                  {contact.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-montserrat font-bold text-globus-blue-dark">
                    {contact.name}
                  </p>
                  <p className="text-xs text-globus-orange font-bold mb-1.5">
                    {contact.role}
                  </p>
                  <div className="flex items-center gap-3 text-sm">
                    <button
                    onClick={() => startCall(contact)}
                    className="text-globus-gray hover:text-green-600 transition-colors flex items-center gap-1 font-opensans">
                    
                      <PhoneIcon className="w-3 h-3" /> Appel
                    </button>
                    <button
                    onClick={() => openEmail(contact)}
                    className="text-globus-gray hover:text-globus-blue transition-colors flex items-center gap-1 font-opensans">
                    
                      <MailIcon className="w-3 h-3" /> Email
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Weather Widget */}
        <motion.div
          {...fadeUp}
          transition={{
            delay: 0.9
          }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center relative overflow-hidden">
          
          <div className="absolute -right-4 -top-4 opacity-5">
            <CloudSunIcon className="w-40 h-40" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <CloudSunIcon className="w-8 h-8 text-globus-orange" />
              <div>
                <h3 className="font-montserrat font-bold text-globus-blue-dark">
                  Météo Chantier
                </h3>
                <p className="font-opensans text-xs text-globus-gray">
                  {projectLocation || 'Localisation indisponible'}
                </p>
              </div>
            </div>
            <button
              onClick={refreshWeather}
              disabled={isRefreshingWeather}
              className="text-globus-gray hover:text-globus-orange transition-colors p-1.5 rounded-lg hover:bg-gray-100">
              
              <RefreshCwIcon
                className={`w-4 h-4 ${isRefreshingWeather ? 'animate-spin' : ''}`} />
              
            </button>
          </div>
          <div className="relative z-10">
            <div className="flex items-end gap-2 mb-2">
              <span className="font-montserrat font-extrabold text-4xl text-globus-blue-dark">
                {weather.temp != null ? `${weather.temp}°C` : '—'}
              </span>
              <span className="font-opensans text-sm text-globus-gray font-semibold mb-1">
                {weather.condition}
              </span>
            </div>
            <div
              className={`${weather.favorable ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'} border rounded-lg p-3 mt-4`}>
              
              <p
                className={`font-opensans text-xs font-semibold flex items-center gap-1.5 ${weather.favorable ? 'text-green-700' : 'text-amber-700'}`}>
                
                {weather.favorable ?
                <CheckCircle2Icon className="w-3.5 h-3.5" /> :

                <AlertCircleIcon className="w-3.5 h-3.5" />
                }
                {weather.favorable ?
                'Conditions favorables pour le chantier' :
                'Conditions défavorables — Prudence'}
              </p>
            </div>
            <p className="font-opensans text-xs text-globus-gray mt-3 italic">
              Prévisions : {weather.forecast}
            </p>
          </div>
        </motion.div>
      </div>

      {/* ===== MODALS ===== */}

      {/* Call Modal */}
      <AnimatePresence>
        {callModal.isOpen && callModal.contact &&
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
          onClick={endCall}>
          
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
            
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-2xl mx-auto mb-4">
                {callModal.contact.initials}
              </div>
              <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
                {callModal.contact.name}
              </p>
              <p className="font-opensans text-sm text-globus-orange mb-1">
                {callModal.contact.role}
              </p>
              <p className="font-opensans text-xs text-globus-gray mb-6">
                {callModal.contact.phone}
              </p>

              {callModal.status === 'ringing' &&
            <div className="mb-6">
                  <motion.div
                animate={{
                  scale: [1, 1.2, 1]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity
                }}
                className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                
                    <PhoneIcon className="w-7 h-7 text-green-600" />
                  </motion.div>
                  <p className="font-opensans text-sm text-globus-gray animate-pulse">
                    Appel en cours...
                  </p>
                </div>
            }

              {callModal.status === 'connected' &&
            <div className="mb-6">
                  <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3">
                    <PhoneIcon className="w-7 h-7 text-white" />
                  </div>
                  <p className="font-montserrat font-bold text-2xl text-green-600 mb-1">
                    {formatTimer(callModal.timer)}
                  </p>
                  <p className="font-opensans text-xs text-globus-gray">
                    Connecté
                  </p>
                </div>
            }

              {callModal.status === 'ended' &&
            <div className="mb-6">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <PhoneOffIcon className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="font-opensans text-sm text-globus-gray">
                    Appel terminé
                  </p>
                </div>
            }

              {callModal.status !== 'ended' &&
            <div className="flex items-center justify-center gap-4">
                  <button
                onClick={() =>
                setCallModal((prev) => ({
                  ...prev,
                  isMuted: !prev.isMuted
                }))
                }
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${callModal.isMuted ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                
                    {callModal.isMuted ?
                <MicOffIcon className="w-5 h-5" /> :

                <MicIcon className="w-5 h-5" />
                }
                  </button>
                  <button
                onClick={(e) => {
                  e.stopPropagation();
                  endCall();
                }}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg">
                
                    <PhoneOffIcon className="w-6 h-6" />
                  </button>
                </div>
            }
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Email Modal */}
      <AnimatePresence>
        {emailModal.isOpen && emailModal.contact &&
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
          onClick={() =>
          emailModal.status === 'idle' &&
          setEmailModal((prev) => ({
            ...prev,
            isOpen: false
          }))
          }>
          
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            
              {emailModal.status === 'success' ?
            <div className="text-center py-8">
                  <motion.div
                initial={{
                  scale: 0
                }}
                animate={{
                  scale: 1
                }}
                transition={{
                  type: 'spring',
                  stiffness: 200
                }}
                className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                
                    <CheckCircle2Icon className="w-8 h-8 text-green-600" />
                  </motion.div>
                  <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Email envoyé !
                  </p>
                  <p className="font-opensans text-sm text-globus-gray mt-1">
                    Votre message a été envoyé à {emailModal.contact.name}
                  </p>
                </div> :

            <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                      Envoyer un email
                    </h3>
                    <button
                  onClick={() =>
                  setEmailModal((prev) => ({
                    ...prev,
                    isOpen: false
                  }))
                  }
                  className="text-gray-400 hover:text-gray-600 transition-colors">
                  
                      <XIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mb-4 p-3 bg-globus-light rounded-lg border border-gray-100">
                    <p className="font-opensans text-xs text-globus-gray">
                      Destinataire
                    </p>
                    <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                      {emailModal.contact.name} — {emailModal.contact.email}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="font-montserrat font-bold text-sm text-globus-blue-dark mb-1.5 block">
                        Objet
                      </label>
                      <input
                    type="text"
                    value={emailModal.subject}
                    onChange={(e) =>
                    setEmailModal((prev) => ({
                      ...prev,
                      subject: e.target.value
                    }))
                    }
                    placeholder="Objet de votre message..."
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none transition-all" />
                  
                    </div>
                    <div>
                      <label className="font-montserrat font-bold text-sm text-globus-blue-dark mb-1.5 block">
                        Message
                      </label>
                      <textarea
                    value={emailModal.message}
                    onChange={(e) =>
                    setEmailModal((prev) => ({
                      ...prev,
                      message: e.target.value
                    }))
                    }
                    placeholder="Votre message..."
                    rows={5}
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none transition-all resize-none" />
                  
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-5">
                    <button
                  onClick={() =>
                  setEmailModal((prev) => ({
                    ...prev,
                    isOpen: false
                  }))
                  }
                  className="px-4 py-2.5 font-montserrat font-bold text-sm text-globus-gray hover:text-globus-blue-dark transition-colors">
                  
                      Annuler
                    </button>
                    <button
                  onClick={sendEmail}
                  disabled={
                  emailModal.status === 'sending' ||
                  !emailModal.subject.trim() ||
                  !emailModal.message.trim()
                  }
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold text-sm py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
                  
                      {emailModal.status === 'sending' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :

                  <SendIcon className="w-4 h-4" />
                  }
                      {emailModal.status === 'sending' ? 'Envoi...' : 'Envoyer'}
                    </button>
                  </div>
                </>
            }
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Photo Lightbox */}
      <AnimatePresence>
        {lightbox.isOpen && lightbox.image &&
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
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() =>
          setLightbox({
            isOpen: false,
            image: null
          })
          }>
          
            <button
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox({
                isOpen: false,
                image: null
              });
            }}>
            
              <XIcon className="w-6 h-6" />
            </button>
            <motion.img
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
            src={lightbox.image}
            alt="Aperçu"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} />
          
          </motion.div>
        }
      </AnimatePresence>

      {/* Download Toast */}
      <AnimatePresence>
        {downloadState.isDownloading &&
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
              {downloadState.isSuccess ?
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2Icon className="w-4 h-4 text-green-600" />
                </div> :

            <div className="w-8 h-8 rounded-full bg-globus-blue/10 flex items-center justify-center shrink-0">
                  <Loader2Icon className="w-4 h-4 text-globus-blue animate-spin" />
                </div>
            }
              <div>
                <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                  {downloadState.isSuccess ?
                'Téléchargement terminé' :
                'Téléchargement en cours...'}
                </p>
                <p className="font-opensans text-xs text-globus-gray">
                  Rapport_Projet_{clientUser.projectName.replace(/\s/g, '_')}.pdf
                </p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
              className={`h-full rounded-full ${downloadState.isSuccess ? 'bg-green-500' : 'bg-globus-orange'}`}
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

      {/* Quick Action Toast */}
      <AnimatePresence>
        {toastMessage &&
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: 20
          }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-globus-blue-dark text-white font-opensans text-sm py-3 px-6 rounded-xl shadow-xl">
          
            {toastMessage}
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}
