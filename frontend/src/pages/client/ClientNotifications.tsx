import React, { useState, Children } from 'react';
import { motion } from 'framer-motion';
import {
  BellIcon,
  WalletIcon,
  CameraIcon,
  FileTextIcon,
  MessageSquareIcon,
  CheckCircle2Icon,
  HardHatIcon,
  AlertCircleIcon,
  InfoIcon,
  XIcon } from
'lucide-react';
import { useClientUser } from '../../hooks/useClientUser';
import { useClientNotifications, useMarkClientNotificationRead } from '../../hooks/useClient';
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
const notificationsData: Notification[] = [
{
  id: 1,
  category: 'finances',
  icon: WalletIcon,
  iconColor: 'text-globus-orange',
  iconBg: 'bg-globus-orange/10',
  title: 'Appel de fonds #4 en attente',
  description: 'Montant : 12 750 000 FCFA. Échéance : 01/08/2024',
  time: 'Il y a 2h',
  read: false
},
{
  id: 2,
  category: 'chantier',
  icon: CameraIcon,
  iconColor: 'text-blue-600',
  iconBg: 'bg-blue-100',
  title: 'Nouvelle photo de chantier',
  description: 'Coulage dalle RDC - 5 nouvelles photos ajoutées',
  time: 'Il y a 5h',
  read: false
},
{
  id: 3,
  category: 'chantier',
  icon: CheckCircle2Icon,
  iconColor: 'text-green-600',
  iconBg: 'bg-green-100',
  title: 'Étape Fondations validée',
  description: 'Les fondations ont été validées par le bureau de contrôle',
  time: '1 jour',
  read: true
},
{
  id: 4,
  category: 'messages',
  icon: MessageSquareIcon,
  iconColor: 'text-purple-600',
  iconBg: 'bg-purple-100',
  title: 'Message de Ing. Paul Mbarga',
  description: 'Concernant le planning de la semaine prochaine',
  time: '2 jours',
  read: true
},
{
  id: 5,
  category: 'documents',
  icon: FileTextIcon,
  iconColor: 'text-gray-600',
  iconBg: 'bg-gray-100',
  title: 'Document: Plan électrique v2',
  description: 'Un nouveau document a été ajouté à votre dossier',
  time: '3 jours',
  read: true
},
{
  id: 6,
  category: 'chantier',
  icon: HardHatIcon,
  iconColor: 'text-globus-blue',
  iconBg: 'bg-globus-blue/10',
  title: 'Début élévation murs RDC',
  description: 'Les travaux de maçonnerie ont démarré ce matin',
  time: '4 jours',
  read: true
},
{
  id: 7,
  category: 'finances',
  icon: CheckCircle2Icon,
  iconColor: 'text-green-600',
  iconBg: 'bg-green-100',
  title: 'Paiement #3 confirmé',
  description: 'Votre paiement de 17 000 000 FCFA a été reçu',
  time: '5 jours',
  read: true
},
{
  id: 8,
  category: 'documents',
  icon: FileTextIcon,
  iconColor: 'text-globus-orange',
  iconBg: 'bg-globus-orange/10',
  title: 'Signature requise: Avenant #1',
  description: "Veuillez signer l'avenant budgétaire dans Documents",
  time: '6 jours',
  read: true
},
{
  id: 9,
  category: 'system',
  icon: InfoIcon,
  iconColor: 'text-blue-500',
  iconBg: 'bg-blue-50',
  title: 'Bienvenue sur votre espace client',
  description: 'Découvrez toutes les fonctionnalités de votre portail',
  time: '1 semaine',
  read: true
},
{
  id: 10,
  category: 'chantier',
  icon: AlertCircleIcon,
  iconColor: 'text-yellow-600',
  iconBg: 'bg-yellow-100',
  title: 'Météo: Pluie prévue demain',
  description: 'Les travaux extérieurs pourraient être reportés',
  time: '1 semaine',
  read: true
},
{
  id: 11,
  category: 'messages',
  icon: MessageSquareIcon,
  iconColor: 'text-purple-600',
  iconBg: 'bg-purple-100',
  title: 'Message de Mme. Claire Fotso',
  description: 'Choix des finitions - rendez-vous proposé',
  time: '2 semaines',
  read: true
},
{
  id: 12,
  category: 'finances',
  icon: FileTextIcon,
  iconColor: 'text-gray-600',
  iconBg: 'bg-gray-100',
  title: 'Facture #2 disponible',
  description: "Votre facture est disponible dans l'onglet Finances",
  time: '2 semaines',
  read: true
}];

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
export function ClientNotifications() {
  const { data: apiNotifications } = useClientNotifications();
  const markReadMutation = useMarkClientNotificationRead();
  const clientUser = useClientUser();
  const [activeFilter, setActiveFilter] = useState('all');
  const [notifications, setNotifications] = useState(notificationsData);
  const filteredNotifications = notifications.filter((notif) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !notif.read;
    return notif.category === activeFilter;
  });
  const unreadCount = notifications.filter((n) => !n.read).length;
  const markAsRead = (id: number) => {
    setNotifications((prev) =>
    prev.map((n) =>
    n.id === id ?
    {
      ...n,
      read: true
    } :
    n
    )
    );
  };
  const markAllAsRead = () => {
    setNotifications((prev) =>
    prev.map((n) => ({
      ...n,
      read: true
    }))
    );
  };
  const deleteNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
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