import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboardIcon,
  UsersIcon,
  PackageIcon,
  TruckIcon,
  WalletIcon,
  TargetIcon,
  CalendarDaysIcon,
  ShieldAlertIcon,
  FolderGit2Icon,
  FileOutputIcon,
  UsersRoundIcon,
  ArrowLeftIcon,
  LogOutIcon,
  MenuIcon,
  XIcon,
  BellIcon,
  SearchIcon,
  HardHatIcon,
  SettingsIcon,
  BarChart3Icon,
  CalendarIcon,
  GlobeIcon,
  LifeBuoyIcon,
  ReceiptIcon,
  ActivityIcon } from
'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUnreadCount } from '../hooks/useErp';

interface NavSection {
  label: string;
  items: {
    path: string;
    label: string;
    icon: React.ElementType;
    exact?: boolean;
  }[];
}
const navSections: NavSection[] = [
{
  label: 'PRINCIPAL',
  items: [
  {
    path: '/erp',
    label: 'Tableau de Bord',
    icon: LayoutDashboardIcon,
    exact: true
  }]

},
{
  label: 'OPÉRATIONS',
  items: [
  {
    path: '/erp/rh',
    label: 'Ressources Humaines',
    icon: UsersIcon
  },
  {
    path: '/erp/achats',
    label: 'Achats & Stocks',
    icon: PackageIcon
  },
  {
    path: '/erp/materiel',
    label: 'Parc Matériel',
    icon: TruckIcon
  }]

},
{
  label: 'FINANCE',
  items: [
  {
    path: '/erp/finances',
    label: 'Comptabilité',
    icon: WalletIcon
  },
  {
    path: '/erp/facturation',
    label: 'Facturation',
    icon: ReceiptIcon
  },
  {
    path: '/erp/crm',
    label: 'CRM & Devis',
    icon: TargetIcon
  }]

},
{
  label: 'CHANTIER',
  items: [
  {
    path: '/erp/chantiers',
    label: 'Chantiers',
    icon: HardHatIcon
  },
  {
    path: '/erp/planification',
    label: 'Planification',
    icon: CalendarDaysIcon
  },
  {
    path: '/erp/qhse',
    label: 'QHSE',
    icon: ShieldAlertIcon
  }]

},
{
  label: 'DOCUMENTS',
  items: [
  {
    path: '/erp/ged',
    label: 'GED Technique',
    icon: FolderGit2Icon
  },
  {
    path: '/erp/documents',
    label: 'Génération Docs',
    icon: FileOutputIcon
  }]

},
{
  label: 'PARTENAIRES',
  items: [
  {
    path: '/erp/sous-traitants',
    label: 'Sous-Traitants',
    icon: UsersRoundIcon
  }]

},
{
  label: 'RELATION CLIENT',
  items: [
  {
    path: '/erp/cms',
    label: 'Site Public (CMS)',
    icon: GlobeIcon
  },
  {
    path: '/erp/sav',
    label: 'SAV & Tickets',
    icon: LifeBuoyIcon
  }]

},
{
  label: 'ANALYSE & OUTILS',
  items: [
  {
    path: '/erp/rapports',
    label: 'Rapports',
    icon: BarChart3Icon
  },
  {
    path: '/erp/agenda',
    label: 'Agenda',
    icon: CalendarIcon
  }]

},
{
  label: 'CONFIGURATION',
  items: [
  {
    path: '/erp/parametres',
    label: 'Paramètres',
    icon: SettingsIcon
  },
  {
    path: '/erp/journal-activite',
    label: "Journal d'Activité",
    icon: ActivityIcon
  }]

}];

const allNavItems = navSections.flatMap((s) => s.items);
export function ErpLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { data: unreadData } = useUnreadCount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userInitials = user ? `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`.toUpperCase() : 'AG';
  const userName = user?.full_name || 'Admin Globus';
  const userRole = user?.role === 'ADMIN' ? 'Administrateur' : user?.role === 'CHEF_PROJET' ? 'Chef de Projet' : user?.role === 'COMPTABLE' ? 'Comptable' : user?.role === 'RH' ? 'Ressources Humaines' : 'Utilisateur';
  const unreadCount = unreadData?.count ?? 0;

  const handleLogout = () => {
    logout();
    navigate('/connexion');
  };
  const getPageTitle = () => {
    const currentItem = allNavItems.find((item) =>
    item.exact ?
    location.pathname === item.path :
    location.pathname.startsWith(item.path) && item.path !== '/erp'
    );
    return currentItem ? currentItem.label : 'Tableau de Bord';
  };
  const SidebarContent = () =>
  <div className="flex flex-col h-full bg-[#0f172a] text-white">
      <div className="p-5 flex items-center justify-center border-b border-white/10">
        <div className="flex items-center gap-3">
          <img
          src="/LogoGlobus.png"
          alt="Globus ERP"
          className="h-8 object-contain bg-white/90 px-2 py-0.5 rounded-md" />
        
          <span className="font-montserrat font-bold text-sm text-globus-orange tracking-wider">
            ERP
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navSections.map((section) =>
      <div key={section.label}>
            <p className="text-[10px] font-montserrat font-bold text-gray-500 uppercase tracking-[0.15em] px-3 mt-5 mb-2">
              {section.label}
            </p>
            {section.items.map((item) => {
          const isActive = item.exact ?
          location.pathname === item.path :
          location.pathname.startsWith(item.path) &&
          item.path !== '/erp';
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-opensans font-medium transition-all ${isActive ? 'bg-white/10 text-white border-l-4 border-globus-orange ml-0 pl-2.5' : 'text-gray-400 hover:bg-white/5 hover:text-white border-l-4 border-transparent'}`}>
              
                  <Icon
                className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-globus-orange' : ''}`} />
              
                  <span className="truncate">{item.label}</span>
                </Link>);

        })}
          </div>
      )}

        <div className="pt-4 mt-4 border-t border-white/10">
          <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-opensans font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
          
            <ArrowLeftIcon className="w-[18px] h-[18px]" />
            Retour au site
          </Link>
        </div>
      </nav>

      <div className="p-3 border-t border-white/10 bg-black/30">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-9 h-9 rounded-lg bg-globus-orange flex items-center justify-center font-montserrat font-bold text-white text-sm shrink-0">
            {userInitials}
          </div>
          <div className="overflow-hidden">
            <p className="font-montserrat font-bold text-xs truncate">
              {userName}
            </p>
            <p className="font-opensans text-[10px] text-gray-500 truncate">
              {userRole}
            </p>
          </div>
        </div>
        <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors font-opensans font-medium text-xs text-gray-500">
        
          <LogOutIcon className="w-3.5 h-3.5" />
          Se déconnecter
        </button>
      </div>
    </div>;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-opensans text-gray-700">
      <aside className="hidden lg:block w-60 shrink-0 shadow-2xl z-20">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {isMobileMenuOpen &&
        <>
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
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden" />
          
            <motion.aside
            initial={{
              x: '-100%'
            }}
            animate={{
              x: 0
            }}
            exit={{
              x: '-100%'
            }}
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.35
            }}
            className="fixed inset-y-0 left-0 w-60 shadow-2xl z-50 lg:hidden">
            
              <SidebarContent />
            </motion.aside>
          </>
        }
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white shadow-sm flex items-center justify-between px-4 lg:px-6 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-gray-600 hover:bg-gray-100 rounded-lg">
              
              <MenuIcon className="w-5 h-5" />
            </button>
            <h1 className="font-montserrat font-bold text-lg text-globus-blue-dark truncate">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center relative">
              <SearchIcon className="absolute left-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="w-56 bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm font-opensans focus:outline-none focus:border-globus-blue focus:ring-1 focus:ring-globus-blue/30" />
              
            </div>
            <Link
              to="/erp/notifications"
              className="relative p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              
              <BellIcon className="w-5 h-5" />
              {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>}
            </Link>
            <div className="w-8 h-8 rounded-lg bg-globus-blue-dark flex items-center justify-center font-montserrat font-bold text-white text-xs">
              {userInitials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>);

}