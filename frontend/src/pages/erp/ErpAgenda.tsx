import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  UsersIcon,
  ShieldAlertIcon,
  TruckIcon,
  FlagIcon,
  FilterIcon,
  Loader2Icon,
  XIcon,
  SaveIcon,
  Trash2Icon,
  EditIcon,
  CheckCircle2Icon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon } from
'lucide-react';
const eventTypes = [
{
  id: 'reunion',
  label: 'Réunions',
  color: 'bg-blue-500',
  bgLight: 'bg-blue-50',
  text: 'text-blue-700',
  border: 'border-l-blue-500',
  icon: UsersIcon
},
{
  id: 'inspection',
  label: 'Inspections QHSE',
  color: 'bg-red-500',
  bgLight: 'bg-red-50',
  text: 'text-red-700',
  border: 'border-l-red-500',
  icon: ShieldAlertIcon
},
{
  id: 'livraison',
  label: 'Livraisons',
  color: 'bg-green-500',
  bgLight: 'bg-green-50',
  text: 'text-green-700',
  border: 'border-l-green-500',
  icon: TruckIcon
},
{
  id: 'deadline',
  label: 'Deadlines',
  color: 'bg-orange-500',
  bgLight: 'bg-orange-50',
  text: 'text-orange-700',
  border: 'border-l-orange-500',
  icon: FlagIcon
}];

interface CalendarEvent {
  id: number;
  title: string;
  type: string;
  date: number;
  time: string;
  location: string;
  attendees: string;
}
const mockEvents: CalendarEvent[] = [
{
  id: 1,
  title: 'Réunion de Chantier',
  type: 'reunion',
  date: 3,
  time: '09:00 - 11:00',
  location: 'Villa Bonapriso',
  attendees: 'P. Mbarga, C. Fotso'
},
{
  id: 2,
  title: 'Inspection Sécurité',
  type: 'inspection',
  date: 5,
  time: '14:00 - 15:30',
  location: 'Immeuble Akwa',
  attendees: 'Équipe QHSE'
},
{
  id: 3,
  title: 'Livraison Ciment (50T)',
  type: 'livraison',
  date: 7,
  time: '08:00',
  location: 'Entrepôt Bonabéri',
  attendees: 'Logistique'
},
{
  id: 4,
  title: 'Formation Sécurité Échafaudages',
  type: 'inspection',
  date: 10,
  time: '09:00 - 17:00',
  location: 'Siège Globus',
  attendees: 'Tous chefs chantier'
},
{
  id: 5,
  title: 'Point Hebdo Direction',
  type: 'reunion',
  date: 12,
  time: '10:00 - 11:00',
  location: 'Siège Globus',
  attendees: 'Codir'
},
{
  id: 6,
  title: 'Dépôt Permis de Construire',
  type: 'deadline',
  date: 14,
  time: '12:00',
  location: 'Centre Commercial Bali',
  attendees: 'Direction'
},
{
  id: 7,
  title: 'Audit QHSE Mensuel',
  type: 'inspection',
  date: 17,
  time: '09:00 - 12:00',
  location: 'Résidence Bonanjo',
  attendees: 'Équipe QHSE'
},
{
  id: 8,
  title: 'Point Hebdo Direction',
  type: 'reunion',
  date: 19,
  time: '10:00 - 11:00',
  location: 'Siège Globus',
  attendees: 'Codir'
},
{
  id: 9,
  title: 'Réception Menuiseries',
  type: 'livraison',
  date: 20,
  time: '10:00',
  location: 'Villa Bonapriso',
  attendees: 'Chef Chantier'
},
{
  id: 10,
  title: 'Comité de Direction Mensuel',
  type: 'reunion',
  date: 23,
  time: '09:00 - 12:00',
  location: 'Siège Globus',
  attendees: 'Codir'
},
{
  id: 11,
  title: 'Contrôle Fondations',
  type: 'inspection',
  date: 23,
  time: '14:00 - 16:00',
  location: 'Bureau Deïdo',
  attendees: 'P. Mbarga'
},
{
  id: 12,
  title: 'Fin Phase Gros Œuvre',
  type: 'deadline',
  date: 25,
  time: 'Journée',
  location: 'Résidence Bonanjo',
  attendees: 'Équipe technique'
},
{
  id: 13,
  title: 'Point Hebdo Direction',
  type: 'reunion',
  date: 26,
  time: '10:00 - 11:00',
  location: 'Siège Globus',
  attendees: 'Codir'
},
{
  id: 14,
  title: 'Réception Acier',
  type: 'livraison',
  date: 27,
  time: '08:00',
  location: 'Immeuble Akwa',
  attendees: 'Logistique'
},
{
  id: 15,
  title: 'Formation Premiers Secours',
  type: 'inspection',
  date: 28,
  time: '09:00 - 13:00',
  location: 'Siège Globus',
  attendees: 'Personnel terrain'
},
{
  id: 16,
  title: 'Clôture Comptable Mensuelle',
  type: 'deadline',
  date: 31,
  time: 'Journée',
  location: 'Siège Globus',
  attendees: 'J. Nkoulou'
}];

const TODAY = 23;
export function ErpAgenda() {
  const [activeFilters, setActiveFilters] = useState<string[]>([
  'reunion',
  'inspection',
  'livraison',
  'deadline']
  );
  const [selectedDay, setSelectedDay] = useState<number>(TODAY);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
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
  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing('save-event');
    setTimeout(() => {
      setIsProcessing(null);
      setShowEventModal(false);
      showToast('Événement enregistré avec succès');
    }, 1500);
  };
  const handleDeleteEvent = () => {
    setIsProcessing('delete-event');
    setTimeout(() => {
      setIsProcessing(null);
      setShowDetailModal(false);
      showToast('Événement supprimé avec succès');
    }, 1500);
  };
  const toggleFilter = (id: string) => {
    if (activeFilters.includes(id)) {
      setActiveFilters(activeFilters.filter((f) => f !== id));
    } else {
      setActiveFilters([...activeFilters, id]);
    }
  };
  // March 2026 starts on Sunday (index 0)
  const daysInMonth = 31;
  const firstDayOffset = 0; // Sunday
  const calendarDays = Array.from(
    {
      length: 42
    },
    (_, i) => {
      const dayNum = i - firstDayOffset + 1;
      const isCurrentMonth = dayNum > 0 && dayNum <= daysInMonth;
      return {
        dayNum: isCurrentMonth ? dayNum : null,
        isCurrentMonth,
        isToday: dayNum === TODAY,
        events: isCurrentMonth ?
        mockEvents.filter(
          (e) => e.date === dayNum && activeFilters.includes(e.type)
        ) :
        []
      };
    }
  );
  const selectedDayEvents = mockEvents.filter(
    (e) => e.date === selectedDay && activeFilters.includes(e.type)
  );
  const upcomingEvents = mockEvents.
  filter((e) => e.date > TODAY && activeFilters.includes(e.type)).
  sort((a, b) => a.date - b.date).
  slice(0, 5);
  return (
    <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-6 relative">
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
          
            {toast.type === 'success' &&
          <CheckCircle2Icon className="w-5 h-5" />
          }
            {toast.message}
          </motion.div>
        }
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        initial={{
          opacity: 0,
          x: -20
        }}
        animate={{
          opacity: 1,
          x: 0
        }}
        className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
        
        <button
          onClick={() => setShowEventModal(true)}
          className="w-full py-3 bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
          
          <PlusIcon className="w-5 h-5" />
          Nouvel Événement
        </button>

        {/* Mini Calendar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-montserrat font-bold text-sm text-globus-blue-dark">
              Mars 2026
            </h3>
            <div className="flex gap-1">
              <button className="p-1 hover:bg-gray-100 rounded text-gray-500">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button className="p-1 hover:bg-gray-100 rounded text-gray-500">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) =>
            <div key={i} className="text-[10px] font-bold text-gray-400">
                {d}
              </div>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({
              length: 35
            }).map((_, i) => {
              const d = i + 1;
              const isValid = d >= 1 && d <= 31;
              const isToday = d === TODAY;
              const isSelected = d === selectedDay && d !== TODAY;
              const hasEvents = isValid && mockEvents.some((e) => e.date === d);
              return (
                <button
                  key={i}
                  onClick={() => isValid && setSelectedDay(d)}
                  className={`text-xs py-1.5 rounded-full relative ${!isValid ? 'text-transparent cursor-default' : isToday ? 'bg-globus-orange text-white font-bold' : isSelected ? 'bg-globus-blue-dark text-white font-bold' : 'text-gray-600 hover:bg-gray-100 cursor-pointer'}`}>
                  
                  {isValid ? d : ''}
                  {isValid && hasEvents && !isToday && !isSelected &&
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-globus-orange" />
                  }
                </button>);

            })}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-montserrat font-bold text-sm text-globus-blue-dark mb-4 flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-gray-400" />
            Filtres
          </h3>
          <div className="space-y-3">
            {eventTypes.map((type) => {
              const isActive = activeFilters.includes(type.id);
              return (
                <label
                  key={type.id}
                  className="flex items-center gap-3 cursor-pointer group">
                  
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isActive ? type.color + ' border-transparent' : 'border-gray-300 bg-white group-hover:border-gray-400'}`}
                    onClick={() => toggleFilter(type.id)}>
                    
                    {isActive &&
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}>
                      
                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7" />
                      
                      </svg>
                    }
                  </div>
                  <span className="font-opensans text-sm text-gray-700">
                    {type.label}
                  </span>
                </label>);

            })}
          </div>
        </div>

        {/* Selected Day Events */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-montserrat font-bold text-sm text-globus-blue-dark mb-3">
            {selectedDay === TODAY ? "Aujourd'hui" : `${selectedDay} Mars 2026`}
          </h3>
          {selectedDayEvents.length === 0 ?
          <p className="font-opensans text-sm text-gray-400 italic">
              Aucun événement
            </p> :

          <div className="space-y-3">
              {selectedDayEvents.map((event) => {
              const typeConfig = eventTypes.find((t) => t.id === event.type);
              if (!typeConfig) return null;
              const Icon = typeConfig.icon;
              return (
                <div
                  key={event.id}
                  onClick={() => {
                    setSelectedEvent(event);
                    setShowDetailModal(true);
                  }}
                  className={`p-3 rounded-lg border-l-4 cursor-pointer hover:opacity-80 transition-opacity ${typeConfig.border} ${typeConfig.bgLight}`}>
                  
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${typeConfig.text}`} />
                      <span className={`text-xs font-bold ${typeConfig.text}`}>
                        {event.time}
                      </span>
                    </div>
                    <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                      {event.title}
                    </p>
                    <p className="font-opensans text-xs text-gray-500 mt-1">
                      {event.location} — {event.attendees}
                    </p>
                  </div>);

            })}
            </div>
          }
        </div>
      </motion.div>

      {/* Main Calendar */}
      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
        
        {/* Calendar Header */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50/50">
          <div className="flex items-center gap-4">
            <h2 className="font-montserrat font-extrabold text-xl text-globus-blue-dark">
              Mars 2026
            </h2>
            <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
              <button className="p-1.5 hover:bg-gray-50 rounded text-gray-600">
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <button className="px-3 py-1 font-opensans text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded">
                Aujourd&apos;hui
              </button>
              <button className="p-1.5 hover:bg-gray-50 rounded text-gray-600">
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button className="px-4 py-1.5 text-sm font-semibold rounded-md bg-white text-globus-blue-dark shadow-sm">
              Mois
            </button>
            <button className="px-4 py-1.5 text-sm font-semibold rounded-md text-gray-500 hover:text-gray-700">
              Semaine
            </button>
            <button className="px-4 py-1.5 text-sm font-semibold rounded-md text-gray-500 hover:text-gray-700">
              Jour
            </button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-white">
          {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day, i) =>
          <div
            key={i}
            className="py-3 text-center border-r border-gray-100 last:border-r-0">
            
              <span className="text-xs font-montserrat font-bold text-gray-500 uppercase tracking-wider">
                {day}
              </span>
            </div>
          )}
        </div>

        {/* Days Grid */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
          {calendarDays.map((day, i) =>
          <div
            key={i}
            onClick={() => day.dayNum && setSelectedDay(day.dayNum)}
            className={`min-h-[90px] border-r border-b border-gray-100 p-1.5 cursor-pointer transition-colors ${!day.isCurrentMonth ? 'bg-gray-50/50' : day.isToday ? 'bg-orange-50/40' : 'bg-white hover:bg-gray-50/30'} ${day.dayNum === selectedDay && !day.isToday ? 'bg-blue-50/40' : ''}`}>
            
              <div className="flex justify-between items-start mb-1">
                <span
                className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${day.isToday ? 'bg-globus-orange text-white' : !day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}`}>
                
                  {day.dayNum}
                </span>
              </div>
              <div className="space-y-0.5 overflow-hidden max-h-[65px]">
                {day.events.slice(0, 2).map((event) => {
                const typeConfig = eventTypes.find((t) => t.id === event.type);
                if (!typeConfig) return null;
                return (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(event);
                      setShowDetailModal(true);
                    }}
                    className={`text-left px-1.5 py-0.5 rounded border-l-2 cursor-pointer hover:opacity-80 transition-opacity ${typeConfig.bgLight} ${typeConfig.border}`}
                    title={`${event.title}\n${event.time}\n${event.location}`}>
                    
                      <p
                      className={`text-[10px] font-bold truncate ${typeConfig.text}`}>
                      
                        {event.title}
                      </p>
                    </div>);

              })}
                {day.events.length > 2 &&
              <p className="text-[10px] font-semibold text-gray-400 pl-1">
                    +{day.events.length - 2} de plus
                  </p>
              }
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="p-3 border-t border-gray-200 bg-gray-50/50 flex flex-wrap gap-4">
          {eventTypes.map((type) =>
          <div key={type.id} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${type.color}`} />
              <span className="text-[11px] font-opensans text-gray-600">
                {type.label}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {showEventModal &&
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
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
            className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="bg-globus-blue-dark p-4 flex justify-between items-center shrink-0">
                <h3 className="text-white font-montserrat font-bold text-lg">
                  Nouvel Événement
                </h3>
                <button
                onClick={() => setShowEventModal(false)}
                className="text-white/70 hover:text-white transition-colors">
                
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <form
                id="event-form"
                onSubmit={handleSaveEvent}
                className="space-y-4">
                
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Titre
                    </label>
                    <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-globus-blue"
                    placeholder="Ex: Réunion de chantier"
                    required />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Type d'événement
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-globus-blue">
                      {eventTypes.map((t) =>
                    <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                    )}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Date
                      </label>
                      <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-globus-blue"
                      required />
                    
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Heure
                      </label>
                      <input
                      type="time"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-globus-blue"
                      required />
                    
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Lieu / Projet
                    </label>
                    <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-globus-blue"
                    placeholder="Ex: Villa Bonapriso" />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Participants
                    </label>
                    <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-globus-blue"
                    placeholder="Ex: P. Mbarga, C. Fotso" />
                  
                  </div>
                </form>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                <button
                onClick={() => setShowEventModal(false)}
                className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition-colors">
                
                  Annuler
                </button>
                <button
                form="event-form"
                disabled={isProcessing === 'save-event'}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70">
                
                  {isProcessing === 'save-event' ?
                <>
                      <Loader2Icon className="w-4 h-4 animate-spin" />{' '}
                      Enregistrement...
                    </> :

                <>
                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </>
                }
                </button>
              </div>
            </motion.div>
          </div>
        }

        {showDetailModal && selectedEvent &&
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
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
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="bg-globus-blue-dark p-4 flex justify-between items-center">
                <h3 className="text-white font-montserrat font-bold text-lg">
                  Détails de l'Événement
                </h3>
                <button
                onClick={() => setShowDetailModal(false)}
                className="text-white/70 hover:text-white transition-colors">
                
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {(() => {
                const typeConfig = eventTypes.find(
                  (t) => t.id === selectedEvent.type
                );
                const Icon = typeConfig?.icon || CalendarIcon;
                return (
                  <div className="flex items-start gap-4">
                      <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${typeConfig?.bgLight}`}>
                      
                        <Icon className={`w-6 h-6 ${typeConfig?.text}`} />
                      </div>
                      <div>
                        <h4 className="font-montserrat font-bold text-xl text-gray-900">
                          {selectedEvent.title}
                        </h4>
                        <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase mt-1 ${typeConfig?.bgLight} ${typeConfig?.text}`}>
                        
                          {typeConfig?.label}
                        </span>
                      </div>
                    </div>);

              })()}

                <div className="bg-gray-50 rounded-lg p-4 space-y-3 mt-4">
                  <div className="flex items-center gap-3 text-gray-700">
                    <CalendarIcon className="w-5 h-5 text-gray-400" />
                    <span className="font-semibold">
                      {selectedEvent.date} Mars 2026
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <ClockIcon className="w-5 h-5 text-gray-400" />
                    <span>{selectedEvent.time}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <MapPinIcon className="w-5 h-5 text-gray-400" />
                    <span>{selectedEvent.location}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <UsersIcon className="w-5 h-5 text-gray-400" />
                    <span>{selectedEvent.attendees}</span>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                <button
                onClick={handleDeleteEvent}
                disabled={isProcessing === 'delete-event'}
                className="px-4 py-2 text-red-600 font-semibold hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70">
                
                  {isProcessing === 'delete-event' ?
                <Loader2Icon className="w-4 h-4 animate-spin" /> :

                <Trash2Icon className="w-4 h-4" />
                }
                  Supprimer
                </button>
                <button
                onClick={() => {
                  setShowDetailModal(false);
                  setShowEventModal(true);
                }}
                className="px-4 py-2 bg-globus-blue-dark hover:bg-globus-blue text-white font-semibold rounded-lg transition-colors flex items-center gap-2">
                
                  <EditIcon className="w-4 h-4" /> Modifier
                </button>
              </div>
            </motion.div>
          </div>
        }
      </AnimatePresence>
    </div>);

}