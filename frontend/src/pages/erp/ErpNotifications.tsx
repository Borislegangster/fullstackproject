import React, { useState, Children } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BellIcon,
  CheckCheckIcon,
  SettingsIcon,
  XIcon,
  AlertTriangleIcon,
  BoxIcon,
  HardHatIcon,
  UsersIcon,
  WalletIcon,
  FileTextIcon,
  ShoppingCartIcon,
  WrenchIcon,
  TargetIcon,
  ShieldAlertIcon } from
'lucide-react';
const filters = [
'Toutes',
'Urgences',
'Chantiers',
'RH',
'Finance',
'Stock',
'QHSE',
'Documents'];

const initialNotifications = [
{
  id: 1,
  category: 'Urgences',
  icon: AlertTriangleIcon,
  color: 'text-red-600',
  bg: 'bg-red-100',
  title: 'URGENT: Incident QHSE déclaré',
  desc: 'Chute échafaudage Chantier Akwa. Intervention requise immédiatement.',
  time: 'Il y a 5 min',
  isRead: false,
  action: 'Voir incident'
},
{
  id: 2,
  category: 'Stock',
  icon: BoxIcon,
  color: 'text-orange-600',
  bg: 'bg-orange-100',
  title: 'Seuil critique atteint — Ciment',
  desc: "5T restantes au dépôt central (seuil d'alerte: 10T).",
  time: 'Il y a 30 min',
  isRead: false,
  action: 'Créer DA'
},
{
  id: 3,
  category: 'Chantiers',
  icon: HardHatIcon,
  color: 'text-blue-600',
  bg: 'bg-blue-100',
  title: 'Retard signalé — Immeuble Akwa',
  desc: 'Le jalon "Élévation Murs" accuse un retard de 15 jours.',
  time: 'Il y a 1h',
  isRead: false,
  action: 'Voir planning'
},
{
  id: 4,
  category: 'RH',
  icon: UsersIcon,
  color: 'text-green-600',
  bg: 'bg-green-100',
  title: 'Pointage complété',
  desc: '45/48 ouvriers présents ce matin sur le chantier Villa Bonapriso.',
  time: 'Il y a 2h',
  isRead: false
},
{
  id: 5,
  category: 'Finance',
  icon: WalletIcon,
  color: 'text-purple-600',
  bg: 'bg-purple-100',
  title: "Facture reçue — Menuiserie Bois d'Ébène",
  desc: 'Montant: 2 500 000 FCFA. En attente de validation.',
  time: 'Il y a 3h',
  isRead: false,
  action: 'Valider'
},
{
  id: 6,
  category: 'Documents',
  icon: FileTextIcon,
  color: 'text-gray-600',
  bg: 'bg-gray-100',
  title: 'Plan V3 Architecture uploadé',
  desc: 'Nouveau plan disponible pour Villa Bonapriso par Claire Fotso.',
  time: 'Hier',
  isRead: true
},
{
  id: 7,
  category: 'Achats',
  icon: ShoppingCartIcon,
  color: 'text-teal-600',
  bg: 'bg-teal-100',
  title: 'DA-126 validée par Direction',
  desc: "La demande d'achat pour le sable et gravier a été approuvée.",
  time: 'Hier',
  isRead: true
},
{
  id: 8,
  category: 'Matériel',
  icon: WrenchIcon,
  color: 'text-indigo-600',
  bg: 'bg-indigo-100',
  title: 'Maintenance terminée',
  desc: 'Compacteur vibrant (MAT-003) de nouveau opérationnel.',
  time: 'Hier',
  isRead: true
},
{
  id: 9,
  category: 'CRM',
  icon: TargetIcon,
  color: 'text-pink-600',
  bg: 'bg-pink-100',
  title: 'Nouveau prospect — Société SABC',
  desc: "Projet d'extension d'usine estimé à 500M FCFA.",
  time: 'Il y a 2 jours',
  isRead: true
},
{
  id: 10,
  category: 'QHSE',
  icon: ShieldAlertIcon,
  color: 'text-yellow-600',
  bg: 'bg-yellow-100',
  title: 'Audit mensuel planifié',
  desc: "L'audit de sécurité est prévu pour le 25/03/2026.",
  time: 'Il y a 2 jours',
  isRead: true
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
export function ErpNotifications() {
  const [activeFilter, setActiveFilter] = useState('Toutes');
  const [notifications, setNotifications] = useState(initialNotifications);
  const filteredNotifications = notifications.filter(
    (n) =>
    activeFilter === 'Toutes' ||
    n.category === activeFilter ||
    activeFilter === 'Urgences' && n.color === 'text-red-600'
  );
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const markAllAsRead = () => {
    setNotifications(
      notifications.map((n) => ({
        ...n,
        isRead: true
      }))
    );
  };
  const dismissNotification = (id: number) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };
  const markAsRead = (id: number) => {
    setNotifications(
      notifications.map((n) =>
      n.id === id ?
      {
        ...n,
        isRead: true
      } :
      n
      )
    );
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