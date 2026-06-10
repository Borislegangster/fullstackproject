import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateParts } from '../../utils/datetime';
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
import { useEvents, useCreateEvent, useConfirmAppointment } from '../../hooks/useErp';
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
  month: number;
  year: number;
  time: string;
  location: string;
  attendees: string;
  status?: string;
}
function eventTypeFromTitle(title: string): string {
  const t = (title || '').toLowerCase();
  if (t.includes('inspection') || t.includes('qhse')) return 'inspection';
  if (t.includes('livraison')) return 'livraison';
  if (t.includes('deadline') || t.includes('échéance')) return 'deadline';
  return 'reunion';
}

export function ErpAgenda() {
  // API hooks
  const { data: apiEvents } = useEvents();
  const createEventMutation = useCreateEvent();
  const confirmEventMutation = useConfirmAppointment();

  // Calendar view = current month/year (no hardcoded reference month).
  const _now = new Date();
  const viewYear = _now.getFullYear();
  const viewMonth = _now.getMonth(); // 0-11
  const TODAY = _now.getDate();
  const monthLabel = formatDateParts(_now, { month: 'long', year: 'numeric' });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOffset = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday

  // Map API appointments → UI events
  const liveEvents: CalendarEvent[] = useMemo(() => {
    if (!Array.isArray(apiEvents)) return [];
    return apiEvents.map((a: any) => {
      const startDate = a.start_time ? new Date(a.start_time) : new Date();
      const endDate = a.end_time ? new Date(a.end_time) : startDate;
      const sameDayTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')} - ${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
      return {
        id: a.id,
        title: a.title || '',
        type: eventTypeFromTitle(a.title),
        date: startDate.getDate(),
        month: startDate.getMonth(),
        year: startDate.getFullYear(),
        time: sameDayTime,
        location: a.location || '',
        attendees: Array.isArray(a.attendees) ? a.attendees.join(', ') : '',
        status: a.status || '',
      } as CalendarEvent;
    });
  }, [apiEvents]);

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
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing('save-event');
    const form = e.target as HTMLFormElement;
    try {
      const dateStr = (form.elements.namedItem('date') as HTMLInputElement)?.value;
      const timeStart = (form.elements.namedItem('timeStart') as HTMLInputElement)?.value || '09:00';
      const timeEnd = (form.elements.namedItem('timeEnd') as HTMLInputElement)?.value || '10:00';
      const dateBase = dateStr ? new Date(`${dateStr}T${timeStart}`) : new Date();
      const dateEnd = dateStr ? new Date(`${dateStr}T${timeEnd}`) : new Date(dateBase.getTime() + 60 * 60 * 1000);
      await createEventMutation.mutateAsync({
        title: (form.elements.namedItem('title') as HTMLInputElement).value,
        description: (form.elements.namedItem('description') as HTMLTextAreaElement)?.value || '',
        location: (form.elements.namedItem('location') as HTMLInputElement)?.value || '',
        start_time: dateBase.toISOString(),
        end_time: dateEnd.toISOString(),
      });
      setShowEventModal(false);
      showToast('Événement enregistré avec succès');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleDeleteEvent = async () => {
    setIsProcessing('delete-event');
    // No delete endpoint yet for agenda; cancel via /agenda/appointments/{id}/cancel.
    try {
      // Could call agendaApi.cancelAppointment but we don't expose its hook here.
      // For now we just close the modal — when /agenda/appointments DELETE is added (Phase 4), wire it.
      setShowDetailModal(false);
      showToast('Événement marqué comme à supprimer (suppression définitive en Phase 4)', 'info');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleConfirmEvent = async () => {
    if (!selectedEvent) return;
    setIsProcessing('confirm-event');
    try {
      await confirmEventMutation.mutateAsync(String(selectedEvent.id));
      setShowDetailModal(false);
      showToast('Rendez-vous confirmé', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const toggleFilter = (id: string) => {
    if (activeFilters.includes(id)) {
      setActiveFilters(activeFilters.filter((f) => f !== id));
    } else {
      setActiveFilters([...activeFilters, id]);
    }
  };
  const inView = (e: CalendarEvent) => e.month === viewMonth && e.year === viewYear;
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
        liveEvents.filter(
          (e) => e.date === dayNum && inView(e) && activeFilters.includes(e.type)
        ) :
        []
      };
    }
  );
  const selectedDayEvents = liveEvents.filter(
    (e) => e.date === selectedDay && inView(e) && activeFilters.includes(e.type)
  );
  const upcomingEvents = liveEvents.
  filter((e) => new Date(e.year, e.month, e.date) > _now && activeFilters.includes(e.type)).
  sort((a, b) => new Date(a.year, a.month, a.date).getTime() - new Date(b.year, b.month, b.date).getTime()).
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
              {monthLabelCap}
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
              const hasEvents = isValid && liveEvents.some((e) => e.date === d && inView(e));
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
            {selectedDay === TODAY ? "Aujourd'hui" : `${selectedDay} ${monthLabelCap}`}
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

        {/* Upcoming events */}
        {upcomingEvents.length > 0 &&
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-montserrat font-bold text-sm text-globus-blue-dark mb-3">
            Prochains événements
          </h3>
          <div className="space-y-2">
            {upcomingEvents.map((event) =>
          <div
            key={event.id}
            onClick={() => {
              setSelectedEvent(event);
              setShowDetailModal(true);
            }}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">

                <span className="w-2 h-2 rounded-full bg-globus-orange shrink-0" />
                <span className="text-xs font-bold text-globus-blue-dark whitespace-nowrap">
                  {event.date} {formatDateParts(new Date(event.year, event.month, 1), { month: 'short' })}
                </span>
                <span className="text-xs text-gray-600 truncate">{event.title}</span>
              </div>
          )}
          </div>
        </div>
        }
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
              {monthLabelCap}
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
                    placeholder="Lieu de l'événement" />
                  
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
                      {selectedEvent.date} {formatDateParts(new Date(selectedEvent.year, selectedEvent.month, 1), { month: 'long', year: 'numeric' })}
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
                {selectedEvent.status === 'PENDING' &&
                <button
                onClick={handleConfirmEvent}
                disabled={isProcessing === 'confirm-event'}
                className="px-4 py-2 text-green-700 font-semibold hover:bg-green-50 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70">

                  {isProcessing === 'confirm-event' ?
                <Loader2Icon className="w-4 h-4 animate-spin" /> :
                <CheckCircle2Icon className="w-4 h-4" />}
                  Confirmer
                </button>
                }
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