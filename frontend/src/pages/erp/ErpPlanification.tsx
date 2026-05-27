import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { usePlanningTasks, useCreatePlanningTask } from '../../hooks/useErp';
interface GanttTask {
  id: number;
  name: string;
  start: number;
  duration: number;
  status: 'done' | 'progress' | 'upcoming' | 'late';
  dep: number | null;
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
const ganttTasks: GanttTask[] = [
{
  id: 1,
  name: 'Études & Conception',
  start: 0,
  duration: 2,
  status: 'done',
  dep: null
},
{
  id: 2,
  name: 'Terrassement',
  start: 2,
  duration: 1,
  status: 'done',
  dep: 1
},
{
  id: 3,
  name: 'Fondations',
  start: 3,
  duration: 2,
  status: 'done',
  dep: 2
},
{
  id: 4,
  name: 'Élévation Murs RDC',
  start: 5,
  duration: 2,
  status: 'progress',
  dep: 3,
  pct: 60
},
{
  id: 5,
  name: 'Plancher Haut RDC',
  start: 7,
  duration: 1,
  status: 'upcoming',
  dep: 4
},
{
  id: 6,
  name: 'Élévation R+1',
  start: 8,
  duration: 1.5,
  status: 'upcoming',
  dep: 5
},
{
  id: 7,
  name: "Mise Hors d'Eau",
  start: 9.5,
  duration: 1.5,
  status: 'upcoming',
  dep: 6
},
{
  id: 8,
  name: 'Plomberie & Électricité',
  start: 11,
  duration: 2,
  status: 'upcoming',
  dep: 7
},
{
  id: 9,
  name: 'Finitions',
  start: 13,
  duration: 1,
  status: 'upcoming',
  dep: 8
},
{
  id: 10,
  name: 'Livraison',
  start: 14,
  duration: 0.5,
  status: 'upcoming',
  dep: 9
}];

const months = [
'Jan',
'Fév',
'Mar',
'Avr',
'Mai',
'Jun',
'Jul',
'Aoû',
'Sep',
'Oct',
'Nov',
'Déc',
'Jan 25',
'Fév 25',
'Mar 25'];

const todayPosition = 6.7;
const initialDailyTasks: DailyTask[] = [
{
  id: 1,
  title: 'Couler la dalle R+1',
  assignee: 'Paul Mbarga',
  project: 'Villa Bonapriso',
  priority: 'Haute',
  time: '4h',
  done: true
},
{
  id: 2,
  title: 'Réceptionner ferraille',
  assignee: 'Alain Messi',
  project: 'Villa Bonapriso',
  priority: 'Haute',
  time: '1h',
  done: true
},
{
  id: 3,
  title: 'Vérifier coffrage escalier',
  assignee: 'Paul Mbarga',
  project: 'Immeuble Akwa',
  priority: 'Moyenne',
  time: '2h',
  done: false
},
{
  id: 4,
  title: 'Commander ciment 20T',
  assignee: 'Jacques Nkoulou',
  project: 'Tous projets',
  priority: 'Haute',
  time: '30min',
  done: false
},
{
  id: 5,
  title: 'Briefing sécurité hebdo',
  assignee: 'Chef chantier',
  project: 'Résidence Bonanjo',
  priority: 'Moyenne',
  time: '15min',
  done: false
},
{
  id: 6,
  title: 'Valider situation sous-traitant',
  assignee: 'Claire Fotso',
  project: 'Villa Bonapriso',
  priority: 'Basse',
  time: '1h',
  done: false
},
{
  id: 7,
  title: 'Mettre à jour plans V3',
  assignee: "Bureau d'études",
  project: 'Entrepôt Bonabéri',
  priority: 'Moyenne',
  time: '2h',
  done: false
},
{
  id: 8,
  title: 'Préparer paie mensuelle',
  assignee: 'Sophie Ekambi',
  project: 'Administration',
  priority: 'Haute',
  time: '3h',
  done: false
}];

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
  const createTaskMutation = useCreatePlanningTask();

  const [activeTab, setActiveTab] = useState('gantt');
  const [tasks, setTasks] = useState<DailyTask[]>(initialDailyTasks);
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
  const toggleTask = (id: number) => {
    setTasks((prev) =>
    prev.map((t) =>
    t.id === id ?
    {
      ...t,
      done: !t.done
    } :
    t
    )
    );
  };
  const handleAssignTask = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('assign-task');
    setTimeout(() => {
      const form = e.target as HTMLFormElement;
      const newTask: DailyTask = {
        id: Math.floor(Math.random() * 10000),
        title: (form.elements.namedItem('title') as HTMLInputElement).value,
        assignee: (form.elements.namedItem('assignee') as HTMLInputElement).value,
        project: (form.elements.namedItem('project') as HTMLSelectElement).value,
        priority: (form.elements.namedItem('priority') as HTMLSelectElement).value as 'Haute' | 'Moyenne' | 'Basse',
        time: (form.elements.namedItem('time') as HTMLInputElement).value,
        done: false
      };
      setTasks([newTask, ...tasks]);
      setProcessingId(null);
      setAssignTaskModal(false);
      showToast('Tâche assignée avec succès');
    }, 1500);
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
              Planification — Villa Moderne Bonapriso
            </h2>
            <select className="bg-globus-light border border-gray-200 rounded-lg px-4 py-2 font-opensans text-sm focus:outline-none focus:border-globus-orange">
              <option>Villa Moderne Bonapriso</option>
              <option>Immeuble Akwa</option>
              <option>Résidence Bonanjo</option>
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
                  {months.map((m, i) =>
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
                {/* Today marker */}
                <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{
                  left: `calc(13rem + ${todayPosition / 15 * 100}% * (1 - 13rem / 100%))`
                }}>
                
                  <div
                  className="absolute border-l-2 border-dashed border-red-400 h-full"
                  style={{
                    left: `${todayPosition / months.length * 100}%`,
                    marginLeft: '13rem'
                  }}>
                </div>
                </div>

                {ganttTasks.map((task, idx) =>
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
                        {months.map((_, i) =>
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
                      width: `${task.duration / 15 * 100}%`
                    }}
                    transition={{
                      duration: 0.6,
                      delay: idx * 0.05
                    }}
                    className={`absolute h-6 rounded-full ${getBarColor(task.status)} shadow-sm`}
                    style={{
                      left: `${task.start / 15 * 100}%`
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
                Tâches du Jour — Lundi 23 Mars 2026
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
                  {Math.round(completedCount / tasks.length * 100)}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                animate={{
                  width: `${completedCount / tasks.length * 100}%`
                }}
                className="h-full bg-emerald-500 rounded-full"
                transition={{
                  duration: 0.4
                }} />
              
              </div>
            </div>

            {/* Task List */}
            <div className="space-y-3">
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
                  <input
                  name="assignee"
                  type="text"
                  required
                  placeholder="Ex: Paul Mbarga"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-bold text-globus-blue-dark mb-1">
                    Projet concerné
                  </label>
                  <select
                  name="project"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 outline-none">
                  
                    <option value="Villa Bonapriso">Villa Bonapriso</option>
                    <option value="Immeuble Akwa">Immeuble Akwa</option>
                    <option value="Résidence Bonanjo">Résidence Bonanjo</option>
                    <option value="Entrepôt Bonabéri">Entrepôt Bonabéri</option>
                    <option value="Tous projets">Tous projets</option>
                    <option value="Administration">Administration</option>
                  </select>
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
                      Temps estimé
                    </label>
                    <input
                    name="time"
                    type="text"
                    required
                    placeholder="Ex: 2h"
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