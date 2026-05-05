import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboardIcon,
  HardHatIcon,
  WalletIcon,
  FolderIcon,
  MessageSquareIcon,
  UserIcon,
  ShieldCheckIcon,
  ArrowLeftIcon,
  LogOutIcon,
  MenuIcon,
  XIcon,
  BellIcon,
  HelpCircleIcon,
  CameraIcon,
  CheckCircle2Icon,
  FileTextIcon,
  CalendarIcon } from
'lucide-react';
export const mockUser = {
  name: 'Jean Talla',
  initials: 'JT',
  email: 'jean.talla@email.com',
  phone: '+237 6 99 88 77 66',
  role: 'Propriétaire',
  projectName: 'Villa Moderne Bonapriso',
  projectId: 'PRJ-2024-001'
};
const navItems = [
{
  path: '/espace-client',
  label: 'Tableau de Bord',
  icon: LayoutDashboardIcon,
  exact: true
},
{
  path: '/espace-client/chantier',
  label: 'Suivi de Chantier',
  icon: HardHatIcon
},
{
  path: '/espace-client/planning',
  label: 'Planning & Calendrier',
  icon: CalendarIcon
},
{
  path: '/espace-client/finances',
  label: 'Finances',
  icon: WalletIcon
},
{
  path: '/espace-client/documents',
  label: 'Documents',
  icon: FolderIcon
},
{
  path: '/espace-client/messagerie',
  label: 'Messagerie',
  icon: MessageSquareIcon
},
{
  path: '/espace-client/compte',
  label: 'Mon Compte',
  icon: UserIcon
},
{
  path: '/espace-client/sav',
  label: 'SAV & Garanties',
  icon: ShieldCheckIcon
}];

export function ClientLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
      !target.closest('.notifications-container') &&
      !target.closest('.bell-button'))
      {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const handleLogout = () => {
    // Simulate logout
    navigate('/connexion');
  };
  const getPageTitle = () => {
    const currentItem = navItems.find((item) =>
    item.exact ?
    location.pathname === item.path :
    location.pathname.startsWith(item.path)
    );
    return currentItem ? currentItem.label : 'Espace Client';
  };
  const SidebarContent = () =>
  <div className="flex flex-col h-full bg-globus-blue-dark text-white">
      {/* Logo */}
      <div className="p-6 flex items-center justify-center border-b border-white/10">
        <img
        src="/LogoGlobus.png"
        alt="Globus BTP"
        className="h-10 object-contain bg-white/90 px-3 py-1 rounded-lg" />
      
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {navItems.map((item) => {
        const isActive = item.exact ?
        location.pathname === item.path :
        location.pathname.startsWith(item.path);
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-montserrat font-semibold transition-all ${isActive ? 'bg-white/10 text-white border-l-4 border-globus-orange' : 'text-seconda-blue hover:bg-white/5 hover:text-white border-l-4 border-transparent'}`}>
            
              <Icon
              className={`w-5 h-5 ${isActive ? 'text-globus-orange' : ''}`} />
            
              {item.label}
            </Link>);

      })}

        <div className="pt-6 mt-6 border-t border-white/10">
          <Link
          to="/"
          className="flex items-center gap-3 px-4 py-3 rounded-lg font-montserrat font-semibold text-seconda-blue hover:bg-white/5 hover:text-white transition-colors">
          
            <ArrowLeftIcon className="w-5 h-5" />
            Retour au site
          </Link>
        </div>
      </nav>

      {/* User Profile Bottom */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-globus-orange flex items-center justify-center font-montserrat font-bold text-white shrink-0">
            {mockUser.initials}
          </div>
          <div className="overflow-hidden">
            <p className="font-montserrat font-bold text-sm truncate">
              {mockUser.name}
            </p>
            <p className="font-opensans text-xs text-seconda-blue truncate">
              {mockUser.projectName}
            </p>
          </div>
        </div>
        <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-white/10 hover:bg-red-500/20 hover:text-red-400 transition-colors font-montserrat font-semibold text-sm text-seconda-blue">
        
          <LogOutIcon className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>;

  return (
    <div className="flex h-screen bg-globus-light overflow-hidden font-opensans text-globus-gray">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 shadow-2xl z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
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
            className="fixed inset-0 bg-black/50 z-40 md:hidden" />
          
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
              duration: 0.4
            }}
            className="fixed inset-y-0 left-0 w-64 shadow-2xl z-50 md:hidden">
            
              <SidebarContent />
            </motion.aside>
          </>
        }
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 md:px-8 z-10 shrink-0 relative">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-globus-blue-dark hover:bg-gray-100 rounded-lg">
              
              <MenuIcon className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <h1 className="font-montserrat font-bold text-xl text-globus-blue-dark truncate">
                {getPageTitle()}
              </h1>
              <span className="hidden md:inline-block bg-globus-light border border-gray-200 text-globus-gray px-2.5 py-1 rounded-md text-xs font-mono font-semibold">
                {mockUser.projectId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <Link
              to="/aide"
              className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-globus-gray hover:text-globus-blue hover:border-globus-blue transition-colors"
              title="Centre d'aide">
              
              <HelpCircleIcon className="w-4 h-4" />
            </Link>

            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="bell-button relative p-2 text-globus-gray hover:bg-gray-100 rounded-full transition-colors">
                
                <BellIcon className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">
                  2
                </span>
              </button>

              {/* Notifications Dropdown */}
              <AnimatePresence>
                {isNotificationsOpen &&
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 10,
                    scale: 0.95
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1
                  }}
                  exit={{
                    opacity: 0,
                    y: 10,
                    scale: 0.95
                  }}
                  transition={{
                    duration: 0.15
                  }}
                  className="notifications-container absolute right-0 top-full mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                  
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <h3 className="font-montserrat font-bold text-globus-blue-dark">
                        Notifications
                      </h3>
                      <button className="text-xs font-semibold text-globus-orange hover:underline">
                        Tout marquer comme lu
                      </button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      <div className="p-3 hover:bg-gray-50 cursor-pointer flex items-start gap-3 border-b border-gray-50 transition-colors relative">
                        <div className="w-2 h-2 bg-globus-blue rounded-full absolute left-2 top-1/2 -translate-y-1/2"></div>
                        <div className="w-8 h-8 rounded-full bg-globus-orange/10 flex items-center justify-center shrink-0 ml-3">
                          <WalletIcon className="w-4 h-4 text-globus-orange" />
                        </div>
                        <div>
                          <p className="font-montserrat font-semibold text-sm text-globus-blue-dark">
                            Appel de fonds #4 en attente
                          </p>
                          <p className="font-opensans text-xs text-globus-gray mt-0.5">
                            Il y a 2h
                          </p>
                        </div>
                      </div>
                      <div className="p-3 hover:bg-gray-50 cursor-pointer flex items-start gap-3 border-b border-gray-50 transition-colors relative">
                        <div className="w-2 h-2 bg-globus-blue rounded-full absolute left-2 top-1/2 -translate-y-1/2"></div>
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 ml-3">
                          <CameraIcon className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-montserrat font-semibold text-sm text-globus-blue-dark">
                            Nouvelle photo de chantier
                          </p>
                          <p className="font-opensans text-xs text-globus-gray mt-0.5">
                            Il y a 5h
                          </p>
                        </div>
                      </div>
                      <div className="p-3 hover:bg-gray-50 cursor-pointer flex items-start gap-3 border-b border-gray-50 transition-colors pl-6">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                          <CheckCircle2Icon className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-montserrat font-semibold text-sm text-globus-blue-dark opacity-80">
                            Étape Fondations validée
                          </p>
                          <p className="font-opensans text-xs text-globus-gray mt-0.5">
                            1 jour
                          </p>
                        </div>
                      </div>
                      <div className="p-3 hover:bg-gray-50 cursor-pointer flex items-start gap-3 border-b border-gray-50 transition-colors pl-6">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                          <MessageSquareIcon className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-montserrat font-semibold text-sm text-globus-blue-dark opacity-80">
                            Message de Ing. Paul Mbarga
                          </p>
                          <p className="font-opensans text-xs text-globus-gray mt-0.5">
                            2 jours
                          </p>
                        </div>
                      </div>
                      <div className="p-3 hover:bg-gray-50 cursor-pointer flex items-start gap-3 transition-colors pl-6">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <FileTextIcon className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-montserrat font-semibold text-sm text-globus-blue-dark opacity-80">
                            Document: Plan électrique v2
                          </p>
                          <p className="font-opensans text-xs text-globus-gray mt-0.5">
                            3 jours
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 border-t border-gray-100 text-center bg-gray-50/50">
                      <Link
                      to="/espace-client/notifications"
                      onClick={() => setIsNotificationsOpen(false)}
                      className="text-sm font-semibold text-globus-blue hover:underline">
                      
                        Voir toutes les notifications
                      </Link>
                    </div>
                  </motion.div>
                }
              </AnimatePresence>
            </div>

            <div className="hidden sm:block text-right">
              <p className="font-montserrat font-bold text-sm text-globus-blue-dark">
                {mockUser.name}
              </p>
              <p className="text-xs text-globus-gray">{mockUser.role}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-globus-orange flex items-center justify-center font-montserrat font-bold text-white text-sm sm:hidden">
              {mockUser.initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>);

}