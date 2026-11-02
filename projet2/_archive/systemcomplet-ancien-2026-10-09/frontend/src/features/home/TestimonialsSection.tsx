import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  QuoteIcon } from
'lucide-react';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getTestimonials } from '../../services/api/cms.api';
import { SkeletonCard } from '../../components/ui/Skeleton';
export function TestimonialsSection() {
  const { data: testimonials, isLoading } = useCmsQuery(
    'testimonials',
    getTestimonials
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const next = () => {
    if (!testimonials) return;
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };
  const prev = () => {
    if (!testimonials) return;
    setCurrentIndex(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length
    );
  };
  // Auto-rotate
  useEffect(() => {
    if (!testimonials) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [testimonials]);
  if (isLoading) {
    return (
      <section className="py-16 md:py-24 bg-globus-blue-dark relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <SkeletonCard className="max-w-4xl mx-auto h-64" />
        </div>
      </section>);

  }
  // No testimonials configured → hide the section entirely (no broken carousel).
  if (!testimonials || testimonials.length === 0) return null;
  return (
    <section className="py-16 md:py-24 bg-globus-blue-dark relative overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 2px, transparent 2px)',
          backgroundSize: '40px 40px'
        }}>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
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
            className="font-montserrat font-extrabold text-3xl md:text-4xl text-white mb-4">
            
            Ce que disent nos clients
          </motion.h2>
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.8
            }}
            whileInView={{
              opacity: 1,
              scale: 1
            }}
            viewport={{
              once: true
            }}
            className="h-1 w-24 bg-globus-orange mx-auto rounded-full">
          </motion.div>
        </div>

        <div className="max-w-4xl mx-auto relative">
          {/* Client Photo - positioned above the card */}
          <div className="flex justify-center mb-[-40px] relative z-30">
            <AnimatePresence mode="wait">
              <motion.div
                key={`photo-${currentIndex}`}
                initial={{
                  opacity: 0,
                  scale: 0.7
                }}
                animate={{
                  opacity: 1,
                  scale: 1
                }}
                exit={{
                  opacity: 0,
                  scale: 0.7
                }}
                transition={{
                  duration: 0.3
                }}
                className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-white shadow-xl">
                
                <img
                  src={testimonials[currentIndex].photo}
                  alt={testimonials[currentIndex].name}
                  className="w-full h-full object-cover" />
                
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="bg-white rounded-2xl pt-14 pb-8 px-8 md:pt-16 md:pb-10 md:px-12 shadow-2xl relative">
            <QuoteIcon className="absolute top-6 left-6 w-16 h-16 text-globus-light opacity-50" />

            <div className="min-h-[200px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{
                    opacity: 0,
                    x: 20
                  }}
                  animate={{
                    opacity: 1,
                    x: 0
                  }}
                  exit={{
                    opacity: 0,
                    x: -20
                  }}
                  transition={{
                    duration: 0.3
                  }}
                  className="text-center relative z-10">
                  
                  <div className="flex justify-center mb-6">
                    {[...Array(5)].map((_, i) =>
                    <StarIcon
                      key={i}
                      className={`w-6 h-6 ${i < testimonials[currentIndex].rating ? 'text-globus-orange fill-globus-orange' : 'text-gray-300'}`} />

                    )}
                  </div>
                  <p className="font-opensans text-xl md:text-2xl text-globus-gray italic mb-8 leading-relaxed">
                    "{testimonials[currentIndex].text}"
                  </p>
                  <div>
                    <h4 className="font-montserrat font-bold text-globus-blue-dark text-lg">
                      {testimonials[currentIndex].name}
                    </h4>
                    <span className="font-opensans text-sm text-globus-orange">
                      {testimonials[currentIndex].project}
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="absolute top-1/2 -translate-y-1/2 -left-4 md:-left-6">
              <button
                onClick={prev}
                className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-globus-blue hover:text-globus-orange transition-colors border border-gray-100">
                
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 -right-4 md:-right-6">
              <button
                onClick={next}
                className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-globus-blue hover:text-globus-orange transition-colors border border-gray-100">
                
                <ChevronRightIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Dots */}
          <div className="flex justify-center mt-8 gap-2">
            {testimonials.map((_, idx) =>
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-3 h-3 rounded-full transition-all ${idx === currentIndex ? 'bg-globus-orange w-8' : 'bg-white/30 hover:bg-white/50'}`} />

            )}
          </div>
        </div>
      </div>
    </section>);

}