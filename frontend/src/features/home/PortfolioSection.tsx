import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getProjects, getOngoingProject } from '../../services/api/cms.api';
import { SkeletonGrid } from '../../components/ui/Skeleton';
import type { OngoingProject } from '../../types/cms.types';
function ProjectCarousel({
  images,
  height,
  title




}: {images: string[];height: string;title: string;}) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [images.length]);
  return (
    <div className={`relative w-full overflow-hidden ${height}`}>
      <AnimatePresence mode="wait">
        <motion.img
          key={current}
          src={images[current]}
          alt={`${title} - ${current + 1}`}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{
            opacity: 0,
            scale: 1.05
          }}
          animate={{
            opacity: 1,
            scale: 1
          }}
          exit={{
            opacity: 0
          }}
          transition={{
            duration: 0.7
          }} />
        
      </AnimatePresence>
      <div className="absolute bottom-3 right-3 z-20 flex gap-1.5">
        {images.map((_, idx) =>
        <div
          key={idx}
          className={`h-1 rounded-full transition-all duration-300 ${idx === current ? 'w-5 bg-globus-orange' : 'w-1.5 bg-white/50'}`} />

        )}
      </div>
    </div>);

}
function FeaturedProjectMedia({
  images,
  videoSrc



}: {images: string[];videoSrc?: string;}) {
  const [isVideoPhase, setIsVideoPhase] = useState(!!videoSrc);
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!videoSrc) return;
    const timer = setTimeout(() => {
      setIsVideoPhase(false);
    }, 15000);
    return () => clearTimeout(timer);
  }, [videoSrc]);
  useEffect(() => {
    if (isVideoPhase) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isVideoPhase, images.length]);
  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence>
        {isVideoPhase && videoSrc &&
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
            poster={images[0]}>
            
              <source src={videoSrc} type="video/mp4" />
            </video>
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
                  duration: 14,
                  ease: 'linear'
                }} />
              
              </div>
              <p className="text-white/60 text-xs font-opensans mt-2">
                Vidéo de présentation...
              </p>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {!isVideoPhase &&
      <>
          <AnimatePresence mode="wait">
            <motion.img
            key={current}
            src={images[current]}
            alt={`Projet à la une - ${current + 1}`}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{
              opacity: 0,
              scale: 1.05
            }}
            animate={{
              opacity: 1,
              scale: 1
            }}
            exit={{
              opacity: 0
            }}
            transition={{
              duration: 0.7
            }} />
          
          </AnimatePresence>
          <div className="absolute bottom-3 right-3 z-20 flex gap-1.5">
            {images.map((_, idx) =>
          <div
            key={idx}
            className={`h-1 rounded-full transition-all duration-300 ${idx === current ? 'w-5 bg-globus-orange' : 'w-1.5 bg-white/50'}`} />

          )}
          </div>
        </>
      }
    </div>);

}
function OngoingProjectShowcase({ project }: {project: OngoingProject;}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const projectData = project;
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % projectData.images.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [projectData.images.length]);
  const goTo = (idx: number) => setCurrentSlide(idx);
  const goPrev = () =>
  setCurrentSlide(
    (prev) =>
    (prev - 1 + projectData.images.length) % projectData.images.length
  );
  const goNext = () =>
  setCurrentSlide((prev) => (prev + 1) % projectData.images.length);
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 30
      }}
      whileInView={{
        opacity: 1,
        y: 0
      }}
      viewport={{
        once: true
      }}
      transition={{
        duration: 0.6
      }}
      className="bg-white rounded-3xl shadow-xl overflow-hidden mb-16 border border-gray-100">
      
      {/* Label */}
      <div className="bg-globus-orange px-6 py-3 flex items-center gap-3">
        <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
        <span className="font-montserrat font-bold text-white text-sm uppercase tracking-wider">
          Nouveau Projet en Cours
        </span>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Image Carousel */}
        <div className="w-full lg:w-1/2 relative h-[350px] lg:h-[420px] overflow-hidden group bg-globus-light">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentSlide}
              src={projectData.images[currentSlide]}
              alt={`${projectData.title} - ${currentSlide + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
              initial={{
                opacity: 0,
                scale: 1.05
              }}
              animate={{
                opacity: 1,
                scale: 1
              }}
              exit={{
                opacity: 0
              }}
              transition={{
                duration: 0.6
              }} />
            
          </AnimatePresence>

          {/* Nav Arrows */}
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-globus-blue-dark shadow-md opacity-0 group-hover:opacity-100 transition-all z-10">
            
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-globus-blue-dark shadow-md opacity-0 group-hover:opacity-100 transition-all z-10">
            
            <ChevronRightIcon className="w-5 h-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {projectData.images.map((_, idx) =>
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-7 bg-globus-orange' : 'w-2 bg-white/60 hover:bg-white'}`} />

            )}
          </div>
        </div>

        {/* Project Info */}
        <div className="w-full lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center">
          <h3 className="font-montserrat font-extrabold text-2xl md:text-3xl text-globus-blue-dark mb-6 uppercase leading-tight">
            {projectData.title}
          </h3>
          <p className="font-opensans text-globus-gray leading-relaxed mb-8">
            {projectData.description}
          </p>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="font-montserrat font-bold text-globus-blue-dark text-sm">
                Progression
              </span>
              <span className="font-montserrat font-extrabold text-globus-blue text-lg">
                {projectData.progress}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-globus-blue to-globus-blue-dark rounded-full"
                initial={{
                  width: 0
                }}
                whileInView={{
                  width: `${projectData.progress}%`
                }}
                viewport={{
                  once: true
                }}
                transition={{
                  duration: 1.2,
                  ease: 'easeOut',
                  delay: 0.3
                }} />
              
            </div>
          </div>

          {/* CTA */}
          <Link
            to={`/projets/${projectData.slug}`}
            className="inline-flex items-center gap-2 bg-globus-blue-dark hover:bg-globus-blue text-white font-montserrat font-bold py-3.5 px-8 rounded-lg transition-all shadow-md hover:shadow-lg self-start">
            
            En Savoir Plus
            <ArrowRightIcon className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </motion.div>);

}
export function PortfolioSection() {
  const [activeFilter, setActiveFilter] = useState('Tous');
  const filters = ['Tous', 'Résidentiel', 'Commercial', 'Gros Œuvre'];
  const { data: projects, isLoading: isLoadingProjects } = useCmsQuery(
    'projects',
    getProjects
  );
  const { data: ongoingProject, isLoading: isLoadingOngoing } = useCmsQuery(
    'ongoing-project',
    getOngoingProject
  );
  if (isLoadingProjects || isLoadingOngoing || !projects || !ongoingProject) {
    return (
      <section id="projets" className="py-16 md:py-24 bg-globus-light">
        <div className="container mx-auto px-4">
          <SkeletonGrid count={3} />
        </div>
      </section>);

  }
  const filteredProjects =
  activeFilter === 'Tous' ?
  projects :
  projects.filter((p) => p.category === activeFilter);
  return (
    <section id="projets" className="py-16 md:py-24 bg-globus-light">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
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
              Portfolio
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
            
            Projets à la Une & Réalisations
          </motion.h2>
        </div>

        {/* NEW: Ongoing Project Showcase */}
        <OngoingProjectShowcase project={ongoingProject} />

        {/* Filters */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {filters.map((filter) =>
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`font-montserrat font-semibold px-6 py-2 rounded-full transition-all ${activeFilter === filter ? 'bg-globus-blue text-white shadow-md' : 'bg-white text-globus-gray hover:bg-seconda-blue hover:text-globus-blue-dark'}`}>
            
              {filter}
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project) =>
            <motion.div
              key={project.id}
              layout
              initial={{
                opacity: 0,
                scale: 0.9
              }}
              animate={{
                opacity: 1,
                scale: 1
              }}
              exit={{
                opacity: 0,
                scale: 0.9
              }}
              transition={{
                duration: 0.3
              }}
              className={`group relative rounded-xl overflow-hidden shadow-lg cursor-pointer ${project.featured && activeFilter === 'Tous' ? 'md:col-span-2 md:row-span-2' : ''}`}>
              
                <div className="absolute inset-0 bg-globus-blue-dark/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex flex-col justify-end p-8">
                  <span className="text-globus-orange font-montserrat font-bold text-sm mb-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    {project.category}
                  </span>
                  <h3 className="text-white font-montserrat font-extrabold text-2xl mb-4 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                    {project.title}
                  </h3>
                  <div className="w-10 h-10 rounded-full bg-globus-orange flex items-center justify-center transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-150">
                    <ArrowRightIcon className="w-5 h-5 text-white" />
                  </div>
                </div>

                {/* Featured project: video → carousel. Others: carousel only */}
                {project.featured && activeFilter === 'Tous' ?
              <FeaturedProjectMedia
                images={project.images}
                videoSrc={project.videoSrc} /> :


              <ProjectCarousel
                images={project.images}
                height={
                project.featured && activeFilter === 'Tous' ?
                'h-[600px]' :
                'h-[300px]'
                }
                title={project.title} />

              }

                {/* Fallback height for featured */}
                {project.featured && activeFilter === 'Tous' &&
              <div className="h-[600px]" />
              }
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-16 text-center">
          <a
            href="#portfolio"
            className="inline-block border-2 border-globus-blue text-globus-blue hover:bg-globus-blue hover:text-white font-montserrat font-bold py-4 px-10 rounded-lg transition-all">
            
            Explorer l'intégralité du Portfolio
          </a>
        </div>
      </div>
    </section>);

}