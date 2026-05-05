import React, { useEffect, useState } from 'react';
import { MessageCircleIcon, XIcon, SendIcon, ArrowUpIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCmsQuery } from '../hooks/useCmsQuery';
import { getSiteSettings } from '../services/api/cms.api';
// WhatsApp Icon SVG since it's not in standard lucide-react
const WhatsAppIcon = ({ className }: {className?: string;}) =>
<svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>;

export function FloatingWidgets() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { data: siteSettings } = useCmsQuery('site-settings', getSiteSettings);
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  return (
    <>
      {/* Scroll to Top Button - bottom left */}
      <AnimatePresence>
        {showScrollTop &&
        <motion.button
          initial={{
            opacity: 0,
            scale: 0.5,
            y: 20
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            scale: 0.5,
            y: 20
          }}
          transition={{
            type: 'spring',
            damping: 20,
            stiffness: 300
          }}
          onClick={scrollToTop}
          className="fixed bottom-10 left-6 z-50 w-12 h-12 bg-globus-blue-dark hover:bg-globus-blue text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-colors"
          aria-label="Revenir en haut">
          
            <ArrowUpIcon className="w-5 h-5" />
          </motion.button>
        }
      </AnimatePresence>

      <div className="fixed bottom-10 right-6 z-50 flex flex-col items-end space-y-4">
        {/* Chatbot Panel */}
        <AnimatePresence>
          {isChatOpen &&
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
              scale: 0.9
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1
            }}
            exit={{
              opacity: 0,
              y: 20,
              scale: 0.9
            }}
            className="bg-white w-80 sm:w-96 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 ease-in-out bottom-10 right-16 absolute">
            
              {/* Chat Header */}
              <div className="bg-globus-blue p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                    <img
                    src="/LogoGlobus.png"
                    alt="Globus Bot"
                    className="w-8 h-8 object-contain" />
                  
                  </div>
                  <div>
                    <h4 className="font-montserrat font-bold text-white text-sm">
                      Estimateur Globus
                    </h4>
                    <span className="text-seconda-blue text-xs flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>{' '}
                      En ligne
                    </span>
                  </div>
                </div>
                <button
                onClick={() => setIsChatOpen(false)}
                className="text-white hover:text-globus-orange transition-colors">
                
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Chat Body */}
              <div className="h-80 bg-globus-light p-4 overflow-y-auto flex flex-col gap-4">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] border border-gray-100">
                  <p className="font-opensans text-sm text-globus-gray">
                    Bonjour ! 👋 Je suis l'assistant virtuel de Globus BTP.
                  </p>
                </div>
                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] border border-gray-100">
                  <p className="font-opensans text-sm text-globus-gray">
                    Souhaitez-vous estimer le budget de votre projet de
                    construction ?
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <button className="bg-globus-orange/10 text-globus-orange hover:bg-globus-orange hover:text-white border border-globus-orange font-montserrat font-semibold text-xs py-2 px-3 rounded-lg transition-colors text-left">
                      Oui, estimer mon budget
                    </button>
                    <button className="bg-globus-blue/10 text-globus-blue hover:bg-globus-blue hover:text-white border border-globus-blue font-montserrat font-semibold text-xs py-2 px-3 rounded-lg transition-colors text-left">
                      J'ai une autre question
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Input */}
              <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
                <input
                type="text"
                placeholder="Écrivez votre message..."
                className="flex-grow bg-globus-light border border-gray-200 rounded-full px-4 py-2 text-sm font-opensans focus:outline-none focus:border-globus-blue" />
              
                <button className="w-10 h-10 bg-globus-blue text-white rounded-full flex items-center justify-center hover:bg-globus-blue-dark transition-colors flex-shrink-0">
                  <SendIcon className="w-4 h-4 ml-1" />
                </button>
              </div>
            </motion.div>
          }
        </AnimatePresence>

        {/* Buttons Container */}
        <div className="flex flex-col gap-3">
          {/* WhatsApp Button */}
          <a
            href={
            siteSettings?.whatsappUrl ||
            "https://wa.me/33123456789?text=Bonjour%20Globus,%20j'aimerais%20échanger%20sur%20un%20projet..."
            }
            target="_blank"
            rel="noopener noreferrer"
            className="w-14 h-14 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110"
            aria-label="Contactez-nous sur WhatsApp">
            
            <WhatsAppIcon className="w-8 h-8" />
          </a>

          {/* Chatbot Button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="w-14 h-14 bg-globus-blue hover:bg-globus-blue-dark text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110 relative"
            aria-label="Ouvrir l'estimateur">
            
            {/* Pulse effect */}
            {!isChatOpen &&
            <span className="absolute inset-0 rounded-full border-2 border-globus-blue animate-ping opacity-75"></span>
            }
            {isChatOpen ?
            <XIcon className="w-6 h-6" /> :

            <MessageCircleIcon className="w-6 h-6" />
            }
          </button>
        </div>
      </div>
    </>);

}