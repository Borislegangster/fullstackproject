import React, { useState, Children } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BuildingIcon,
  UsersIcon,
  ShieldCheckIcon,
  SettingsIcon,
  UploadCloudIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  SaveIcon,
  AlertTriangleIcon,
  DownloadIcon,
  Loader2Icon,
  XIcon,
  CheckCircle2Icon } from
'lucide-react';
const tabs = [
{
  id: 'entreprise',
  label: 'Entreprise',
  icon: BuildingIcon
},
{
  id: 'utilisateurs',
  label: 'Utilisateurs',
  icon: UsersIcon
},
{
  id: 'roles',
  label: 'Rôles & Permissions',
  icon: ShieldCheckIcon
},
{
  id: 'systeme',
  label: 'Système',
  icon: SettingsIcon
}];

const users = [
{
  id: 1,
  name: 'Admin Globus',
  email: 'admin@globus-btp.com',
  role: 'Administrateur',
  dept: 'Direction',
  status: 'Actif',
  lastLogin: "Aujourd'hui"
},
{
  id: 2,
  name: 'Paul Mbarga',
  email: 'p.mbarga@globus-btp.com',
  role: 'Chef de Projet',
  dept: 'Technique',
  status: 'Actif',
  lastLogin: "Aujourd'hui"
},
{
  id: 3,
  name: 'Claire Fotso',
  email: 'c.fotso@globus-btp.com',
  role: 'Architecte',
  dept: "Bureau d'Études",
  status: 'Actif',
  lastLogin: 'Hier'
},
{
  id: 4,
  name: 'Jacques Nkoulou',
  email: 'j.nkoulou@globus-btp.com',
  role: 'Comptable',
  dept: 'Finance',
  status: 'Actif',
  lastLogin: "Aujourd'hui"
},
{
  id: 5,
  name: 'Sophie Ekambi',
  email: 's.ekambi@globus-btp.com',
  role: 'Assistante RH',
  dept: 'Administration',
  status: 'Actif',
  lastLogin: 'Hier'
},
{
  id: 6,
  name: 'Marcel Tagne',
  email: 'm.tagne@globus-btp.com',
  role: 'Magasinier',
  dept: 'Logistique',
  status: 'Inactif',
  lastLogin: 'Il y a 3 jours'
}];

const modules = [
'Dashboard',
'Ressources Humaines',
'Finances & Compta',
'Achats & Stocks',
'Planification',
'QHSE',
'Parc Matériel',
'CRM & Devis',
'Documents',
'GED Technique',
'Sous-traitants',
'Chantiers',
'Paramètres'];

const roles = [
'Administrateur',
'Chef de Projet',
'Comptable',
'RH',
'Magasinier',
'Lecture seule'];

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
  }
};
export function ErpParametres() {
  const [activeTab, setActiveTab] = useState('entreprise');
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
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
  const handleSaveCompany = () => {
    if (isEditingCompany) {
      setIsProcessing('save-company');
      setTimeout(() => {
        setIsProcessing(null);
        setIsEditingCompany(false);
        showToast("Informations de l'entreprise enregistrées");
      }, 1500);
    } else {
      setIsEditingCompany(true);
    }
  };
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing('save-user');
    setTimeout(() => {
      setIsProcessing(null);
      setShowUserModal(false);
      showToast(
        selectedUser ?
        'Utilisateur modifié avec succès' :
        'Utilisateur ajouté avec succès'
      );
    }, 1500);
  };
  const handleSaveRoles = () => {
    setIsProcessing('save-roles');
    setTimeout(() => {
      setIsProcessing(null);
      showToast('Permissions mises à jour avec succès');
    }, 1500);
  };
  const handleResetSystem = () => {
    setIsProcessing('reset-system');
    setTimeout(() => {
      setIsProcessing(null);
      setShowDangerModal(false);
      showToast("Système réinitialisé à l'état initial", 'info');
    }, 2000);
  };
  return (
    <div className="max-w-[1200px] mx-auto space-y-6 relative">
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

          <AlertTriangleIcon className="w-5 h-5" />
          }
            {toast.message}
          </motion.div>
        }
      </AnimatePresence>

      {/* Header & Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark flex items-center gap-2">
            <SettingsIcon className="w-7 h-7 text-globus-orange" />
            Paramètres & Configuration
          </h2>
          <p className="font-opensans text-sm text-globus-gray mt-1">
            Gérez les informations de l'entreprise, les accès et les préférences
            système.
          </p>
        </div>
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-montserrat font-semibold text-sm transition-colors relative whitespace-nowrap ${isActive ? 'text-globus-orange' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
                
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive &&
                <motion.div
                  layoutId="params-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-globus-orange" />

                }
              </button>);

          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'entreprise' &&
        <motion.div
          key="entreprise"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
            <motion.div
            variants={fadeUp}
            className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Informations Légales
                </h3>
                <button
                onClick={handleSaveCompany}
                disabled={isProcessing === 'save-company'}
                className="text-sm font-semibold text-globus-blue hover:text-globus-blue-dark flex items-center gap-1 disabled:opacity-70">
                
                  {isProcessing === 'save-company' ?
                <>
                      <Loader2Icon className="w-4 h-4 animate-spin" />{' '}
                      Enregistrement...
                    </> :
                isEditingCompany ?
                <>
                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </> :

                <>
                      <PencilIcon className="w-4 h-4" /> Modifier
                    </>
                }
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Raison Sociale
                  </label>
                  <input
                  type="text"
                  disabled={!isEditingCompany}
                  defaultValue="Globus Engineering SARL"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />
                
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    RCCM
                  </label>
                  <input
                  type="text"
                  disabled={!isEditingCompany}
                  defaultValue="RC/DLA/2018/B/1234"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />
                
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Numéro Identifiant Unique (NIU)
                  </label>
                  <input
                  type="text"
                  disabled={!isEditingCompany}
                  defaultValue="M021800012345A"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />
                
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Adresse Siège Social
                  </label>
                  <input
                  type="text"
                  disabled={!isEditingCompany}
                  defaultValue="Rue de la Joie, Bonapriso, Douala"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />
                
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Téléphone Principal
                  </label>
                  <input
                  type="text"
                  disabled={!isEditingCompany}
                  defaultValue="+237 233 44 55 66"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />
                
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Email Contact
                  </label>
                  <input
                  type="email"
                  disabled={!isEditingCompany}
                  defaultValue="contact@globus-btp.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />
                
                </div>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4">
                  Logo Entreprise
                </h3>
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
                  <img
                  src="/LogoGlobus.png"
                  alt="Logo"
                  className="h-12 object-contain mb-4" />
                
                  <button className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-globus-blue transition-colors">
                    <UploadCloudIcon className="w-4 h-4" /> Changer le logo
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    PNG, JPG jusqu'à 2MB
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4">
                  Préférences Comptables
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Devise par défaut
                    </label>
                    <select
                    disabled={!isEditingCompany}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue">
                    
                      <option>FCFA (XAF)</option>
                      <option>EUR (€)</option>
                      <option>USD ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Exercice Fiscal
                    </label>
                    <select
                    disabled={!isEditingCompany}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue">
                    
                      <option>1er Janvier - 31 Décembre</option>
                      <option>1er Juillet - 30 Juin</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }

        {activeTab === 'utilisateurs' &&
        <motion.div
          key="utilisateurs"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Gestion des Utilisateurs
                </h3>
                <button
                onClick={() => {
                  setSelectedUser(null);
                  setShowUserModal(true);
                }}
                className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
                
                  <PlusIcon className="w-4 h-4" /> Ajouter un utilisateur
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                      <th className="pb-3 font-semibold">Nom</th>
                      <th className="pb-3 font-semibold">Email</th>
                      <th className="pb-3 font-semibold">Rôle</th>
                      <th className="pb-3 font-semibold">Département</th>
                      <th className="pb-3 font-semibold">Statut</th>
                      <th className="pb-3 font-semibold">Dernière Connexion</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {users.map((user) =>
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 hover:bg-gray-50">
                    
                        <td className="py-3 font-medium text-gray-800 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                            {user.name.
                        split(' ').
                        map((n) => n[0]).
                        join('')}
                          </div>
                          {user.name}
                        </td>
                        <td className="py-3 text-gray-600">{user.email}</td>
                        <td className="py-3 text-gray-600 font-medium">
                          {user.role}
                        </td>
                        <td className="py-3 text-gray-600">{user.dept}</td>
                        <td className="py-3">
                          <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${user.status === 'Actif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        
                            {user.status}
                          </span>
                        </td>
                        <td className="py-3 text-gray-500 text-xs">
                          {user.lastLogin}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors"
                          title="Modifier">
                          
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                          onClick={() =>
                          showToast('Utilisateur désactivé', 'info')
                          }
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Désactiver">
                          
                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        }

        {activeTab === 'roles' &&
        <motion.div
          key="roles"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Matrice des Permissions
                </h3>
                <button
                onClick={handleSaveRoles}
                disabled={isProcessing === 'save-roles'}
                className="text-sm font-semibold text-globus-blue hover:text-globus-blue-dark flex items-center gap-1 disabled:opacity-70">
                
                  {isProcessing === 'save-roles' ?
                <>
                      <Loader2Icon className="w-4 h-4 animate-spin" />{' '}
                      Sauvegarde...
                    </> :

                <>
                      <SaveIcon className="w-4 h-4" /> Sauvegarder
                    </>
                }
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-3 font-semibold text-sm text-gray-600 w-48">
                        Modules
                      </th>
                      {roles.map((role) =>
                    <th
                      key={role}
                      className="pb-3 font-semibold text-xs text-gray-500 text-center uppercase tracking-wider">
                      
                          <div className="writing-mode-vertical sm:writing-mode-horizontal transform sm:rotate-0 -rotate-45 origin-bottom-left h-24 sm:h-auto">
                            {role}
                          </div>
                        </th>
                    )}
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {modules.map((module, idx) =>
                  <tr
                    key={module}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    
                        <td className="py-3 font-medium text-gray-800">
                          {module}
                        </td>
                        {roles.map((role, rIdx) => {
                      // Mock logic for checkboxes
                      const isAdmin = role === 'Administrateur';
                      const isProjectManager =
                      role === 'Chef de Projet' &&
                      [
                      'Dashboard',
                      'Planification',
                      'Chantiers',
                      'Documents',
                      'GED Technique'].
                      includes(module);
                      const isAccountant =
                      role === 'Comptable' &&
                      [
                      'Dashboard',
                      'Finances & Compta',
                      'Achats & Stocks'].
                      includes(module);
                      const isHR =
                      role === 'RH' &&
                      ['Dashboard', 'Ressources Humaines'].includes(
                        module
                      );
                      const isStorekeeper =
                      role === 'Magasinier' &&
                      ['Achats & Stocks', 'Parc Matériel'].includes(
                        module
                      );
                      const isReadOnly = role === 'Lecture seule';
                      const isChecked =
                      isAdmin ||
                      isProjectManager ||
                      isAccountant ||
                      isHR ||
                      isStorekeeper ||
                      isReadOnly;
                      return (
                        <td key={rIdx} className="py-3 text-center">
                              <input
                            type="checkbox"
                            defaultChecked={isChecked}
                            disabled={isAdmin || isReadOnly}
                            className="w-4 h-4 text-globus-blue rounded border-gray-300 focus:ring-globus-blue" />
                          
                            </td>);

                    })}
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        }

        {activeTab === 'systeme' &&
        <motion.div
          key="systeme"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            
              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark border-b border-gray-100 pb-3">
                Préférences Générales
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      Langue du système
                    </p>
                    <p className="text-xs text-gray-500">
                      Langue de l'interface ERP
                    </p>
                  </div>
                  <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue">
                    <option>Français</option>
                    <option>English</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      Fuseau Horaire
                    </p>
                    <p className="text-xs text-gray-500">
                      Pour l'horodatage des actions
                    </p>
                  </div>
                  <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue">
                    <option>Africa/Douala (WAT)</option>
                    <option>Europe/Paris (CET)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      Format de Date
                    </p>
                  </div>
                  <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue">
                    <option>JJ/MM/AAAA</option>
                    <option>MM/JJ/AAAA</option>
                  </select>
                </div>
              </div>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            
              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark border-b border-gray-100 pb-3">
                Sécurité & Notifications
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      Authentification à 2 facteurs (2FA)
                    </p>
                    <p className="text-xs text-gray-500">
                      Renforce la sécurité des comptes
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-globus-blue"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      Expiration de session
                    </p>
                    <p className="text-xs text-gray-500">
                      Déconnexion automatique
                    </p>
                  </div>
                  <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue">
                    <option>30 minutes</option>
                    <option>1 heure</option>
                    <option>4 heures</option>
                    <option>Jamais</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      Notifications par Email
                    </p>
                    <p className="text-xs text-gray-500">
                      Pour les alertes critiques
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                    type="checkbox"
                    defaultChecked
                    className="sr-only peer" />
                  
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-globus-blue"></div>
                  </label>
                </div>
              </div>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            
              <div>
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Sauvegarde & Export
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Téléchargez une archive complète des données de l'ERP (Base de
                  données et fichiers).
                </p>
              </div>
              <button className="bg-gray-800 hover:bg-gray-900 text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm whitespace-nowrap">
                <DownloadIcon className="w-4 h-4" /> Exporter les données
              </button>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="md:col-span-2 border-2 border-red-200 bg-red-50 rounded-xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            
              <div>
                <h3 className="font-montserrat font-bold text-lg text-red-700 flex items-center gap-2">
                  <AlertTriangleIcon className="w-5 h-5" /> Zone de Danger
                </h3>
                <p className="text-sm text-red-600 mt-1">
                  Cette action effacera toutes les données modifiées et
                  restaurera l'état initial de démonstration.
                </p>
              </div>
              <button
              onClick={() => setShowDangerModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm text-sm whitespace-nowrap">
              
                Réinitialiser le système
              </button>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}