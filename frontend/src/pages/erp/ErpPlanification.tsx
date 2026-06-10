import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, formatDateParts } from '../../utils/datetime';
import {
  CalendarDaysIcon,
  ListChecksIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
  PlusIcon,
  UserIcon,
  ClockIcon,
  XIcon,
  Loader2Icon,
  InfoIcon } from
'lucide-react';
import { usePlanningTasks, useCreatePlanningTask, useUpdatePlanningTask, useProjects, useEmployees } from '../../hooks/useErp';
interface GanttTask {
  id: number;
  name: string;
  leftPct: number;
  widthPct: number;
  status: 'done' | 'progress' | 'upcoming' | 'late';
  pct?: number;
}
interface DailyTask {
  id: number;
  title: string;
  assignee: string;
  project: string;
  priority: 'Haute' | 'Moyenne' | 'Basse';
  time: string;
  done: boolean;
}

/** Fractional month offset of a timestamp relative to the timeline start month
 *  (so Gantt bars align exactly with the equal-width month columns). */
function monthOffset(ms: number, firstMs: number): number {
  const d = new Date(ms);
  const f = new Date(firstMs);
  const months = (d.getFullYear() - f.getFullYear()) * 12 + (d.getMonth() - f.getMonth());
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const frac = (d.getDate() - 1 + d.getHours() / 24) / daysInMonth;
  return months + frac;
}

const getBarColor = (status: string) => {
  switch (status) {
    case 'done':
      return 'bg-emerald-500';
    case 'progress':
      return 'bg-globus-orange';
    case 'late':
      return 'bg-red-500';
    default:
      return 'bg-gray-300';
  }
};
const getPriorityStyle = (p: string) => {
  switch (p) {
    case 'Haute':
      return 'bg-red-100 text-red-700';
    case 'Moyenne':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};
export function ErpPlanification() {
  // API hooks
  const { data: apiTasks } = usePlanningTasks();
  const { data: apiProjects } = useProjects();
  const { data: apiEmployees } = useEmployees();
  const createTaskMutation = useCreatePlanningTask();
  const updateTaskMutation = useUpdatePlanningTask();

  // Resolvers id → human name (no raw UUIDs in the UI)
  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    (Array.isArray(apiProjects) ? apiProjects : []).forEach((p: any) =>
      m.set(p.id, p.name || p.code || ''));
    return m;
  }, [apiProjects]);
  const employeeNameById = useMemo(() => {
    const m = new Map<string, string>();
    (Array.isArray(apiEmployees) ? apiEmployees : []).forEach((e: any) =>
      m.set(e.id, (e.full_name || `${e.first_name || ''} ${e.last_name || ''}`).trim()));
    return m;
  }, [apiEmployees]);

  // Map API planning tasks to daily-task UI shape (names resolved, not IDs)
  const liveTasks: DailyTask[] = useMemo(() => {
    if (!Array.isArray(apiTasks)) return [];
    return apiTasks.map((t: any) => ({
      id: t.id,
      title: t.name || '',
      assignee: employeeNameById.get(t.assignee_id) || t.assignee_id || '—',
      project: projectNameById.get(t.project_id) || t.project_id || '—',
      priority: t.priority === 'HIGH' ? 'Haute' : t.priority === 'LOW' ? 'Basse' : 'Moyenne',
      time: formatDate(t.start_date),
      done: t.status === 'DONE',
      raw_id: t.id,
      raw_status: t.status,
      _start: t.start_date ? new Date(t.start_date).getTime() : null,
      _end: t.end_date ? new Date(t.end_date).getTime() : null,
    } as any));
  }, [apiTasks, projectNameById, employeeNameById]);

  // « Tâches du Jour » = tâches actives aujourd'hui (chevauchant la journée).
  // Une tâche sans dates reste affichée (rien à filtrer dessus).
  const dailyTasks = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 3600 * 1000 - 1;
    return liveTasks.filter((t: any) => {
      if (t._start == null && t._end == null) return true;
      const s = t._start ?? t._end;
      const e = t._end ?? t._start;
      return s <= endOfDay && e >= startOfDay;
    });
  }, [liveTasks]);

  const projectOptions: any[] = Array.isArray(apiProjects) ? apiProjects : [];
  const employeeOptions: any[] = Array.isArray(apiEmployees) ? apiEmployees : [];

  // Real month timeline computed from the actual task date range (start of the
  // earliest task's month → end of the latest task's/today's month). No mock.
  const timeline = useMemo(() => {
    const arr = Array.isArray(apiTasks) ? apiTasks : [];
    if (arr.length === 0) return null;
    const now = Date.now();
    const starts = arr.map((t: any) => (t.start_date ? new Date(t.start_date).getTime() : now));
    const ends = arr.map((t: any) =>
      t.end_date ? new Date(t.end_date).getTime()
      : (t.start_date ? new Date(t.start_date).getTime() : now));
    const min = Math.min(...starts);
    const max = Math.max(...ends, now); // include today so the marker is in range
    const sd = new Date(min);
    const first = new Date(sd.getFullYear(), sd.getMonth(), 1);
    const ed = new Date(max);
    const last = new Date(ed.getFullYear(), ed.getMonth() + 1, 0); // end of that month
    const labels: string[] = [];
    const cur = new Date(first);
    while (cur <= last) {
      labels.push(formatDateParts(new Date(cur), { month: 'short', year: '2-digit' }));
      cur.setMonth(cur.getMonth() + 1);
    }
    return { firstMs: first.getTime(), labels };
  }, [apiTasks]);

  const monthLabels = timeline?.labels ?? [];
  const monthsCount = Math.max(monthLabels.length, 1);
  const todayPct = timeline
    ? Math.min(100, Math.max(0, monthOffset(Date.now(), timeline.firstMs) / monthsCount * 100))
    : 0;

  // Real Gantt rows — positions expressed in % of the real month timeline.
  const liveGantt: GanttTask[] = useMemo(() => {
    const arr = Array.isArray(apiTasks) ? apiTasks : [];
    if (arr.length === 0 || !timeline) return [];
    const now = Date.now();
    const count = Math.max(timeline.labels.length, 1);
    return arr.map((t: any, i: number) => {
      const s = t.start_date ? new Date(t.start_date).getTime() : timeline.firstMs;
      const e = t.end_date ? new Date(t.end_date).getTime()
        : s + (t.duration_days || 1) * 24 * 3600 * 1000;
      const status: GanttTask['status'] =
        t.status === 'DONE' ? 'done'
        : (t.status === 'IN_PROGRESS' || t.status === 'EN_COURS') ? 'progress'
        : (e < now ? 'late' : 'upcoming');
      const left = monthOffset(s, timeline.firstMs) / count * 100;
      const width = (monthOffset(e, timeline.firstMs) - monthOffset(s, timeline.firstMs)) / count * 100;
      return {
        id: i + 1,
        name: t.name || '',
        leftPct: Math.max(0, left),
        widthPct: Math.max(1.5, width),
        status,
        pct: t.progress || undefined,
      } as GanttTask;
    });
  }, [apiTasks, timeline]);

  // Today's real date for the "Tâches du Jour" header
  const todayLabel = useMemo(() => {
    const s = formatDateParts(new Date(), {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, []);

  const [activeTab, setActiveTab] = useState('gantt');
  const tasks = dailyTasks;
  // UI States
  const [assignTaskModal, setAssignTaskModal] = useState(false);
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
  const completedCount = tasks.filter((t) => t.done).length;
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
  const toggleTask = async (id: number) => {
    const task = tasks.find((t) => t.id === id);
    const rawId = (task as any)?.raw_id || String(id);
    const newStatus = task?.done ? 'IN_PROGRESS' : 'DONE';
    try {
      await updateTaskMutation.mutateAsync({ id: rawId, data: { status: newStatus } });
    } catch (err) {
      console.error(err);
    }
  };
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('assign-task');
    const form = e.target as HTMLFormElement;
    try {
      const priorityUi = (form.elements.namedItem('priority') as HTMLSelectElement).value;
      const priority = priorityUi === 'Haute' ? 'HIGH' : priorityUi === 'Basse' ? 'LOW' : 'NORMAL';
      const projectId = (form.elements.namedItem('project') as HTMLSelectElement).value
        || (Array.isArray(apiProjects) && apiProjects[0]?.id) || '';
      const startStr = (form.elements.namedItem('start_date') as HTMLInputElement).value;
      const durationDays = Math.max(
        1, parseInt((form.elements.namedItem('duration') as HTMLInputElement).value, 10) || 1);
      const start = startStr ? new Date(startStr) : new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + durationDays);
      await createTaskMutation.mutateAsync({
        project_id: projectId,
        name: (form.elements.namedItem('title') as HTMLInputElement).value,
        description: '',
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        duration_days: durationDays,
        priority,
        assignee_id: (form.elements.namedItem('assignee') as HTMLSelectElement).value || undefined,
      } as any);
      setAssignTaskModal(false);
      showToast('Tâche assignée avec succès');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'info');
    } finally {
      setProcessingId(null);
    }
  };
  const tabs = [
  {
    id: 'gantt',
    label: 'Diagramme de Gantt',
    icon: CalendarDaysIcon
  },
  {
    id: 'daily',
    label: 'Tâches du Jour',
    icon: ListChecksIcon
  }];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-montserrat font-bold text-sm transition-all ${activeTab === tab.id ? 'bg-globus-orange text-white shadow-md' : 'text-globus-gray hover:bg-globus-light hover:text-globus-blue-dark'}`}>
              
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>);

        })}
      </div>

      {/* GANTT TAB */}
      {activeTab === 'gantt' &&
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
              Planification des chantiers
            </h2>
            <select className="bg-globus-light border border-gray-200 rounded-lg px-4 py-2 font-opensans text-sm focus:outline-none focus:border-globus-orange">
              <option value="">Tous les projets</option>
              {projectOptions.map((pr) =>
              <option key={pr.id} value={pr.id}>{pr.name || pr.code}</option>
              )}
            </select>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Month Headers */}
              <div className="flex border-b border-gray-200">
                <div className="w-52 shrink-0 p-3 bg-gray-50 font-montserrat font-bold text-xs text-globus-blue-dark uppercase tracking-wider">
                  Tâche
                </div>
                <div className="flex-1 flex">
                  {monthLabels.map((m, i) =>
                <div
                  key={i}
                  className="flex-1 p-2 text-center text-xs font-montserrat font-semibold text-globus-gray border-l border-gray-100">

                      {m}
                    </div>
                )}
                </div>
              </div>

              {/* Gantt Rows */}
              <div className="relative">
                {/* Today marker — real position on the computed timeline */}
                {liveGantt.length > 0 &&
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-dashed border-red-400 z-10 pointer-events-none"
                  style={{ left: `calc(13rem + (100% - 13rem) * ${todayPct / 100})` }} />
                }

                {liveGantt.length === 0 &&
              <p className="text-sm text-gray-400 italic p-4">Aucune tâche planifiée. Créez une tâche pour alimenter le diagramme.</p>
              }
                {liveGantt.map((task, idx) =>
              <div
                key={task.id}
                className="flex items-center border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                
                    <div className="w-52 shrink-0 p-3 flex items-center gap-2">
                      {task.status === 'done' &&
                  <CheckCircle2Icon className="w-4 h-4 text-emerald-500 shrink-0" />
                  }
                      {task.status === 'progress' &&
                  <CircleDotIcon className="w-4 h-4 text-globus-orange shrink-0" />
                  }
                      {task.status === 'upcoming' &&
                  <CircleIcon className="w-4 h-4 text-gray-300 shrink-0" />
                  }
                      <span
                    className={`text-xs font-opensans font-semibold truncate ${task.status === 'upcoming' ? 'text-gray-400' : 'text-globus-blue-dark'}`}>
                    
                        {task.name}
                      </span>
                    </div>
                    <div className="flex-1 relative h-10 flex items-center">
                      {/* Background grid */}
                      <div className="absolute inset-0 flex">
                        {monthLabels.map((_, i) =>
                    <div
                      key={i}
                      className="flex-1 border-l border-gray-50">
                    </div>
                    )}
                      </div>
                      {/* Task bar */}
                      <motion.div
                    initial={{
                      width: 0
                    }}
                    animate={{
                      width: `${task.widthPct}%`
                    }}
                    transition={{
                      duration: 0.6,
                      delay: idx * 0.05
                    }}
                    className={`absolute h-6 rounded-full ${getBarColor(task.status)} shadow-sm`}
                    style={{
                      left: `${task.leftPct}%`
                    }}>
                    
                        {task.status === 'progress' && task.pct &&
                    <div className="absolute inset-0 rounded-full overflow-hidden">
                            <div
                        className="h-full bg-white/30"
                        style={{
                          width: `${100 - task.pct}%`,
                          marginLeft: 'auto'
                        }}>
                      </div>
                          </div>
                    }
                      </motion.div>
                    </div>
                  </div>
              )}
              </div>

              {/* Legend */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs font-opensans">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 rounded bg-emerald-500"></span>{' '}
                  Terminé
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 rounded bg-globus-orange"></span> En
                  cours
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 rounded bg-gray-300"></span> À venir
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0 border-t-2 border-dashed border-red-400"></span>{' '}
                  Aujourd'hui
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      }

      {/* DAILY TASKS TAB */}
      {activeTab === 'daily' &&
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}>
        
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="font-montserrat font-bold text-xl text-globus-blue-dark">
                Tâches du Jour — {todayLabel}
              </h2>
              <button
              onClick={() => setAssignTaskModal(true)}
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-5 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm shrink-0">
              
                <PlusIcon className="w-4 h-4" /> Assigner Tâche
              </button>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="font-opensans text-sm text-globus-gray">
                  {completedCount}/{tasks.length} tâches complétées
                </span>
                <span className="font-montserrat font-bold text-globus-blue-dark">
                  {tasks.length ? Math.round(completedCount / tasks.length * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                animate={{
                  width: `${tasks.length ? completedCount / tasks.length * 100 : 0}%`
                }}
                className="h-full bg-emerald-500 rounded-full"
                transition={{
                  duration: 0.4
                }} />
              
              </div>
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {tasks.length === 0 &&
              <p className="text-sm text-gray-400 italic py-6 text-center">
                Aucune tâche planifiée pour aujourd'hui.
              </p>
              }
              {tasks.map((task, idx) =>
            <motion.div
              key={task.id}
              initial={{
                opacity: 0,
                x: -10
              }}
              animate={{
                opacity: 1,
                x: 0
              }}
              transition={{
                delay: idx * 0.04
              }}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${task.done ? 'bg-gray-50 border-gray-100 opacity-70' : task.priority === 'Haute' ? 'border-red-100 bg-white' : 'border-gray-100 bg-white'}`}>
              
                  <button
                onClick={() => toggleTask(task.id)}
                className="mt-0.5 shrink-0">
                
                    {task.done ?
                <CheckCircle2Icon className="w-5 h-5 text-emerald-500" /> :

                <CircleIcon className="w-5 h-5 text-gray-300 hover:text-globus-orange transition-colors" />
                }
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                  className={`font-montserrat font-bold text-sm mb-1 ${task.done ? 'line-through text-gray-400' : 'text-globus-blue-dark'}`}>
                  
                      {task.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-opensans text-globus-gray">
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3" /> {task.assignee}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span>{task.project}</span>
                      <span className="text-gray-300">•</span>
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" /> {task.time}
                      </span>
                    </div>
                  </div>

                  <span
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold font-montserrat ${getPriorityStyle(task.priority)}`}>
                
                    {task.priority}
                  </span>
                </motion.div>
            )}
            </div>
          </div>
        </motion.div>
      }

      {/* Assign Task Modal */}
      <AnimatePresence>
        {assignTaskModal &&
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
                  <ListChecksIcon className="w-5 h-5 text-globus-orange" />{' '}
                  Assigner Tâche
                </h3>
                <button
                onClick={() => setAssignTaskModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAssignTask} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Titre de la tâche
                  </label>
                  <input
                  name="title"
                  type="text"
                  required
                  placeholder="Ex: Vérifier coffrage escalier"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Assigné à
                  </label>
                  <select
                  name="assignee"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">

                    <option value="">— Non assigné —</option>
                    {employeeOptions.map((emp) =>
                    <option key={emp.id} value={emp.id}>
                      {(emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`).trim() || emp.employee_code}
                    </option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Projet concerné
                  </label>
                  <select
                  name="project"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">
                  
                    <option value="">— Sélectionner un projet —</option>
                    {projectOptions.map((pr) =>
                    <option key={pr.id} value={pr.id}>{pr.name || pr.code}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Date de début
                  </label>
                  <input
                  name="start_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />

                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Priorité
                    </label>
                    <select
                    name="priority"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">

                      <option value="Haute">Haute</option>
                      <option value="Moyenne">Moyenne</option>
                      <option value="Basse">Basse</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                      Durée (jours)
                    </label>
                    <input
                    name="duration"
                    type="number"
                    min="1"
                    defaultValue={1}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />

                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                  <button
                  type="button"
                  onClick={() => setAssignTaskModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">
                  
                    Annuler
                  </button>
                  <button
                  type="submit"
                  disabled={processingId === 'assign-task'}
                  className="bg-globus-blue hover:bg-globus-blue/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-70">
                  
                    {processingId === 'assign-task' ?
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