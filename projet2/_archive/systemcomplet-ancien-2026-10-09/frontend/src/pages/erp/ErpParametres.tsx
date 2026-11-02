import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BuildingIcon, UsersIcon, ShieldCheckIcon, SettingsIcon, UploadCloudIcon, PlusIcon, PencilIcon, Trash2Icon, SaveIcon, AlertTriangleIcon, DownloadIcon, Loader2Icon, CheckCircle2Icon, MailIcon, KeyRoundIcon, XIcon } from 'lucide-react';
import {
  useUsers, useCreateUser, useUpdateUser, useDeleteUser,
  useResendInvitation, useForceResetPassword,
  useCompanySettings, useUpdateCompanySettings,
} from '../../hooks/useErp';
import { TwoFactorPanel } from '../../components/auth/TwoFactorPanel';
import { SessionsPanel } from '../../components/auth/SessionsPanel';
import { mediaApi } from '../../services/api/admin.api';
import { downloadAuthedFile } from '../../utils/download';
import { formatDateTime } from '../../utils/datetime';
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
function roleToUi(role: string): string {
  switch (role) {
    case 'ADMIN': return 'Administrateur';
    case 'CHEF_PROJET': return 'Chef de Projet';
    case 'COMPTABLE': return 'Comptable';
    case 'RH': return 'RH';
    case 'CLIENT': return 'Client';
    default: return role;
  }
}
function uiToRole(uiRole: string): string {
  switch (uiRole) {
    case 'Administrateur': return 'ADMIN';
    case 'Chef de Projet': return 'CHEF_PROJET';
    case 'Comptable': return 'COMPTABLE';
    case 'RH': return 'RH';
    case 'Lecture seule': return 'CLIENT';
    case 'Magasinier': return 'CHEF_PROJET';
    default: return 'CLIENT';
  }
}

export function ErpParametres() {
  // API hooks
  const { data: apiUsers } = useUsers();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const resendInvitationMutation = useResendInvitation();
  const forceResetPasswordMutation = useForceResetPassword();

  const users = useMemo(() => {
    if (!Array.isArray(apiUsers)) return [] as any;
    return apiUsers.map((u: any) => ({
      id: u.id,
      name: u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.email,
      email: u.email,
      role: roleToUi(u.role),
      dept: '',
      status: u.is_active ? 'Actif' : 'Inactif',
      lastLogin: formatDateTime(u.last_login_at, 'Jamais'),
      mustChange: u.must_change_password,
    }));
  }, [apiUsers]);

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
  const { data: companySettings } = useCompanySettings();
  const updateCompanyMutation = useUpdateCompanySettings();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [companyForm, setCompanyForm] = useState({
    company_name: '', rc_number: '', tax_id: '', address: '', phone: '', email: '', vat_rate: '',
    default_currency: 'FCFA (XAF)', fiscal_year: '1er Janvier - 31 Décembre',
  });
  useEffect(() => {
    if (companySettings) {
      setCompanyForm({
        company_name: (companySettings as any).company_name || '',
        rc_number: (companySettings as any).rc_number || '',
        tax_id: (companySettings as any).tax_id || '',
        address: (companySettings as any).address || '',
        phone: (companySettings as any).phone || '',
        email: (companySettings as any).email || '',
        vat_rate: (companySettings as any).vat_rate != null ? String((companySettings as any).vat_rate) : '',
        default_currency: (companySettings as any).default_currency || 'FCFA (XAF)',
        fiscal_year: (companySettings as any).fiscal_year || '1er Janvier - 31 Décembre',
      });
    }
  }, [companySettings]);
  // ── Préférences système (persistées dans /admin/cms/settings) ──
  const [systemForm, setSystemForm] = useState({
    system_language: 'Français',
    timezone: 'Africa/Douala (WAT)',
    date_format: 'JJ/MM/AAAA',
    session_timeout: '30 minutes',
    email_notifications: true,
    enforce_2fa: false,
  });
  useEffect(() => {
    if (companySettings) {
      const s = companySettings as any;
      setSystemForm({
        system_language: s.system_language || 'Français',
        timezone: s.timezone || 'Africa/Douala (WAT)',
        date_format: s.date_format || 'JJ/MM/AAAA',
        session_timeout: s.session_timeout || '30 minutes',
        email_notifications: s.email_notifications !== false,
        enforce_2fa: !!s.enforce_2fa,
      });
    }
  }, [companySettings]);
  // ── Role permission matrix (persisted in /admin/cms/settings.role_permissions) ──
  const defaultPermMatrix = useMemo(() => {
    const m: Record<string, Record<string, boolean>> = {};
    for (const role of roles) {
      m[role] = {};
      for (const module of modules) {
        let allowed = false;
        if (role === 'Administrateur' || role === 'Lecture seule') allowed = true;
        else if (role === 'Chef de Projet')
          allowed = ['Dashboard', 'Planification', 'Chantiers', 'Documents', 'GED Technique'].includes(module);
        else if (role === 'Comptable')
          allowed = ['Dashboard', 'Finances & Compta', 'Achats & Stocks'].includes(module);
        else if (role === 'RH') allowed = ['Dashboard', 'Ressources Humaines'].includes(module);
        else if (role === 'Magasinier')
          allowed = ['Achats & Stocks', 'Parc Matériel'].includes(module);
        m[role][module] = allowed;
      }
    }
    return m;
  }, []);
  const [permMatrix, setPermMatrix] = useState<Record<string, Record<string, boolean>>>(defaultPermMatrix);
  useEffect(() => {
    const saved = (companySettings as any)?.role_permissions;
    if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
      setPermMatrix(saved);
    }
  }, [companySettings]);
  const togglePerm = (role: string, module: string) => {
    setPermMatrix((prev) => ({
      ...prev,
      [role]: { ...(prev[role] || {}), [module]: !prev[role]?.[module] },
    }));
  };
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
  const handleSaveCompany = async () => {
    if (!isEditingCompany) {
      setIsEditingCompany(true);
      return;
    }
    setIsProcessing('save-company');
    try {
      await updateCompanyMutation.mutateAsync({
        ...companyForm,
        vat_rate: companyForm.vat_rate.trim() === '' ? undefined : Number(companyForm.vat_rate),
      });
      setIsEditingCompany(false);
      showToast("Informations de l'entreprise enregistrées");
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing('save-user');
    const form = e.target as HTMLFormElement;
    try {
      const fullName = (form.elements.namedItem('name') as HTMLInputElement)?.value || '';
      const [first, ...rest] = fullName.split(' ');
      const role = uiToRole((form.elements.namedItem('role') as HTMLSelectElement)?.value || 'CLIENT');
      if (selectedUser?.id) {
        await updateUserMutation.mutateAsync({
          id: String(selectedUser.id),
          data: {
            first_name: first || fullName,
            last_name: rest.join(' '),
            phone: (form.elements.namedItem('phone') as HTMLInputElement)?.value || '',
            role,
          },
        });
        showToast('Utilisateur modifié avec succès');
      } else {
        await createUserMutation.mutateAsync({
          email: (form.elements.namedItem('email') as HTMLInputElement)?.value || '',
          first_name: first || fullName,
          last_name: rest.join(' '),
          phone: (form.elements.namedItem('phone') as HTMLInputElement)?.value || '',
          role,
        });
        showToast('Utilisateur invité par email');
      }
      setShowUserModal(false);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleDeleteUser = async (userId: string) => {
    setIsProcessing(`delete-${userId}`);
    try {
      await deleteUserMutation.mutateAsync(userId);
      showToast('Utilisateur désactivé', 'info');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleResendInvitation = async (userId: string) => {
    setIsProcessing(`invite-${userId}`);
    try {
      await resendInvitationMutation.mutateAsync(userId);
      showToast('Invitation renvoyée', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleForceReset = async (userId: string) => {
    setIsProcessing(`reset-${userId}`);
    try {
      await forceResetPasswordMutation.mutateAsync(userId);
      showToast('Email de réinitialisation envoyé', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleSaveRoles = async () => {
    setIsProcessing('save-roles');
    try {
      await updateCompanyMutation.mutateAsync({ role_permissions: permMatrix } as any);
      showToast('Matrice des permissions enregistrée');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleSaveSystem = async () => {
    setIsProcessing('save-system');
    try {
      await updateCompanyMutation.mutateAsync({ ...systemForm } as any);
      showToast('Préférences système enregistrées');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Erreur', 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleExportData = async () => {
    setIsProcessing('export');
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadAuthedFile('/admin/cms/export', `globus-export-${stamp}.zip`);
      showToast('Export téléchargé');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || "Échec de l'export", 'error');
    } finally {
      setIsProcessing(null);
    }
  };
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing('logo');
    try {
      const media = await mediaApi.upload(file, file.name, 'branding');
      await updateCompanyMutation.mutateAsync({ logo: (media as any).url } as any);
      showToast('Logo mis à jour');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || "Échec de l'upload du logo", 'error');
    } finally {
      setIsProcessing(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };
  const handleResetSystem = () => {
    setShowDangerModal(false);
    showToast('Réinitialisation du système indisponible.', 'info');
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
                  value={companyForm.company_name}
                  onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />
                
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    RCCM
                  </label>
                  <input
                  type="text"
                  disabled={!isEditingCompany}
                  value={companyForm.rc_number}
                  onChange={(e) => setCompanyForm({ ...companyForm, rc_number: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />
                
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Numéro Identifiant Unique (NIU)
                  </label>
                  <input
                  type="text"
                  disabled={!isEditingCompany}
                  value={companyForm.tax_id}
                  onChange={(e) => setCompanyForm({ ...companyForm, tax_id: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />

                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Taux de TVA (%)
                  </label>
                  <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!isEditingCompany}
                  value={companyForm.vat_rate}
                  onChange={(e) => setCompanyForm({ ...companyForm, vat_rate: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />

                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Adresse Siège Social
                  </label>
                  <input
                  type="text"
                  disabled={!isEditingCompany}
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />
                
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Téléphone Principal
                  </label>
                  <input
                  type="text"
                  disabled={!isEditingCompany}
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 disabled:opacity-70 focus:outline-none focus:border-globus-blue" />
                
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Email Contact
                  </label>
                  <input
                  type="email"
                  disabled={!isEditingCompany}
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
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
                  src={(companySettings as any)?.logo || '/LogoGlobus.png'}
                  alt="Logo"
                  className="h-12 object-contain mb-4" />

                  <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoChange}
                  className="hidden" />
                  <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isProcessing === 'logo'}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-globus-blue transition-colors disabled:opacity-60">
                    {isProcessing === 'logo' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :
                  <UploadCloudIcon className="w-4 h-4" />}
                    Changer le logo
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
                    value={companyForm.default_currency}
                    onChange={(e) => setCompanyForm({ ...companyForm, default_currency: e.target.value })}
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
                    value={companyForm.fiscal_year}
                    onChange={(e) => setCompanyForm({ ...companyForm, fiscal_year: e.target.value })}
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
                    {users.map((user: any) =>
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 hover:bg-gray-50">

                        <td className="py-3 font-medium text-gray-800 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                            {String(user.name).
                        split(' ').
                        map((n: string) => n[0]).
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
                          onClick={() => handleResendInvitation(String(user.id))}
                          disabled={isProcessing === `invite-${user.id}`}
                          className="p-1.5 text-gray-400 hover:text-globus-orange hover:bg-orange-50 rounded transition-colors disabled:opacity-50"
                          title="Renvoyer l'invitation">
                              {isProcessing === `invite-${user.id}` ?
                          <Loader2Icon className="w-4 h-4 animate-spin" /> :
                          <MailIcon className="w-4 h-4" />}
                            </button>
                            <button
                          onClick={() => handleForceReset(String(user.id))}
                          disabled={isProcessing === `reset-${user.id}`}
                          className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                          title="Réinitialiser le mot de passe">
                              {isProcessing === `reset-${user.id}` ?
                          <Loader2Icon className="w-4 h-4 animate-spin" /> :
                          <KeyRoundIcon className="w-4 h-4" />}
                            </button>
                            <button
                          onClick={() => handleDeleteUser(String(user.id))}
                          disabled={isProcessing === `delete-${user.id}`}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Désactiver">
                              {isProcessing === `delete-${user.id}` ?
                          <Loader2Icon className="w-4 h-4 animate-spin" /> :
                          <Trash2Icon className="w-4 h-4" />}
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
                      // Real, persisted permission matrix (Administrateur = accès complet).
                      const isAdmin = role === 'Administrateur';
                      const isChecked = isAdmin ? true : !!permMatrix[role]?.[module];
                      return (
                        <td key={rIdx} className="py-3 text-center">
                              <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePerm(role, module)}
                            disabled={isAdmin}
                            className="w-4 h-4 text-globus-blue rounded border-gray-300 focus:ring-globus-blue disabled:opacity-60" />

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
          className="space-y-6">

            <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TwoFactorPanel />
              <SessionsPanel />
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">

              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Préférences Générales
                </h3>
                <button
                onClick={handleSaveSystem}
                disabled={isProcessing === 'save-system'}
                className="text-sm font-semibold text-globus-blue hover:text-globus-blue-dark flex items-center gap-1 disabled:opacity-70">
                  {isProcessing === 'save-system' ?
                <><Loader2Icon className="w-4 h-4 animate-spin" /> Sauvegarde...</> :
                <><SaveIcon className="w-4 h-4" /> Sauvegarder</>}
                </button>
              </div>

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
                  <select
                  value={systemForm.system_language}
                  onChange={(e) => setSystemForm({ ...systemForm, system_language: e.target.value })}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue">
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
                  <select
                  value={systemForm.timezone}
                  onChange={(e) => setSystemForm({ ...systemForm, timezone: e.target.value })}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue">
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
                  <select
                  value={systemForm.date_format}
                  onChange={(e) => setSystemForm({ ...systemForm, date_format: e.target.value })}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue">
                    <option>JJ/MM/AAAA</option>
                    <option>MM/JJ/AAAA</option>
                  </select>
                </div>
              </div>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Sécurité & Notifications
                </h3>
                <button
                onClick={handleSaveSystem}
                disabled={isProcessing === 'save-system'}
                className="text-sm font-semibold text-globus-blue hover:text-globus-blue-dark flex items-center gap-1 disabled:opacity-70">
                  {isProcessing === 'save-system' ?
                <><Loader2Icon className="w-4 h-4 animate-spin" /> Sauvegarde...</> :
                <><SaveIcon className="w-4 h-4" /> Sauvegarder</>}
                </button>
              </div>

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
                    <input
                    type="checkbox"
                    checked={systemForm.enforce_2fa}
                    onChange={(e) => setSystemForm({ ...systemForm, enforce_2fa: e.target.checked })}
                    className="sr-only peer" />
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
                  <select
                  value={systemForm.session_timeout}
                  onChange={(e) => setSystemForm({ ...systemForm, session_timeout: e.target.value })}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue">
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
                    checked={systemForm.email_notifications}
                    onChange={(e) => setSystemForm({ ...systemForm, email_notifications: e.target.checked })}
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
              <button
              onClick={handleExportData}
              disabled={isProcessing === 'export'}
              className="bg-gray-800 hover:bg-gray-900 text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm whitespace-nowrap disabled:opacity-70">
                {isProcessing === 'export' ?
              <Loader2Icon className="w-4 h-4 animate-spin" /> :
              <DownloadIcon className="w-4 h-4" />}
                Exporter les données
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

      {/* ── User create / edit modal ─────────────────────────── */}
      <AnimatePresence>
        {showUserModal &&
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowUserModal(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                {selectedUser ? "Modifier l'utilisateur" : 'Ajouter un utilisateur'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Nom complet</label>
                <input name="name" required defaultValue={selectedUser?.name || ''}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Email</label>
                <input name="email" type="email" required defaultValue={selectedUser?.email || ''}
                  disabled={!!selectedUser}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Téléphone</label>
                <input name="phone" defaultValue={selectedUser?.phone || ''}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-globus-blue-dark mb-1.5">Rôle</label>
                <select name="role" defaultValue={selectedUser?.role || 'Lecture seule'}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-orange">
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-lg font-bold text-globus-gray hover:bg-gray-100 text-sm">Annuler</button>
                <button type="submit" disabled={isProcessing === 'save-user'}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-bold py-2 px-5 rounded-lg text-sm flex items-center gap-2 disabled:opacity-70">
                  {isProcessing === 'save-user' ?
                  <Loader2Icon className="w-4 h-4 animate-spin" /> :
                  <SaveIcon className="w-4 h-4" />}
                  {selectedUser ? 'Enregistrer' : 'Inviter'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>}
      </AnimatePresence>

      {/* ── Danger zone reset confirmation ───────────────────── */}
      <AnimatePresence>
        {showDangerModal &&
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowDangerModal(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">Réinitialiser le système ?</h3>
            <p className="text-sm text-globus-gray mt-2">
              Cette action est irréversible. Confirmez-vous la réinitialisation&nbsp;?
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button onClick={() => setShowDangerModal(false)}
                className="px-4 py-2 rounded-lg font-bold text-globus-gray hover:bg-gray-100 text-sm">Annuler</button>
              <button onClick={handleResetSystem} disabled={isProcessing === 'reset-system'}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded-lg text-sm flex items-center gap-2 disabled:opacity-70">
                {isProcessing === 'reset-system' ?
                <Loader2Icon className="w-4 h-4 animate-spin" /> :
                <AlertTriangleIcon className="w-4 h-4" />}
                Réinitialiser
              </button>
            </div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
    </div>);

}