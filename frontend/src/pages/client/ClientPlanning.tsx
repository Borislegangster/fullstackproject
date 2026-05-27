import React, { useEffect, useState, Children } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  PhoneIcon,
  PaperclipIcon,
  DownloadIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  MessageSquareIcon,
  ChevronDownIcon } from
'lucide-react';
import { useClientUser } from '../../hooks/useClientUser';
import { useClientPlanning, useRequestAppointment } from '../../hooks/useClient';
const projectPhases = [
{
  id: 1,
  name: 'Études & Conception',
  start: 'Jan 2024',
  end: 'Fév 2024',
  status: 'Terminé',
  details:
  'Validation des plans architecturaux, études de sol, et obtention du permis de construire. Tous les documents administratifs ont été signés.',
  milestones: ['Plans validés', 'Permis obtenu', 'Étude géotechnique'],
  responsible: 'Mme. Claire Fotso (Architecte)'
},
{
  id: 2,
  name: 'Terrassement',
  start: 'Mar 2024',
  end: 'Mar 2024',
  status: 'Terminé',
  details:
  'Préparation du terrain, nivellement, et fouilles pour les fondations. Évacuation des terres excédentaires.',
  milestones: [
  'Installation de chantier',
  'Fouilles en rigole',
  'Évacuation'],

  responsible: 'Ing. Paul Mbarga'
},
{
  id: 3,
  name: 'Fondations',
  start: 'Avr 2024',
  end: 'Mai 2024',
  status: 'Terminé',
  details:
  'Coulage du béton de propreté, ferraillage, et coulage des semelles et longrines. Mise en place des attentes pour les poteaux.',
  milestones: [
  'Ferraillage validé',
  'Coulage semelles',
  'Murs de soubassement'],

  responsible: 'Ing. Paul Mbarga'
},
{
  id: 4,
  name: 'Élévation Murs RDC',
  start: 'Juin 2024',
  end: 'Août 2024',
  status: 'En cours',
  details:
  'Montage des murs en parpaings, réalisation des chaînages verticaux et horizontaux, pose des linteaux.',
  milestones: ['Murs extérieurs', 'Murs de refend', 'Coffrage poteaux'],
  responsible: 'Ing. Paul Mbarga'
},
{
  id: 5,
  name: 'Plancher Haut RDC',
  start: 'Sep 2024',
  end: 'Sep 2024',
  status: 'À venir',
  details:
  'Coffrage de la dalle, ferraillage, passage des gaines électriques et plomberie, coulage du béton.',
  milestones: ['Coffrage', 'Ferraillage & Gaines', 'Coulage dalle'],
  responsible: 'Ing. Paul Mbarga'
},
{
  id: 6,
  name: 'Élévation R+1',
  start: 'Oct 2024',
  end: 'Nov 2024',
  status: 'À venir',
  details:
  "Montage des murs de l'étage, chaînages, et préparation pour la toiture.",
  milestones: ['Murs R+1', 'Chaînages', 'Pignons'],
  responsible: 'Ing. Paul Mbarga'
},
{
  id: 7,
  name: "Mise Hors d'Eau",
  start: 'Déc 2024',
  end: 'Jan 2025',
  status: 'À venir',
  details:
  'Pose de la charpente, couverture, et zinguerie. Le bâtiment sera protégé des intempéries.',
  milestones: ['Charpente', 'Couverture', 'Gouttières'],
  responsible: 'Équipe Charpente'
},
{
  id: 8,
  name: 'Second Œuvre',
  start: 'Fév 2025',
  end: 'Avr 2025',
  status: 'À venir',
  details:
  'Installation électrique, plomberie, chauffage, isolation, et cloisons intérieures.',
  milestones: ['Électricité', 'Plomberie', 'Plâtrerie'],
  responsible: 'Sous-traitants spécialisés'
},
{
  id: 9,
  name: 'Finitions',
  start: 'Mai 2025',
  end: 'Juin 2025',
  status: 'À venir',
  details:
  'Revêtements de sols (carrelage), peinture, menuiseries intérieures, et équipements sanitaires.',
  milestones: ['Carrelage', 'Peinture', 'Sanitaires'],
  responsible: 'Équipe Finitions'
},
{
  id: 10,
  name: 'Livraison',
  start: 'Juil 2025',
  end: 'Juil 2025',
  status: 'À venir',
  details:
  'Nettoyage de fin de chantier, levée des réserves, et remise des clés au propriétaire.',
  milestones: ['Pré-réception', 'Levée des réserves', 'Remise des clés'],
  responsible: 'Ing. Paul Mbarga & Client'
}];

const upcomingEvents = [
{
  id: 1,
  title: 'Visite de chantier avec le client',
  date: '28/03/2026',
  time: '10h00',
  location: 'Sur site',
  type: 'site'
},
{
  id: 2,
  title: 'Réunion choix carrelage',
  date: '02/04/2026',
  time: '14h00',
  location: 'Showroom Globus',
  type: 'meeting'
},
{
  id: 3,
  title: "Point d'avancement mensuel",
  date: '15/04/2026',
  time: '10h00',
  location: 'Visioconférence',
  type: 'video'
},
{
  id: 4,
  title: 'Visite architecte pour finitions',
  date: '25/04/2026',
  time: '09h00',
  location: 'Sur site',
  type: 'site'
}];

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
export function ClientPlanning() {
  const { data: apiPlanningData } = useClientPlanning();
  const requestAppointmentMutation = useRequestAppointment();
  
  const clientUser = useClientUser();
  const [expandedPhase, setExpandedPhase] = useState<number | null>(4); // Default expand "En cours"
  // Modals state
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentSuccess, setAppointmentSuccess] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactMode, setContactMode] = useState<'select' | 'message' | 'call'>(
    'select'
  );
  const [messageSuccess, setMessageSuccess] = useState(false);
  // Call simulation state
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>(
    'ringing'
  );
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  // Call timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).
    toString().
    padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  const handleAppointmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppointmentSuccess(true);
    setTimeout(() => {
      setIsAppointmentModalOpen(false);
      setAppointmentSuccess(false);
    }, 3000);
  };
  const handleMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessageSuccess(true);
    setTimeout(() => {
      setIsContactModalOpen(false);
      setContactMode('select');
      setMessageSuccess(false);
    }, 3000);
  };
  const startCall = () => {
    setContactMode('call');
    setCallState('ringing');
    setCallDuration(0);
    setIsMuted(false);
    // Simulate answer after 3 seconds
    setTimeout(() => {
      setCallState('connected');
    }, 3000);
  };
  const endCall = () => {
    setCallState('ended');
    setTimeout(() => {
      setIsContactModalOpen(false);
      setContactMode('select');
    }, 2000);
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
            <button className="mt-4 flex items-center gap-2 text-sm font-montserrat font-bold text-globus-blue hover:text-globus-blue-dark transition-colors">
              <DownloadIcon className="w-4 h-4" /> Télécharger le planning PDF
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
                  strokeDasharray="175.9"
                  strokeDashoffset="96.7"
                  className="transition-all duration-1000" />
                
              </svg>
              <span className="absolute font-montserrat font-bold text-sm text-globus-blue-dark">
                45%
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase mb-1">
                Avancement Global
              </p>
              <p className="text-sm font-semibold text-gray-800">
                Élévation Murs RDC
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
            15 Jan 2024
          </p>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-l-4 border-l-green-500">
          
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">
            Livraison prévue
          </p>
          <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
            15 Juil 2025
          </p>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-l-4 border-l-globus-orange">
          
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">
            Prochaine étape
          </p>
          <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
            Plancher Haut RDC
          </p>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-l-4 border-l-purple-500">
          
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">
            Temps restant estimé
          </p>
          <p className="font-montserrat font-bold text-lg text-globus-blue-dark">
            ~480 jours
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
            {projectPhases.map((phase) => {
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
              {upcomingEvents.map((event) =>
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
                      type="date"
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                    
                      </div>
                      <div>
                        <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                          Heure préférée
                        </label>
                        <select
                      required
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
                      <div className="w-14 h-14 rounded-full bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-xl shrink-0">
                        PM
                      </div>
                      <div>
                        <p className="font-montserrat font-bold text-globus-blue-dark text-lg">
                          Ing. Paul Mbarga
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

                    <button
                  onClick={startCall}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group">
                  
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0 group-hover:bg-green-500 group-hover:text-white transition-colors text-green-600">
                        <PhoneIcon className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="font-montserrat font-bold text-globus-blue-dark">
                          Appel en ligne
                        </p>
                        <p className="font-opensans text-xs text-gray-500">
                          Appel via la plateforme Globus — gratuit
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
                          Paul Mbarga a bien reçu votre message.
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
                      type="text"
                      className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans text-sm focus:outline-none focus:border-globus-orange" />
                    
                        </div>
                        <div>
                          <label className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                            Message
                          </label>
                          <textarea
                      required
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

              {/* CALL MODE */}
              {contactMode === 'call' &&
            <div className="bg-gray-900 text-white p-8 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
                  {/* Background pulse for ringing */}
                  {callState === 'ringing' &&
              <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 bg-green-500/20 rounded-full animate-ping"></div>
                    </div>
              }

                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-globus-blue text-white flex items-center justify-center font-montserrat font-bold text-3xl mb-6 shadow-lg border-4 border-gray-800">
                      PM
                    </div>
                    <h3 className="font-montserrat font-bold text-2xl mb-2">
                      Ing. Paul Mbarga
                    </h3>

                    <div className="h-8 mb-12">
                      {callState === 'ringing' &&
                  <p className="text-gray-400 animate-pulse">
                          Appel en cours...
                        </p>
                  }
                      {callState === 'connected' &&
                  <p className="text-green-400 font-mono text-lg">
                          {formatDuration(callDuration)}
                        </p>
                  }
                      {callState === 'ended' &&
                  <p className="text-red-400">Appel terminé</p>
                  }
                    </div>

                    <div className="flex items-center gap-6">
                      <button
                    onClick={() => setIsMuted(!isMuted)}
                    disabled={callState !== 'connected'}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-white text-gray-900' : 'bg-gray-800 text-white hover:bg-gray-700'} ${callState !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    
                        {isMuted ?
                    <MicOffIcon className="w-6 h-6" /> :

                    <MicIcon className="w-6 h-6" />
                    }
                      </button>

                      <button
                    onClick={endCall}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105">
                    
                        <PhoneOffIcon className="w-7 h-7" />
                      </button>
                    </div>
                  </div>
                </div>
            }
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}