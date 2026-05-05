import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const consent = localStorage.getItem('globus-cookie-consent');
    if (!consent) {
      // Small delay before showing to ensure smooth page load
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  const handleAccept = () => {
    localStorage.setItem('globus-cookie-consent', 'accepted');
    setIsVisible(false);
  };
  return (
    <AnimatePresence>
      {isVisible &&
      <motion.div
        initial={{
          y: 100,
          opacity: 0
        }}
        animate={{
          y: 0,
          opacity: 1
        }}
        exit={{
          y: 100,
          opacity: 0
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30
        }}
        className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
        
          <div className="bg-globus-blue-dark text-white rounded-2xl shadow-2xl max-w-5xl mx-auto p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10">
            <div className="flex-1">
              <h3 className="font-montserrat font-bold text-lg mb-2">
                Vos préférences de cookies
              </h3>
              <p className="font-opensans text-sm text-seconda-blue leading-relaxed">
                Ce site utilise des cookies pour améliorer votre expérience,
                analyser le trafic et vous proposer des services adaptés. En
                continuant votre navigation, vous acceptez notre{' '}
                <Link
                to="/cookies"
                className="text-globus-orange hover:underline font-semibold">
                
                  Politique des cookies
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <Link
              to="/cookies"
              onClick={() => setIsVisible(false)}
              className="px-6 py-3 rounded-lg font-montserrat font-bold text-sm text-center border border-white/30 hover:bg-white/10 transition-colors">
              
                Paramétrer
              </Link>
              <button
              onClick={handleAccept}
              className="px-6 py-3 rounded-lg font-montserrat font-bold text-sm text-center bg-globus-orange hover:bg-globus-orange-hover text-white transition-colors shadow-lg">
              
                Accepter tout
              </button>
            </div>
          </div>
        </motion.div>
      }
    </AnimatePresence>);

}