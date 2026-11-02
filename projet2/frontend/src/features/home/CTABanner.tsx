import { motion } from 'framer-motion';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getCtaBanner } from '../../services/api/cms.api';
export function CTABanner() {
  const { data: cta, isLoading } = useCmsQuery('cta-banner', getCtaBanner);
  if (isLoading || !cta) {
    return (
      <section className="py-16 bg-globus-orange relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="h-24 bg-white/20 animate-pulse rounded-xl"></div>
        </div>
      </section>);

  }
  return (
    <section className="py-16 bg-globus-orange relative overflow-hidden">
      {/* Decorative pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 2px, transparent 2px)',
          backgroundSize: '30px 30px'
        }}>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <motion.div
            className="md:w-2/3"
            initial={{
              opacity: 0,
              x: -30
            }}
            whileInView={{
              opacity: 1,
              x: 0
            }}
            viewport={{
              once: true
            }}>
            
            <h2 className="font-montserrat font-extrabold text-3xl md:text-4xl text-white mb-4 leading-tight">
              {cta.title}
            </h2>
            <p className="font-opensans text-white/90 text-lg">
              {cta.subtitle}
            </p>
          </motion.div>

          <motion.div
            className="md:w-1/3 flex justify-center md:justify-end"
            initial={{
              opacity: 0,
              x: 30
            }}
            whileInView={{
              opacity: 1,
              x: 0
            }}
            viewport={{
              once: true
            }}>
            
            <a
              href={cta.ctaHref}
              className="bg-white text-globus-blue-dark hover:text-globus-orange font-montserrat font-bold py-4 px-8 rounded-lg shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 whitespace-nowrap">
              
              {cta.ctaText}
            </a>
          </motion.div>
        </div>
      </div>
    </section>);

}