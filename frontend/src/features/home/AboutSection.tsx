import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon } from 'lucide-react';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getAboutContent } from '../../services/api/cms.api';
import { SkeletonCard } from '../../components/ui/Skeleton';
export function AboutSection() {
  const { data: aboutContent, isLoading } = useCmsQuery(
    'about',
    getAboutContent
  );
  const [isVideoPhase, setIsVideoPhase] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  // Switch from video to carousel after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVideoPhase(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);
  // Auto-advance carousel — guard against an empty images array (modulo 0 = NaN).
  useEffect(() => {
    if (isVideoPhase || !aboutContent || !aboutContent.images?.length) return;
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % aboutContent.images.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isVideoPhase, aboutContent]);
  if (isLoading || !aboutContent) {
    return (
      <section id="apropos" className="py-16 md:py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-4">
          <SkeletonCard className="w-full h-96" />
        </div>
      </section>);

  }
  return (
    <section id="apropos" className="py-16 md:py-24 bg-white overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Image / Video Side */}
          <motion.div
            className="w-full lg:w-1/2 relative"
            initial={{
              opacity: 0,
              x: -50
            }}
            whileInView={{
              opacity: 1,
              x: 0
            }}
            viewport={{
              once: true
            }}
            transition={{
              duration: 0.7
            }}>
            
            <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[4/3]">
              <div className="absolute inset-0 bg-gradient-to-tr from-globus-blue/30 to-transparent z-10 pointer-events-none"></div>

              {/* Video Phase */}
              <AnimatePresence>
                {isVideoPhase &&
                <motion.div
                  className="absolute inset-0"
                  exit={{
                    opacity: 0
                  }}
                  transition={{
                    duration: 1
                  }}>
                  
                    <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                    poster={aboutContent.videoPoster}>
                    
                      <source src={aboutContent.videoSrc} type="video/mp4" />
                    </video>
                  </motion.div>
                }
              </AnimatePresence>

              {/* Carousel Phase */}
              {!isVideoPhase &&
              <AnimatePresence mode="wait">
                  <motion.img
                  key={currentImage}
                  src={aboutContent.images[currentImage]}
                  alt="Globus BTP réalisations"
                  className="absolute inset-0 w-full h-full object-cover"
                  initial={{
                    opacity: 0,
                    scale: 1.1
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1
                  }}
                  exit={{
                    opacity: 0
                  }}
                  transition={{
                    duration: 0.8
                  }} />
                
                </AnimatePresence>
              }

              {/* Carousel indicators */}
              {!isVideoPhase &&
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                  {aboutContent.images.map((_, idx) =>
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentImage ? 'w-8 bg-globus-orange' : 'w-3 bg-white/50'}`} />

                )}
                </div>
              }

              {/* Video phase loading bar */}
              {isVideoPhase &&
              <div className="absolute bottom-4 left-4 right-4 z-20">
                  <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                    className="h-full bg-globus-orange rounded-full"
                    initial={{
                      width: '0%'
                    }}
                    animate={{
                      width: '100%'
                    }}
                    transition={{
                      duration: 5.5,
                      ease: 'linear'
                    }} />
                  
                  </div>
                </div>
              }
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-xl shadow-xl z-20 hidden md:block border-b-4 border-globus-orange">
              <p className="font-montserrat font-extrabold text-4xl text-globus-blue mb-1">
                {aboutContent.badgeValue}
              </p>
              <p className="font-opensans text-sm text-globus-gray font-semibold">
                {aboutContent.badgeLabel}
              </p>
            </div>
          </motion.div>

          {/* Text Side */}
          <motion.div
            className="w-full lg:w-1/2"
            initial={{
              opacity: 0,
              x: 50
            }}
            whileInView={{
              opacity: 1,
              x: 0
            }}
            viewport={{
              once: true
            }}
            transition={{
              duration: 0.7
            }}>
            
            <div className="mb-4 flex items-center gap-4">
              <div className="h-1 w-12 bg-globus-orange"></div>
              <span className="font-montserrat font-bold text-globus-orange uppercase tracking-wider text-sm">
                {aboutContent.sectionTag}
              </span>
            </div>

            <h2 className="font-montserrat font-extrabold text-3xl md:text-4xl text-globus-blue-dark mb-6 leading-tight">
              {aboutContent.title}
            </h2>

            {aboutContent.paragraphs.map((paragraph, idx) =>
            <p
              key={idx}
              className="font-opensans text-globus-gray mb-6 leading-relaxed">
              
                {paragraph}
              </p>
            )}

            <ul className="space-y-4 mb-10">
              {aboutContent.highlights.map((item, idx) =>
              <li key={idx} className="flex items-start gap-3">
                  <CheckCircleIcon className="w-6 h-6 text-globus-orange flex-shrink-0 mt-0.5" />
                  <span className="font-opensans font-semibold text-globus-blue-dark">
                    {item}
                  </span>
                </li>
              )}
            </ul>

            <a
              href={aboutContent.ctaHref}
              className="inline-block border-2 border-globus-blue text-globus-blue hover:bg-globus-blue hover:text-white font-montserrat font-bold py-3 px-8 rounded-lg transition-all">
              
              {aboutContent.ctaText}
            </a>
          </motion.div>
        </div>
      </div>
    </section>);

}