import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from 'lucide-react';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getFaqItems } from '../../services/api/cms.api';
import { SkeletonGrid } from '../../components/ui/Skeleton';
export function FAQSection() {
  const { data: faqs, isLoading } = useCmsQuery('faq-home', getFaqItems);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  if (isLoading || !faqs) {
    return (
      <section className="py-16 md:py-24 bg-globus-light">
        <div className="container mx-auto px-4 max-w-4xl">
          <SkeletonGrid count={5} />
        </div>
      </section>);

  }
  return (
    <section className="py-16 md:py-24 bg-globus-light">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-16">
          <motion.div
            initial={{
              opacity: 0,
              y: 20
            }}
            whileInView={{
              opacity: 1,
              y: 0
            }}
            viewport={{
              once: true
            }}
            className="inline-flex items-center justify-center gap-4 mb-4">
            
            <div className="h-1 w-8 bg-globus-orange"></div>
            <span className="font-montserrat font-bold text-globus-orange uppercase tracking-wider text-sm">
              FAQ
            </span>
            <div className="h-1 w-8 bg-globus-orange"></div>
          </motion.div>
          <motion.h2
            initial={{
              opacity: 0,
              y: 20
            }}
            whileInView={{
              opacity: 1,
              y: 0
            }}
            viewport={{
              once: true
            }}
            transition={{
              delay: 0.1
            }}
            className="font-montserrat font-extrabold text-3xl md:text-4xl text-globus-blue-dark">
            
            Questions Fréquentes
          </motion.h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) =>
          <motion.div
            key={index}
            initial={{
              opacity: 0,
              y: 20
            }}
            whileInView={{
              opacity: 1,
              y: 0
            }}
            viewport={{
              once: true
            }}
            transition={{
              duration: 0.4,
              delay: index * 0.1
            }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            
              <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-6 py-5 text-left flex justify-between items-center focus:outline-none">
              
                <span className="font-montserrat font-bold text-globus-blue-dark pr-8">
                  {faq.q}
                </span>
                <ChevronDownIcon
                className={`w-5 h-5 text-globus-orange transition-transform duration-300 flex-shrink-0 ${openIndex === index ? 'rotate-180' : ''}`} />
              
              </button>
              <AnimatePresence>
                {openIndex === index &&
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
                
                    <div className="px-6 pb-5 font-opensans text-globus-gray border-t border-gray-50 pt-4">
                      {faq.a}
                    </div>
                  </motion.div>
              }
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        <div className="text-center mt-10">
          <p className="font-opensans text-globus-gray mb-4">
            Une autre question ?
          </p>
          <button className="text-globus-orange font-montserrat font-bold hover:underline">
            Posez-la à notre Chatbot en bas à droite !
          </button>
        </div>
      </div>
    </section>);

}