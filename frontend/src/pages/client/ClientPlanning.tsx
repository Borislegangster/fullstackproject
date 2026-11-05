import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, formatDateParts } from '../../utils/datetime';
import {
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  MapPinIcon,
  VideoIcon,
  ArrowRightIcon,
  FlagIcon,
  XIcon,
  SendIcon,
  PaperclipIcon,
  DownloadIcon,
  MessageSquareIcon,
  UserIcon,
  ChevronDownIcon } from
'lucide-react';
import { useClientUser } from '../../hooks/useClientUser';
import { useClientPlanning, useRequestAppointment, useClientProject, useSendClientMessage } from '../../hooks/useClient';
import { downloadCSV } from '../../utils/download';


const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1
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
      duration: 0.5
    }
  }
};
function phaseStatusToFr(s: string): string {
  switch ((s || '').toUpperCase()) {
    case 'TERMINE': return 'Terminé';
    case 'EN_COURS': return 'En cours';
    case 'BLOQUE': return 'Bloqué';
    case 'EN_ATTENTE': return 'À venir';
    default: return 'À venir';
  }
}

export function ClientPlanning() {
  const { data: apiPlanningData } = useClientPlanning();
  const requestAppointmentMutation = useRequestAppointment();
  const clientUser = useClientUser();
  void clientUser;

  // Live phases from API (no mock fallback).
  const livePhases = React.useMemo(() => {
    const phases = (apiPlanningData as any)?.phases;
    if (!Array.isArray(phases)) return [];
    return phases.map((p: any, i: number) => ({
      id: p.id || i + 1,
      name: p.name || '',
      start: formatDateParts(p.start_date, { month: 'short', year: 'numeric' }, '—'),
      end: formatDateParts(p.end_date, { month: 'short', year: 'numeric' }, '—'),
      status: phaseStatusToFr(p.status),
      details: p.description || `Avancement: ${p.progress || 0}%`,
      milestones: [],
      responsible: '',
    }));
  }, [apiPlanningData]);

  // Upcoming events derived from the project's not-yet-completed phases.
  const liveUpcomingEvents = React.useMemo(() => {
    const phases = (apiPlanningData as any)?.phases;
    if (!Array.isArray(phases)) return [];
    return phases
      .filter((p: any) => p.status !== 'TERMINE' && p.start_date)
      .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      .slice(0, 5)
      .map((p: any, i: number) => ({
        id: p.id || i + 1,
        title: `Phase : ${p.name || ''}`,
        date: formatDate(p.start_date),
        time: '—',
        location: 'Chantier',
        type: 'site',
      }));
  }, [apiPlanningData]);

  const { data: projectData } = useClientProject();
  const sendMessageMutation = useSendClientMessage();
  // Real project KPIs for the header + key dates (no hardcoded values).
  const progress = Math.round(Number((projectData as any)?.progress ?? 0));
  const RADIUS = 28;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const dashOffset = CIRCUMFERENCE * (1 - Math.min(Math.max(progress, 0), 100) / 100);
  const currentPhaseName =
    livePhases.find((p) => p.status === 'En cours')?.name ||
    livePhases.find((p) => p.status !== 'Terminé')?.name ||
    '—';
  const nextPhaseName = livePhases.find((p) => p.status !== 'Terminé')?.name || '—';
  const fmtDate = (d: string | null) =>
    formatDateParts(d, { day: '2-digit', month: 'short', year: 'numeric' }, '—');
  const startDateLabel = fmtDate((projectData as any)?.start_date || null);
  const estimatedEnd = (projectData as any)?.estimated_end_date || null;
  const deliveryLabel = fmtDate(estimatedEnd);
  const daysRemaining = estimatedEnd
    ? Math.max(0, Math.ceil((new Date(estimatedEnd).getTime() - Date.now()) / 86_400_000))
    : null;
  const handleDownloadPlanning = () => {
    if (livePhases.length === 0) return;
    downloadCSV(
      `planning-${new Date().toISOString().slice(0, 10)}.csv`,
      livePhases.map((p) => ({ name: p.name, status: p.status, start: p.start, end: p.end })),
      [
        { key: 'name', label: 'Phase' },
        { key: 'status', label: 'Statut' },
        { key: 'start', label: 'Début' },
        { key: 'end', label: 'Fin' },
      ],
    );
  };
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  // Modals state
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentSuccess, setAppointmentSuccess] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactMode, setContactMode] = useState<'select' | 'message'>(
    'select'
  );
  const [messageSuccess, setMessageSuccess] = useState(false);
  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    try {
      const type = (form.elements.namedItem('rdv_type') as RadioNodeList | null)?.value || 'Visite de chantier';
      const dateStr = (form.elements.namedItem('date') as HTMLInputElement)?.value;
      const timeStr = (form.elements.namedItem('time') as HTMLSelectElement)?.value || '09:00';
      const subject = (form.elements.namedItem('subject') as HTMLInputElement)?.value || '';
      const message = (form.elements.namedItem('message') as HTMLTextAreaElement)?.value || '';
      const start = dateStr ? new Date(`${dateStr}T${timeStr}`) : new Date();
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await requestAppointmentMutation.mutateAsync({
        title: subject || type,
        description: [type, message].filter(Boolean).join(' — '),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      setAppointmentSuccess(true);
      setTimeout(() => {
        setIsAppointmentModalOpen(false);
        setAppointmentSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Appointment request failed', err);
    }
  };
  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const subject = (form.elements.namedItem('subject') as HTMLInputElement)?.value || '';
    const body = (form.elements.namedItem('message') as HTMLTextAreaElement)?.value || '';
    const content = [subject, body].filter(Boolean).join(' — ');
    if (!content.trim()) return;
    try {
      await sendMessageMutation.mutateAsync(content);
      setMessageSuccess(true);
      setTimeout(() => {
        setIsContactModalOpen(false);
        setContactMode('select');
        setMessageSuccess(false);
      }, 2500);
    } catch {
      /* keep the modal open on error */
    }
  };
  const closeContactModal = () => {
    setIsContactModalOpen(false);
    setTimeout(() => setContactMode('select'), 300);
  };
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{
          opacity: 0,
          y: -10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
        
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div>
            <h1 className="font-montserrat font-extrabold text-2xl sm:text-3xl text-globus-blue-dark mb-2">
              Planning & Calendrier
            </h1>
            <p className="font-opensans text-globus-gray">
              Suivez l'avancement de votre projet{' '}
              <strong className="text-globus-blue-dark">
                {clientUser.projectName}
              </strong>
            </p>
            <button
              onClick={handleDownloadPlanning}
              className="mt-4 flex items-center gap-2 text-sm font-montserrat font-bold text-globus-blue hover:text-globus-blue-dark transition-colors">
              <DownloadIcon className="w-4 h-4" /> Télécharger le planning
            </button>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="w-16 h-16 relative flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#E5E7EB"
                  strokeWidth="6"
                  fill="none" />
                
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#F97316"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-1000" />
                
              </svg>
              <span className="absolute font-montserrat font-bold text-sm text-globus-blue-dark">
                {progress}%
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase mb-1">
                Avancement Global
              </p>
              <p className="text-sm font-semibold text-gray-800">
                {currentPhaseName}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Key Dates */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-l-4 border-l-globus-blue">
          
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">
            Date de début
          </p>
          <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
            {startDateLabel}
          </p>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-l-4 border-l-green-500">
          
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">
            Livraison prévue
          </p>
          <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
            {deliveryLabel}
          </p>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-l-4 border-l-globus-orange">
          
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">
            Prochaine étape
          </p>
          <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
            {nextPhaseName}
          </p>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-l-4 border-l-purple-500">
          
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">
            Temps restant estimé
          </p>
          <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
            {daysRemaining !== null ? `~${daysRemaining} jours` : '—'}
          </p>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Timeline */}
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: 0.2
          }}
          className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          
          <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-8 flex items-center gap-2">
            <FlagIcon className="w-6 h-6 text-globus-orange" />
            Planning Général du Projet
          </h2>

          <div className="relative pl-6 sm:pl-8 border-l-2 border-gray-100 space-y-6">
            {livePhases.map((phase) => {
              const isDone = phase.status === 'Terminé';
              const isCurrent = phase.status === 'En cours';
              const isExpanded = expandedPhase === phase.id;
              return (
                <div key={phase.id} className="relative">
                  {/* Timeline Node */}
                  <div
                    className={`absolute -left-[33px] sm:-left-[41px] top-0.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-4 border-white flex items-center justify-center ${isDone ? 'bg-green-500' : isCurrent ? 'bg-globus-blue' : 'bg-gray-200'}`}>
                    
                    {isDone &&
                    <CheckCircle2Icon className="w-4 h-4 text-white" />
                    }
                    {isCurrent &&
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    }
                  </div>

                  {/* Content */}
                  <div
                    onClick={() =>
                    setExpandedPhase(isExpanded ? null : phase.id)
                    }
                    className={`bg-gray-50 rounded-xl p-4 sm:p-5 border transition-all cursor-pointer hover:shadow-md ${isCurrent ? 'border-globus-blue shadow-md ring-1 ring-globus-blue/20' : 'border-gray-100 hover:border-gray-300'}`}>
                    
                    {isCurrent &&
                    <div className="absolute -top-3 right-4 bg-globus-blue text-white text-[10px] font-bold uppercase px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                        <ArrowRightIcon className="w-3 h-3" /> Vous êtes ici
                      </div>
                    }

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-montserrat font-bold text-base sm:text-lg ${isCurrent ? 'text-globus-blue-dark' : 'text-gray-800'}`}>
                          
                          {phase.name}
                        </h3>
                        <ChevronDownIcon
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        
                      </div>
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase w-fit ${isDone ? 'bg-green-100 text-green-700' : isCurrent ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                        
                        {phase.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500 font-opensans">
                      <CalendarIcon className="w-4 h-4" />
                      <span>
                        {phase.start} — {phase.end}
                      </span>
                    </div>

                    {/* Expandable Details */}
                    <AnimatePresence>
                      {isExpanded &&
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
                        className="overflow-hidden">
                        
                          <div className="pt-4 mt-4 border-t border-gray-200">
                            <p className="font-opensans text-sm text-gray-600 mb-4 leading-relaxed">
                              {phase.details}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                                  Jalons clés
                                </p>
                                <ul className="space-y-1">
                                  {phase.milestones.map((m, i) =>
                                <li
                                  key={i}
                                  className="flex items-center gap-2 text-sm text-gray-700 font-opensans">
                                  
                                      <div
                                    className={`w-1.5 h-1.5 rounded-full ${isDone ? 'bg-green-500' : 'bg-gray-300'}`}>
                                  </div>
                                      {m}
                                    </li>
                                )}
                                </ul>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                                  Responsable
                                </p>
                                <p className="text-sm font-semibold text-globus-blue-dark flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-globus-blue/10 flex items-center justify-center text-globus-blue text-xs">
                                    {phase.responsible.split(' ')[0][0]}
                                    {phase.responsible.split(' ')[1]?.[0]}
                                  </div>
                                  {phase.responsible}
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      }
                    </AnimatePresence>
                  </div>
                </div>);

            })}
          </div>
        </motion.div>

        {/* Upcoming Events & Actions */}
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: 0.4
          }}
          className="space-y-6">
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-6 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-globus-orange" />
              Prochains Rendez-vous
            </h2>

            <div className="space-y-4">
              {liveUpcomingEvents.length === 0 &&
                <p className="text-center text-globus-gray font-opensans text-sm py-6">
                  Aucun rendez-vous à venir
                </p>
              }
              {liveUpcomingEvents.map((event) =>
              <div
                key={event.id}
                className="border border-gray-100 rounded-xl p-4 hover:border-globus-blue/30 hover:shadow-sm transition-all bg-gray-50/50">
                
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex flex-col items-center justify-center shrink-0 overflow-hidden">
                      <div className="bg-red-500 w-full h-3 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-white uppercase">
                          {event.date.split('/')[1]}
                        </span>
                      </div>
                      <span className="font-bold text-sm text-gray-800 leading-none mt-1">
                        {event.date.split('/')[0]}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-montserrat font-bold text-sm text-globus-blue-dark mb-1 leading-tight">
                        {event.title}
                      </h4>
                      <div className="space-y-1 mt-2">
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                          <ClockIcon className="w-3.5 h-3.5" /> {event.time}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                          {event.type === 'video' ?
                        <VideoIcon className="w-3.5 h-3.5" /> :

                        <MapPinIcon className="w-3.5 h-3.5" />
                        }
                          {event.location}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsAppointmentModalOpen(true)}
              className="w-full mt-6 py-2.5 border-2 border-globus-blue text-globus-blue hover:bg-globus-blue hover:text-white font-montserrat font-bold text-sm rounded-lg transition-colors">
              
              Demander un rendez-vous
            </button>
          </div>

          {/* Need Help Card */}
          <div className="bg-gradient-to-br from-globus-blue-dark to-globus-blue rounded-2xl shadow-sm p-6 text-white">
            <h3 className="font-montserrat font-bold text-lg mb-2">
              Une question sur le planning ?
            </h3>
            <p className="font-opensans text-sm text-blue-100 mb-4">
              Votre chef de projet est à votre disposition pour détailler les
              prochaines étapes.
            </p>
            <button
              onClick={() => setIsContactModalOpen(true)}
              className="w-full py-2.5 bg-white text-globus-blue-dark hover:bg-gray-50 font-montserrat font-bold text-sm rounded-lg transition-colors">
              
              Contacter mon chef de projet
            </button>
          </div>
        </motion.div>
      </div>

      {/* MODAL: Appointment Request */}
      <AnimatePresence>
        {isAppointmentModalOpen &&
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
          onClick={() => setIsAppointmentModalOpen(false)}>
          
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
                  Demander un rendez-vous
                </h3>
                <button
                onClick={() => setIsAppointmentModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors">
                
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 sm:p-8">
                {appointmentSuccess ?
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.9
                }}
                animate={{
                  opacity: 1,
                  scale: 1
                }}
                className="text-center py-8">
                
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2Icon className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                      Demande envoyée !
                    </h4>
                    <p className="font-opensans text-globus-gray">
                      Votre chef de projet vous confirmera ce rendez-vous très
                      prochainement.
                    </p>
                  </motion.div> :

              <form
                onSubmit={handleAppointmentSubmit}
                className="space-y-5">
                
                    <div>
                      <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-3">
                        Type de rendez-vous
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                        type="radio"
                        name="rdv_type"
                        value="Visite de chantier"
                        defaultChecked
                        className="w-4 h-4 text-globus-orange focus:ring-globus-orange" />
                      
                          <span className="ml-3 font-opensans text-sm text-gray-700 flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4 text-gray-400" />{' '}
                            Visite de chantier
                          </span>
                        </label>
                        <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                        type="radio"
                        name="rdv_type"
                        value="Visioconférence"
                        className="w-4 h-4 text-globus-orange focus:ring-globus-orange" />

                          <span className="ml-3 font-opensans text-sm text-gray-700 flex items-center gap-2">
                            <VideoIcon className="w-4 h-4 text-gray-400" />{' '}
                            Visioconférence
                          </span>
                        </label>
                        <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                        type="radio"
                        name="rdv_type"
                        value="Réunion au bureau Globus"
                        className="w-4 h-4 text-globus-orange focus:ring-globus-orange" />

                          <span className="ml-3 font-opensans text-sm text-gray-700 flex items-center gap-2">
                            <ClockIcon className="w-4 h-4 text-gray-400" />{' '}
                            Réunion au bureau Globus
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                          Date souhaitée
                        </label>
                        <input
                      required
                      name="date"
                      type="date"
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                    
                      </div>
                      <div>
                        <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                          Heure préférée
                        </label>
                        <select
                      required
                      name="time"
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange">

                          <option value="">Sélectionner...</option>
                          <option value="08:00">08:00</option>
                          <option value="09:00">09:00</option>
                          <option value="10:00">10:00</option>
                          <option value="11:00">11:00</option>
                          <option value="14:00">14:00</option>
                          <option value="15:00">15:00</option>
                          <option value="16:00">16:00</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                        Objet
                      </label>
                      <input
                    required
                    name="subject"
                    type="text"
                    placeholder="Ex: Point d'avancement, Choix matériaux..."
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                  
                    </div>

                    <div>
                      <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                        Message complémentaire (Optionnel)
                      </label>
                      <textarea
                    rows={3}
                    name="message"
                    placeholder="Précisez vos attentes pour ce rendez-vous..."
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange resize-none">
                  </textarea>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                    type="button"
                    onClick={() => setIsAppointmentModalOpen(false)}
                    className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                    
                        Annuler
                      </button>
                      <button
                    type="submit"
                    className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2">
                    
                        <SendIcon className="w-4 h-4" /> Envoyer la demande
                      </button>
                    </div>
                  </form>
              }
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* MODAL: Contact Options & Call UI */}
      <AnimatePresence>
        {isContactModalOpen &&
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
          onClick={closeContactModal}>
          
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
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            
              {/* SELECT MODE */}
              {contactMode === 'select' &&
            <>
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                      Contacter mon chef de projet
                    </h3>
                    <button
                  onClick={closeContactModal}
                  className="text-gray-400 hover:text-gray-700 transition-colors">
                  
                      <XIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4 mb-6 p-4 bg-globus-light rounded-xl border border-gray-100">
                      <div className="w-14 h-14 rounded-full bg-globus-blue-dark text-white flex items-center justify-center shrink-0">
                        <UserIcon className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="font-montserrat font-bold text-globus-blue-dark text-lg">
                          Votre chef de projet
                        </p>
                        <p className="text-sm text-globus-orange font-bold">
                          Chef de Projet
                        </p>
                      </div>
                    </div>

                    <button
                  onClick={() => setContactMode('message')}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-globus-blue hover:bg-blue-50 transition-all group">
                  
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-globus-blue group-hover:text-white transition-colors text-globus-blue">
                        <MessageSquareIcon className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="font-montserrat font-bold text-globus-blue-dark">
                          Laisser un message
                        </p>
                        <p className="font-opensans text-xs text-gray-500">
                          Réponse sous 24h ouvrées
                        </p>
                      </div>
                    </button>
                  </div>
                </>
            }

              {/* MESSAGE MODE */}
              {contactMode === 'message' &&
            <>
                  <div className="bg-globus-blue-dark p-6 text-white flex items-center justify-between">
                    <h3 className="font-montserrat font-bold text-xl">
                      Nouveau Message
                    </h3>
                    <button
                  onClick={closeContactModal}
                  className="text-white/70 hover:text-white transition-colors">
                  
                      <XIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6">
                    {messageSuccess ?
                <motion.div
                  initial={{
                    opacity: 0
                  }}
                  animate={{
                    opacity: 1
                  }}
                  className="text-center py-8">
                  
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2Icon className="w-8 h-8 text-green-600" />
                        </div>
                        <h4 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
                          Message envoyé
                        </h4>
                        <p className="font-opensans text-globus-gray">
                          Votre chef de projet a bien reçu votre message.
                        </p>
                      </motion.div> :

                <form
                  onSubmit={handleMessageSubmit}
                  className="space-y-4">
                  
                        <div>
                          <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                            Objet
                          </label>
                          <input
                      required
                      name="subject"
                      type="text"
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />

                        </div>
                        <div>
                          <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                            Message
                          </label>
                          <textarea
                      required
                      name="message"
                      rows={5}
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange resize-none">
                    </textarea>
                        </div>
                        <div>
                          <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-semibold text-globus-blue hover:underline">
                      
                            <PaperclipIcon className="w-4 h-4" /> Ajouter une
                            pièce jointe
                          </button>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <button
                      type="button"
                      onClick={() => setContactMode('select')}
                      className="px-5 py-2.5 rounded-lg font-montserrat font-bold text-globus-gray hover:bg-gray-100 transition-colors text-sm">
                      
                            Retour
                          </button>
                          <button
                      type="submit"
                      className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md text-sm flex items-center gap-2">
                      
                            <SendIcon className="w-4 h-4" /> Envoyer
                          </button>
                        </div>
                      </form>
                }
                  </div>
                </>
            }

            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}