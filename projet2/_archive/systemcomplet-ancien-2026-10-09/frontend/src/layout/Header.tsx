import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PhoneIcon, MailIcon, ClockIcon, MenuIcon, XIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCmsQuery } from '../hooks/useCmsQuery';
import { getSiteSettings } from '../services/api/cms.api';
export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { data: siteSettings } = useCmsQuery('site-settings', getSiteSettings);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);
  const navLinks = siteSettings?.navLinks || [
  {
    label: 'Accueil',
    href: '/'
  },
  {
    label: 'À Propos',
    href: '/a-propos'
  },
  {
    label: 'Services',
    href: '/services'
  },
  {
    label: 'Projets',
    href: '/projets'
  },
  {
    label: 'Blog',
    href: '/blog'
  },
  {
    label: 'Contact',
    href: '/contact'
  }];

  return (
    <header
      className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'shadow-lg' : ''}`}>
      
      {/* Top Bar */}
      <div
        className={`bg-globus-blue-dark text-white text-sm py-2 transition-all duration-300 ${isScrolled ? 'hidden' : 'block'}`}>
        
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
          {siteSettings?.topBarText &&
          <div className="flex items-center space-x-2 mb-2 md:mb-0">
            <ClockIcon className="w-4 h-4 text-globus-orange" />
            <span className="font-opensans">{siteSettings.topBarText}</span>
          </div>
          }
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6">
            {siteSettings?.phone &&
            <a
              href={`tel:${siteSettings.phone.replace(/[^0-9+]/g, '')}`}
              className="flex items-center space-x-2 hover:text-globus-orange transition-colors">

              <PhoneIcon className="w-4 h-4 text-globus-orange" />
              <span className="font-opensans">{siteSettings.phone}</span>
            </a>
            }
            {siteSettings?.email &&
            <a
              href={`mailto:${siteSettings.email}`}
              className="flex items-center space-x-2 hover:text-globus-orange transition-colors">

              <MailIcon className="w-4 h-4 text-globus-orange" />
              <span className="font-opensans">{siteSettings.email}</span>
            </a>
            }
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link to="/" className="flex-shrink-0 flex items-center">
              <img
                src={
                siteSettings?.logo || "/LogoGlobus.png"

                }
                alt={siteSettings?.companyName || 'Globus BTP Logo'}
                className="h-20 object-contain" />
              
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    to={link.href}
                    className={`font-montserrat font-semibold text-sm uppercase tracking-wider transition-colors ${isActive ? 'text-globus-orange' : 'text-globus-blue-dark hover:text-globus-orange'}`}>
                    
                    {link.label}
                  </Link>);

              })}
              <Link
                to="/contact"
                className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2.5 px-6 rounded-lg transition-colors shadow-md">
                
                Obtenir un Devis
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-globus-blue-dark hover:text-globus-orange focus:outline-none">
                
                {isMobileMenuOpen ?
                <XIcon className="w-8 h-8" /> :

                <MenuIcon className="w-8 h-8" />
                }
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMobileMenuOpen &&
          <motion.div
            initial={{
              opacity: 0,
              height: 0
            }}
            animate={{
              opacity: 1,
              height: 'auto'
            }}
            exit={{
              opacity: 0,
              height: 0
            }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden">
            
              <div className="px-4 pt-2 pb-6 space-y-1">
                {navLinks.map((link) => {
                const isActive = location.pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    to={link.href}
                    className={`block px-3 py-3 rounded-md font-montserrat font-semibold text-base ${isActive ? 'text-globus-orange bg-globus-orange/10' : 'text-globus-blue-dark hover:text-globus-orange hover:bg-globus-light'}`}>
                    
                      {link.label}
                    </Link>);

              })}
                <Link
                to="/contact"
                className="block w-full text-center mt-4 bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3 px-6 rounded-lg transition-colors shadow-md">
                
                  Demander un devis
                </Link>
              </div>
            </motion.div>
          }
        </AnimatePresence>
      </div>
    </header>);

}