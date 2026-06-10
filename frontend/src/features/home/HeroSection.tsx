import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getHeroSlides, getHeroVideo } from '../../services/api/cms.api';
import { SkeletonHero } from '../../components/ui/Skeleton';
export function HeroSection() {
  const { data: slides, isLoading: isLoadingSlides } = useCmsQuery(
    'hero-slides',
    getHeroSlides
  );
  const { data: video, isLoading: isLoadingVideo } = useCmsQuery(
    'hero-video',
    getHeroVideo
  );
  const [isVideoPhase, setIsVideoPhase] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  // Transition from video to carousel after 6 seconds — only if slides exist.
  // With zero slides we stay on the static video phase instead of crashing on
  // slides[currentSlide].
  useEffect(() => {
    if (!slides || slides.length === 0) return;
    const timer = setTimeout(() => {
      setIsVideoPhase(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [slides]);
  // Auto-advance carousel slides
  useEffect(() => {
    if (isVideoPhase || !slides) return;
    const interval = setInterval(() => {
      setDirection(1);
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isVideoPhase, slides]);
  const goToSlide = useCallback(
    (index: number) => {
      setDirection(index > currentSlide ? 1 : -1);
      setCurrentSlide(index);
    },
    [currentSlide]
  );
  const goNext = useCallback(() => {
    if (!slides) return;
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides]);
  const goPrev = useCallback(() => {
    if (!slides) return;
    setDirection(-1);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides]);
  if (isLoadingSlides || isLoadingVideo || !slides || !video) {
    return <SkeletonHero />;
  }
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0
    })
  };
  const textVariants = {
    hidden: {
      opacity: 0,
      y: 40
    },
    visible: (delay: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    })
  };
  return (
    <section
      id="accueil"
      className="relative pt-52 pb-20 md:pt-40 md:pb-32 lg:min-h-[85vh] flex items-center overflow-hidden">
      
      {/* ===== VIDEO BACKGROUND PHASE ===== */}
      <AnimatePresence>
        {isVideoPhase &&
        <motion.div
          className="absolute inset-0 z-0"
          exit={{
            opacity: 0
          }}
          transition={{
            duration: 1.2
          }}>
          
            <div className="absolute inset-0 bg-gradient-to-r from-globus-blue-dark/90 via-globus-blue-dark/70 to-globus-blue/60 z-10" />
            <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            poster={video.poster}>
            
              <source src={video.src} type="video/mp4" />
            </video>
          </motion.div>
        }
      </AnimatePresence>

      {/* ===== CAROUSEL BACKGROUND PHASE ===== */}
      {!isVideoPhase &&
      <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-globus-blue-dark/90 via-globus-blue-dark/70 to-globus-blue/60 z-10" />
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.img
            key={`bg-${currentSlide}`}
            src={slides[currentSlide].image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: 0.8,
              ease: [0.45, 0, 0.55, 1]
            }} />
          
          </AnimatePresence>
        </div>
      }

      {/* ===== CONTENT ===== */}
      <div className="container mx-auto px-4 relative z-20">
        {/* Video phase: static content */}
        {isVideoPhase &&
        <div className="max-w-3xl">
            <motion.div
            initial={{
              opacity: 0,
              y: 30
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              duration: 0.6
            }}>
            
              <span className="inline-block py-1.5 px-4 rounded-full bg-globus-orange/20 text-globus-orange font-montserrat font-bold text-sm tracking-widest uppercase mb-6 border border-globus-orange/50 backdrop-blur-sm">
                BTP & Construction Clé en main
              </span>
            </motion.div>

            <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-montserrat font-extrabold text-white leading-tight mb-6"
            initial={{
              opacity: 0,
              y: 30
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              duration: 0.6,
              delay: 0.2
            }}>
            
              Bâtissez votre avenir en toute sérénité.
            </motion.h1>

            <motion.p
            className="text-lg md:text-xl text-gray-200 font-opensans mb-10 max-w-2xl leading-relaxed"
            initial={{
              opacity: 0,
              y: 30
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              duration: 0.6,
              delay: 0.4
            }}>
            
              <strong className="text-white font-semibold">
                Ensemble vers la perfection !!!
              </strong>{' '}
              De la conception architecturale à la remise des clés, nous gérons
              l'intégralité de votre projet avec rigueur et passion.
            </motion.p>

            <motion.div
            className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6"
            initial={{
              opacity: 0,
              y: 30
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              duration: 0.6,
              delay: 0.6
            }}>
            
              <a
              href="#estimateur"
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-4 px-8 rounded-lg text-center transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
              
                Estimer mon budget
              </a>
              <a
              href="#projets"
              className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-globus-blue-dark font-montserrat font-bold py-4 px-8 rounded-lg text-center transition-all">
              
                Découvrir nos réalisations
              </a>
            </motion.div>

            {/* Loading indicator — hints that carousel is coming */}
            <motion.div
            className="mt-12 flex items-center gap-3"
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            transition={{
              delay: 1.5
            }}>
            
              <div className="h-0.5 w-16 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                className="h-full bg-globus-orange rounded-full"
                initial={{
                  width: '0%'
                }}
                animate={{
                  width: '100%'
                }}
                transition={{
                  duration: 5,
                  ease: 'linear'
                }} />
              
              </div>
              <span className="text-white/40 text-xs font-opensans">
                Chargement...
              </span>
            </motion.div>
          </div>
        }

        {/* Carousel phase: sliding content */}
        {!isVideoPhase &&
        <div className="max-w-3xl relative">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
              key={`content-${currentSlide}`}
              initial="hidden"
              animate="visible"
              exit={{
                opacity: 0,
                y: -20,
                transition: {
                  duration: 0.3
                }
              }}>
              
                <motion.div custom={0} variants={textVariants}>
                  <span className="inline-block py-1.5 px-4 rounded-full bg-globus-orange/20 text-globus-orange font-montserrat font-bold text-sm tracking-widest uppercase mb-6 border border-globus-orange/50 backdrop-blur-sm">
                    {slides[currentSlide].tag}
                  </span>
                </motion.div>

                <motion.h1
                className="text-4xl md:text-5xl lg:text-6xl font-montserrat font-extrabold text-white leading-tight mb-6"
                custom={0.15}
                variants={textVariants}>
                
                  {slides[currentSlide].title}
                </motion.h1>

                <motion.p
                className="text-lg md:text-xl text-gray-200 font-opensans mb-10 max-w-2xl leading-relaxed"
                custom={0.3}
                variants={textVariants}>
                
                  {slides[currentSlide].subtitle}
                </motion.p>

                <motion.div
                className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6"
                custom={0.45}
                variants={textVariants}>
                
                  <a
                  href={slides[currentSlide].cta1.href}
                  className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-4 px-8 rounded-lg text-center transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
                  
                    {slides[currentSlide].cta1.text}
                  </a>
                  <a
                  href={slides[currentSlide].cta2.href}
                  className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-globus-blue-dark font-montserrat font-bold py-4 px-8 rounded-lg text-center transition-all">
                  
                    {slides[currentSlide].cta2.text}
                  </a>
                </motion.div>
              </motion.div>
            </AnimatePresence>

            {/* Slide indicators + navigation */}
            <div className="mt-12 flex items-center justify-between">
              {/* Dots / progress bars */}
              <div className="flex items-center gap-2">
                {slides.map((_, idx) =>
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                className="relative h-1.5 rounded-full overflow-hidden transition-all"
                style={{
                  width: idx === currentSlide ? 48 : 16
                }}
                aria-label={`Aller au slide ${idx + 1}`}>
                
                    <div className="absolute inset-0 bg-white/25 rounded-full" />
                    {idx === currentSlide &&
                <motion.div
                  className="absolute inset-0 bg-globus-orange rounded-full origin-left"
                  initial={{
                    scaleX: 0
                  }}
                  animate={{
                    scaleX: 1
                  }}
                  transition={{
                    duration: 5,
                    ease: 'linear'
                  }}
                  key={`progress-${currentSlide}`} />

                }
                  </button>
              )}
              </div>

              {/* Prev / Next arrows */}
              <div className="flex items-center gap-3">
                <button
                onClick={goPrev}
                className="w-11 h-11 rounded-full border border-white/30 flex items-center justify-center text-white hover:bg-white hover:text-globus-blue-dark transition-all backdrop-blur-sm"
                aria-label="Slide précédent">
                
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <button
                onClick={goNext}
                className="w-11 h-11 rounded-full border border-white/30 flex items-center justify-center text-white hover:bg-white hover:text-globus-blue-dark transition-all backdrop-blur-sm"
                aria-label="Slide suivant">
                
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    </section>);

}