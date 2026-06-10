import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { formatDateTime } from '../../utils/datetime';
import {
  BellIcon,
  WalletIcon,
  FileTextIcon,
  MessageSquareIcon,
  CheckCircle2Icon,
  HardHatIcon,
  AlertCircleIcon,
  InfoIcon,
  XIcon } from
'lucide-react';
import { useClientUser } from '../../hooks/useClientUser';
import { useClientNotifications, useMarkClientNotificationRead, useDeleteClientNotification } from '../../hooks/useClient';
const categories = [
{
  id: 'all',
  label: 'Toutes'
},
{
  id: 'unread',
  label: 'Non lues'
},
{
  id: 'chantier',     
  label: 'Chantier'
},
{
  id: 'finances',
  label: 'Finances'
},
{
  id: 'documents',
  label: 'Documents'
},
{
  id: 'messages',
  label: 'Messages'
}];

interface Notification {
  id: number;
  category: 'chantier' | 'finances' | 'documents' | 'messages' | 'system';
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
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
function notifVisuals(type: string) {
  const map: Record<string, { icon: any; color: string; bg: string; category: Notification['category'] }> = {
    invoice: { icon: WalletIcon, color: 'text-globus-orange', bg: 'bg-globus-orange/10', category: 'finances' },
    message: { icon: MessageSquareIcon, color: 'text-purple-600', bg: 'bg-purple-100', category: 'messages' },
    document: { icon: FileTextIcon, color: 'text-gray-600', bg: 'bg-gray-100', category: 'documents' },
    project: { icon: HardHatIcon, color: 'text-blue-600', bg: 'bg-blue-100', category: 'chantier' },
    appointment: { icon: CheckCircle2Icon, color: 'text-green-600', bg: 'bg-green-100', category: 'chantier' },
    success: { icon: CheckCircle2Icon, color: 'text-green-600', bg: 'bg-green-100', category: 'system' },
    warning: { icon: AlertCircleIcon, color: 'text-yellow-600', bg: 'bg-yellow-100', category: 'system' },
    error: { icon: AlertCircleIcon, color: 'text-red-600', bg: 'bg-red-100', category: 'system' },
    info: { icon: InfoIcon, color: 'text-blue-600', bg: 'bg-blue-100', category: 'system' },
  };
  return map[type] || map.info;
}

export function ClientNotifications() {
  const { data: apiNotifications } = useClientNotifications();
  const markReadMutation = useMarkClientNotificationRead();
  const deleteNotifMutation = useDeleteClientNotification();
  const clientUser = useClientUser();
  void clientUser;
  const [activeFilter, setActiveFilter] = useState('all');

  // Live notifications from API
  const notifications = React.useMemo(() => {
    if (!Array.isArray(apiNotifications)) {
      return [] as any[];
    }
    return apiNotifications
      .map((n: any) => {
        const v = notifVisuals(n.type || 'info');
        return {
          id: n.id,
          category: v.category,
          icon: v.icon,
          iconColor: v.color,
          iconBg: v.bg,
          title: n.title || '',
          description: n.message || '',
          time: formatDateTime(n.created_at),
          read: !!n.is_read,
        };
      });
  }, [apiNotifications]);

  const filteredNotifications = notifications.filter((notif) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !notif.read;
    return notif.category === activeFilter;
  });
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: number | string) => {
    markReadMutation.mutate(String(id));
  };
  const markAllAsRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => markReadMutation.mutate(String(n.id)));
  };
  const deleteNotification = (id: number | string) => {
    deleteNotifMutation.mutate(String(id));
  };
  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        <div>
          <h1 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark flex items-center gap-3">
            <BellIcon className="w-8 h-8 text-globus-orange" />
            Notifications
          </h1>
          <p className="font-opensans text-globus-gray mt-1">
            {unreadCount > 0 ?
            <>
                <strong className="text-globus-orange">{unreadCount}</strong>{' '}
                notification{unreadCount > 1 ? 's' : ''} non lue
                {unreadCount > 1 ? 's' : ''}
              </> :

            'Aucune notification non lue'
            }
          </p>
        </div>
        {unreadCount > 0 &&
        <button
          onClick={markAllAsRead}
          className="text-sm font-montserrat font-bold text-globus-blue hover:text-globus-blue-dark transition-colors">
          
            Tout marquer comme lu
          </button>
        }
      </motion.div>

      {/* Filter Chips */}
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          delay: 0.1
        }}
        className="flex flex-wrap gap-2">
        
        {categories.map((cat) => {
          const isActive = activeFilter === cat.id;
          const count =
          cat.id === 'all' ?
          notifications.length :
          cat.id === 'unread' ?
          unreadCount :
          notifications.filter((n) => n.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              className={`px-4 py-2 rounded-full font-montserrat font-bold text-sm transition-all ${isActive ? 'bg-globus-orange text-white shadow-md' : 'bg-white text-globus-gray border border-gray-200 hover:border-globus-orange hover:text-globus-orange'}`}>
              
              {cat.label}
              {count > 0 &&
              <span
                className={`ml-2 px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                
                  {count}
                </span>
              }
            </button>);

        })}
      </motion.div>

      {/* Notifications List */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="space-y-3">
        
        {filteredNotifications.length > 0 ?
        filteredNotifications.map((notif) => {
          const Icon = notif.icon;
          return (
            <motion.div
              key={notif.id}
              variants={fadeUp}
              className={`bg-white rounded-xl shadow-sm border transition-all hover:shadow-md group ${!notif.read ? 'border-globus-blue/30 bg-globus-blue/5' : 'border-gray-200'}`}>
              
                <div className="p-5 flex items-start gap-4 relative">
                  {/* Unread indicator */}
                  {!notif.read &&
                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-globus-blue"></div>
                }

                  {/* Icon */}
                  <div
                  className={`w-12 h-12 rounded-xl ${notif.iconBg} flex items-center justify-center shrink-0 ${!notif.read ? 'ml-3' : ''}`}>
                  
                    <Icon className={`w-6 h-6 ${notif.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h3
                      className={`font-montserrat font-bold text-base ${!notif.read ? 'text-globus-blue-dark' : 'text-gray-800'}`}>
                      
                        {notif.title}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-globus-gray font-opensans">
                          {notif.time}
                        </span>
                        <button
                        onClick={() => deleteNotification(notif.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                        title="Supprimer">
                        
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="font-opensans text-sm text-globus-gray mb-2">
                      {notif.description}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-600">
                        {notif.category}
                      </span>
                      {!notif.read &&
                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="text-xs font-semibold text-globus-blue hover:underline">
                      
                          Marquer comme lu
                        </button>
                    }
                    </div>
                  </div>
                </div>
              </motion.div>);

        }) :

        <motion.div
          variants={fadeUp}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          
            <BellIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2">
              Aucune notification
            </h3>
            <p className="font-opensans text-globus-gray">
              {activeFilter === 'unread' ?
            'Vous êtes à jour ! Aucune notification non lue.' :
            'Aucune notification dans cette catégorie.'}
            </p>
          </motion.div>
        }
      </motion.div>
    </div>);

}