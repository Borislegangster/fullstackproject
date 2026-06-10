import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellIcon, CheckCheckIcon, SettingsIcon, XIcon, AlertTriangleIcon, BoxIcon, HardHatIcon, WalletIcon, FileTextIcon, TargetIcon, ShieldAlertIcon } from 'lucide-react';
import { useNotifications, useMarkRead, useMarkAllRead } from '../../hooks/useErp';
import { formatDate } from '../../utils/datetime';
const filters = [
'Toutes',
'Urgences',
'Chantiers',
'RH',
'Finance',
'Stock',
'QHSE',
'Documents'];


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
    y: 10
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3
    }
  },
  exit: {
    opacity: 0,
    x: -50,
    transition: {
      duration: 0.2
    }
  }
};
// Map server notification type → UI icon + color
function notifVisuals(type: string, isRead: boolean) {
  const map: Record<string, { icon: any; color: string; bg: string; category: string }> = {
    invoice: { icon: WalletIcon, color: 'text-purple-600', bg: 'bg-purple-100', category: 'Finance' },
    message: { icon: BellIcon, color: 'text-blue-600', bg: 'bg-blue-100', category: 'Messages' },
    sav: { icon: ShieldAlertIcon, color: 'text-yellow-600', bg: 'bg-yellow-100', category: 'QHSE' },
    project: { icon: HardHatIcon, color: 'text-orange-600', bg: 'bg-orange-100', category: 'Chantiers' },
    appointment: { icon: TargetIcon, color: 'text-pink-600', bg: 'bg-pink-100', category: 'CRM' },
    success: { icon: BellIcon, color: 'text-green-600', bg: 'bg-green-100', category: 'Système' },
    warning: { icon: AlertTriangleIcon, color: 'text-yellow-600', bg: 'bg-yellow-100', category: 'Urgences' },
    error: { icon: AlertTriangleIcon, color: 'text-red-600', bg: 'bg-red-100', category: 'Urgences' },
    info: { icon: BellIcon, color: 'text-blue-600', bg: 'bg-blue-100', category: 'Système' },
    document: { icon: FileTextIcon, color: 'text-gray-600', bg: 'bg-gray-100', category: 'Documents' },
    stock: { icon: BoxIcon, color: 'text-orange-600', bg: 'bg-orange-100', category: 'Stock' },
  };
  const v = map[type] || map.info;
  return {
    ...v,
    color: isRead ? 'text-gray-500' : v.color,
    bg: isRead ? 'bg-gray-100' : v.bg,
  };
}

function formatRelative(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 2) return 'Hier';
  if (diff < 86400 * 7) return `Il y a ${Math.floor(diff / 86400)} jours`;
  return formatDate(d);
}

export function ErpNotifications() {
  const { data: apiNotifs } = useNotifications();
  const markReadMutation = useMarkRead();
  const markAllReadMutation = useMarkAllRead();
  const [activeFilter, setActiveFilter] = useState('Toutes');
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const notifications = useMemo(() => {
    const arr = Array.isArray(apiNotifs) ? apiNotifs : [];
    return arr
      .filter((n: any) => !dismissedIds.includes(String(n.id)))
      .map((n: any) => {
        const v = notifVisuals(n.type || 'info', n.is_read);
        return {
          id: String(n.id),
          category: v.category,
          icon: v.icon,
          color: v.color,
          bg: v.bg,
          title: n.title || '',
          desc: n.message || '',
          time: formatRelative(n.created_at),
          isRead: n.is_read ?? false,
          action: undefined as string | undefined,
        };
      });
  }, [apiNotifs, dismissedIds]);

  const filteredNotifications = notifications.filter(
    (n) =>
      activeFilter === 'Toutes' ||
      n.category === activeFilter ||
      (activeFilter === 'Urgences' && n.color === 'text-red-600')
  );
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = () => {
    if (unreadCount === 0) return;
    markAllReadMutation.mutate(undefined as any);
  };
  const dismissNotification = (id: string) => {
    setDismissedIds((prev) => [...prev, id]);
  };
  const markAsRead = (id: string) => {
    markReadMutation.mutate(id);
  };
  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <BellIcon className="w-6 h-6 text-globus-blue" />
          </div>
          <div>
            <h2 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
              Centre de Notifications
            </h2>
            <p className="font-opensans text-sm text-globus-gray mt-1">
              <span className="font-bold text-globus-blue">
                {unreadCount} non lues
              </span>{' '}
              | {notifications.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={markAllAsRead}
            className="text-sm font-semibold text-gray-600 hover:text-globus-blue flex items-center gap-1 transition-colors">
            
            <CheckCheckIcon className="w-4 h-4" /> Tout marquer comme lu
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
        {filters.map((filter) =>
        <button
          key={filter}
          onClick={() => setActiveFilter(filter)}
          className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${activeFilter === filter ? 'bg-globus-blue text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          
            {filter}
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredNotifications.length === 0 ?
        <div className="p-10 text-center">
            <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-montserrat font-bold text-gray-500">
              Aucune notification
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Vous êtes à jour dans cette catégorie.
            </p>
          </div> :

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="divide-y divide-gray-100">
          
            <AnimatePresence>
              {filteredNotifications.map((notification) => {
              const Icon = notification.icon;
              return (
                <motion.div
                  key={notification.id}
                  variants={fadeUp}
                  layout
                  className={`p-4 sm:p-5 flex gap-4 group transition-colors hover:bg-gray-50 relative ${!notification.isRead ? 'bg-blue-50/30' : ''}`}
                  onClick={() =>
                  !notification.isRead && markAsRead(notification.id)
                  }>
                  
                    {!notification.isRead &&
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-globus-blue"></div>
                  }

                    <div
                    className={`w-10 h-10 rounded-full ${notification.bg} flex items-center justify-center shrink-0`}>
                    
                      <Icon className={`w-5 h-5 ${notification.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4
                        className={`font-montserrat text-sm sm:text-base truncate ${!notification.isRead ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                        
                          {notification.title}
                        </h4>
                        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 mt-0.5">
                          {notification.time}
                        </span>
                      </div>
                      <p
                      className={`text-sm ${!notification.isRead ? 'text-gray-700' : 'text-gray-500'} mb-2`}>
                      
                        {notification.desc}
                      </p>

                      {notification.action &&
                    <button className="text-xs font-bold text-globus-blue hover:text-globus-blue-dark bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors">
                          {notification.action}
                        </button>
                    }
                    </div>

                    <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissNotification(notification.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0 self-start"
                    title="Supprimer">
                    
                      <XIcon className="w-4 h-4" />
                    </button>
                  </motion.div>);

            })}
            </AnimatePresence>
          </motion.div>
        }
      </div>
    </div>);

}