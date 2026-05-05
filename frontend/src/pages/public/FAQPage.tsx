import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDownIcon,
  SearchIcon,
  MessageCircleIcon,
  MailIcon } from
'lucide-react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getFaqPage } from '../../services/api/cms.api';
import { SkeletonGrid } from '../../components/ui/Skeleton';
export function FAQPage() {
  const { data: faqData, isLoading } = useCmsQuery('faq-page', getFaqPage);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const toggleItem = (categoryIndex: number, itemIndex: number) => {
    const key = `${categoryIndex}-${itemIndex}`;
    setOpenItems((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  if (isLoading || !faqData) {
    return (
      <div className="pt-40 pb-20 container mx-auto px-4">
        <SkeletonGrid count={6} />
      </div>);

  }
  // Filter logic
  const filteredFaqData = faqData.
  map((category) => ({
    ...category,
    items: category.items.filter(
      (item) =>
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).
  filter((category) => category.items.length > 0);
  return (
    <div className="pt-52 xl:pt-36 sm:pt-36 pb-20 bg-gray-50 min-h-screen">
      <SEOHead
        title="Questions Fréquentes"
        description="Réponses à vos questions sur nos services, délais, garanties et tarifs."
        canonicalPath="/faq" />
      

      {/* Hero Banner */}
      <div className="bg-globus-blue-dark text-white py-20 relative mb-16 rounded-3xl mx-4 shadow-2xl">

        {/* Decorative abstract patterns in the background */}
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
          <svg width="100%" height="100%" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="pattern1" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="4" fill="white" />
                <circle cx="30" cy="30" r="4" fill="white" />
                <circle cx="50" cy="50" r="4" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pattern1)" />
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 w-1/3 h-full opacity-10 pointer-events-none">
          <svg width="100%" height="100%" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="pattern2" width="80" height="80" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="5" fill="white" />
                <circle cx="60" cy="60" r="5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pattern2)" />
          </svg>
        </div>

        <div className="container mx-auto px-4 max-w-4xl text-center">
          <motion.h1
            initial={{
              opacity: 0,
              y: 20
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            className="text-4xl md:text-5xl font-montserrat font-extrabold mb-4">
            
            Foire Aux Questions
          </motion.h1>
          <div className="h-1 w-24 bg-globus-orange mx-auto rounded-full mb-8"></div>

          <div className="relative max-w-2xl mx-auto">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full bg-white border border-gray-200 rounded-xl py-4 pl-12 pr-4 font-opensans text-lg focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 transition-all shadow-sm"
              placeholder="Comment pouvons-nous vous aider ?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} />
            
          </div>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="space-y-12">
          {filteredFaqData.length > 0 ?
          filteredFaqData.map((category, catIdx) =>
          <div key={catIdx}>
                <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-6 flex items-center gap-3">
                  <div className="w-2 h-6 bg-globus-orange rounded-full"></div>
                  {category.category}
                </h2>
                <div className="space-y-4">
                  {category.items.map((item, itemIdx) => {
                const isOpen = openItems[`${catIdx}-${itemIdx}`];
                return (
                  <motion.div
                    key={itemIdx}
                    initial={{
                      opacity: 0,
                      y: 10
                    }}
                    animate={{
                      opacity: 1,
                      y: 0
                    }}
                    transition={{
                      delay: itemIdx * 0.05
                    }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    
                        <button
                      onClick={() => toggleItem(catIdx, itemIdx)}
                      className="w-full px-6 py-5 text-left flex justify-between items-center focus:outline-none hover:bg-gray-50 transition-colors">
                      
                          <span className="font-montserrat font-bold text-globus-blue-dark pr-8">
                            {item.q}
                          </span>
                          <ChevronDownIcon
                        className={`w-5 h-5 text-globus-orange transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                      
                        </button>
                        <AnimatePresence>
                          {isOpen &&
                      <motion.div
                        initial={{
                          height: 0,
                          opacity: 0
                        }}
                        animate={{
                          height: 'auto',
                          opacity: 1
                        }}
                        exit={{
                          height: 0,
                          opacity: 0
                        }}
                        transition={{
                          duration: 0.3
                        }}>
                        
                              <div className="px-6 pb-5 font-opensans text-globus-gray border-t border-gray-50 pt-4 leading-relaxed">
                                {item.a}
                              </div>
                            </motion.div>
                      }
                        </AnimatePresence>
                      </motion.div>);

              })}
                </div>
              </div>
          ) :

          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
              <p className="font-opensans text-lg text-globus-gray">
                Aucun résultat trouvé pour "{searchQuery}"
              </p>
            </div>
          }
        </div>

        {/* CTA */}
        <div className="mt-16 bg-globus-blue-dark rounded-3xl p-8 md:p-12 text-center text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-globus-orange opacity-10 rounded-full translate-y-1/3 -translate-x-1/4"></div>

          <div className="relative z-10">
            <h3 className="font-montserrat font-bold text-2xl md:text-3xl mb-4">
              Vous ne trouvez pas votre réponse ?
            </h3>
            <p className="font-opensans text-seconda-blue mb-8 max-w-2xl mx-auto">
              Notre équipe est à votre disposition pour répondre à toutes vos
              questions spécifiques concernant votre projet de construction.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/contact"
                className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3 px-8 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2">
                
                <MailIcon className="w-5 h-5" /> Contactez-nous
              </Link>
              <Link
                to="/aide"
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-montserrat font-bold py-3 px-8 rounded-lg transition-colors flex items-center justify-center gap-2">
                
                <MessageCircleIcon className="w-5 h-5" /> Centre d'Aide
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>);

}