import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityIcon, SearchIcon, FilterIcon, UserIcon, FileTextIcon, WalletIcon, HardHatIcon, ShieldAlertIcon, LogInIcon, SettingsIcon, DownloadIcon, CalendarIcon, Loader2Icon, XIcon, CheckCircle2Icon } from 'lucide-react';
import { useActivityLogs } from '../../hooks/useErp';
import { downloadCSV } from '../../utils/download';
import { formatDateTime } from '../../utils/datetime';

// Helper functions to map API data to UI
function getIconForModule(module: string) {
  const m = module.toLowerCase();
  if (m.includes('auth') || m.includes('login')) return LogInIcon;
  if (m.includes('ged') || m.includes('document')) return FileTextIcon;
  if (m.includes('chantier') || m.includes('project')) return HardHatIcon;
  if (m.includes('finance') || m.includes('invoice') || m.includes('payment')) return WalletIcon;
  if (m.includes('security') || m.includes('sécurité')) return ShieldAlertIcon;
  if (m.includes('user')) return UserIcon;
  if (m.includes('config') || m.includes('setting')) return SettingsIcon;
  return ActivityIcon;
}
function getColorForAction(action: string) {
  const a = action.toLowerCase();
  if (a.includes('delete') || a.includes('alert') || a.includes('suppr')) return 'text-red-600';
  if (a.includes('create') || a.includes('login') || a.includes('pay') || a.includes('créé')) return 'text-green-600';
  if (a.includes('update') || a.includes('modif')) return 'text-blue-600';
  return 'text-gray-600';
}
function getBgForAction(action: string) {
  const a = action.toLowerCase();
  if (a.includes('delete') || a.includes('alert') || a.includes('suppr')) return 'bg-red-100';
  if (a.includes('create') || a.includes('login') || a.includes('pay') || a.includes('créé')) return 'bg-green-100';
  if (a.includes('update') || a.includes('modif')) return 'bg-blue-100';
  return 'bg-gray-100';
}

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
export function ErpJournalActivite() {
  const { data: apiLogs } = useActivityLogs({ limit: 50 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModule, setFilterModule] = useState('Tous');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // Map API logs (no static fallback — empty state if API returns nothing)
  const displayLogs = useMemo(() => {
    const arr = Array.isArray(apiLogs) ? apiLogs : [];
    return arr.map((log: any, i: number) => ({
      id: log.id || i + 1,
      user: log.user_name || log.actor_id || 'Système',
      role: log.user_role || 'Automatique',
      action: log.action || 'Action',
      module: log.entity_type || 'Système',
      details: log.description || (log.new_value ? JSON.stringify(log.new_value) : ''),
      time: formatDateTime(log.created_at),
      ip: log.ip_address || '',
      userAgent: log.user_agent || '',
      icon: getIconForModule(log.entity_type || ''),
      color: getColorForAction(log.action || ''),
      bg: getBgForAction(log.action || ''),
    }));
  }, [apiLogs]);
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
  const handleExport = () => {
    if (filteredLogs.length === 0) {
      showToast('Aucune entrée à exporter', 'info');
      return;
    }
    setIsProcessing('export');
    try {
      downloadCSV(
        `journal-activite-${new Date().toISOString().slice(0, 10)}.csv`,
        filteredLogs,
        [
          { key: 'time', label: 'Date' },
          { key: 'user', label: 'Utilisateur' },
          { key: 'role', label: 'Rôle' },
          { key: 'module', label: 'Module' },
          { key: 'action', label: 'Action' },
          { key: 'details', label: 'Détails' },
        ],
      );
      showToast('Journal exporté avec succès');
    } catch {
      showToast("Échec de l'export", 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const filteredLogs = displayLogs.filter((log) => {
    const matchesSearch =
    log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = filterModule === 'Tous' || log.module === filterModule;
    return matchesSearch && matchesModule;
  });
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="space-y-6 max-w-[1400px] mx-auto relative">
      
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
          
            {toast.type === 'success' ?
          <CheckCircle2Icon className="w-5 h-5" /> :

          <ActivityIcon className="w-5 h-5" />
          }
            {toast.message}
          </motion.div>
        }
      </AnimatePresence>

      {/* Header */}
      <motion.div
        variants={fadeUp}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        <div>
          <h1 className="font-montserrat font-bold text-2xl text-globus-blue-dark flex items-center gap-3">
            <ActivityIcon className="w-8 h-8 text-globus-orange" />
            Journal d'Activité
          </h1>
          <p className="font-opensans text-sm text-globus-gray mt-1">
            Traçabilité et audit des actions système
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isProcessing === 'export'}
          className="bg-white border border-gray-200 text-globus-blue-dark hover:bg-gray-50 font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm disabled:opacity-70">
          
          {isProcessing === 'export' ?
          <>
              <Loader2Icon className="w-4 h-4 animate-spin" /> Exportation...
            </> :

          <>
              <DownloadIcon className="w-4 h-4" /> Exporter le journal (CSV)
            </>
          }
        </button>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <ActivityIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-globus-gray font-opensans">
                Événements (Aujourd'hui)
              </p>
              <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                145
              </p>
            </div>
          </div>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <UserIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-globus-gray font-opensans">
                Utilisateurs actifs
              </p>
              <p className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                12
              </p>
            </div>
          </div>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-red-200 bg-red-50/30 p-5">
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <ShieldAlertIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-red-600 font-bold font-opensans">
                Alertes Sécurité
              </p>
              <p className="font-montserrat font-extrabold text-2xl text-red-700">
                1
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters & Search */}
      <motion.div
        variants={fadeUp}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row gap-4">
        
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur, une action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm font-opensans focus:outline-none focus:border-globus-blue focus:ring-1 focus:ring-globus-blue/30" />
          
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm font-opensans focus:outline-none focus:border-globus-blue appearance-none">
              
              <option value="Tous">Tous les modules</option>
              <option value="Auth">Authentification</option>
              <option value="GED">GED & Documents</option>
              <option value="Chantiers">Chantiers</option>
              <option value="Finances">Finances</option>
              <option value="Sécurité">Sécurité</option>
            </select>
          </div>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select className="bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm font-opensans focus:outline-none focus:border-globus-blue appearance-none">
              <option>Aujourd'hui</option>
              <option>7 derniers jours</option>
              <option>30 derniers jours</option>
              <option>Ce mois</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Activity Timeline */}
      <motion.div
        variants={fadeUp}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        
        <div className="relative pl-4 sm:pl-8 border-l-2 border-gray-100 space-y-8">
          {filteredLogs.map((log) => {
            const Icon = log.icon;
            return (
              <div key={log.id} className="relative">
                {/* Timeline Node */}
                <div
                  className={`absolute -left-[25px] sm:-left-[41px] top-1 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center ${log.bg}`}>
                  
                  <Icon className={`w-3.5 h-3.5 ${log.color}`} />
                </div>

                {/* Content */}
                <div
                  onClick={() => {
                    setSelectedLog(log);
                    setShowDetailModal(true);
                  }}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-globus-blue/30 hover:shadow-sm transition-all cursor-pointer">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-montserrat font-bold text-globus-blue-dark">
                        {log.action}
                      </h3>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-200 text-gray-600">
                        {log.module}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 font-opensans flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {log.time}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 font-opensans mb-3">
                    {log.details}
                  </p>

                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-globus-blue-dark text-white flex items-center justify-center font-montserrat font-bold text-[10px]">
                      {log.user.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-globus-blue-dark">
                      {log.user}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">{log.role}</span>
                  </div>
                </div>
              </div>);

          })}

          {filteredLogs.length === 0 &&
          <div className="text-center py-8 text-gray-500 font-opensans">
              Aucune activité trouvée pour ces critères.
            </div>
          }
        </div>
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedLog &&
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
                  Détails de l'Activité
                </h3>
                <button
                onClick={() => setShowDetailModal(false)}
                className="text-white/70 hover:text-white transition-colors">
                
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                  <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${selectedLog.bg}`}>
                  
                    <selectedLog.icon
                    className={`w-6 h-6 ${selectedLog.color}`} />
                  
                  </div>
                  <div>
                    <h4 className="font-montserrat font-bold text-lg text-gray-900">
                      {selectedLog.action}
                    </h4>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-200 text-gray-600 mt-1">
                      Module: {selectedLog.module}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">
                      Description
                    </p>
                    <p className="text-sm text-gray-800 font-opensans mt-1">
                      {selectedLog.details}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase">
                        Utilisateur
                      </p>
                      <p className="text-sm text-gray-800 font-opensans mt-1 font-semibold">
                        {selectedLog.user}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedLog.role}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase">
                        Date & Heure
                      </p>
                      <p className="text-sm text-gray-800 font-opensans mt-1">
                        {selectedLog.time}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">
                      Informations Techniques
                    </p>
                    <div className="bg-gray-50 p-3 rounded-lg mt-1 font-mono text-xs text-gray-600">
                      <p>ID: {selectedLog.id}</p>
                      {selectedLog.ip &&
                      <p>IP: {selectedLog.ip}</p>
                      }
                      {selectedLog.userAgent &&
                      <p className="break-all">User-Agent: {selectedLog.userAgent}</p>
                      }
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-globus-blue-dark hover:bg-globus-blue text-white font-semibold rounded-lg transition-colors">
                
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        }
      </AnimatePresence>
    </motion.div>);

}