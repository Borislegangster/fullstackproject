import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPinIcon,
  CalendarIcon,
  UserIcon,
  MaximizeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  HomeIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon } from
'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getProjectBySlug, getProjectsPage } from '../../services/api/cms.api';
import {
  SkeletonHero,
  SkeletonText,
  SkeletonCard } from
'../../components/ui/Skeleton';
export function ProjectDetailPage() {
  const { slug } = useParams<{
    slug: string;
  }>();
  const navigate = useNavigate();
  const { data: project, isLoading: isLoadingProject } = useCmsQuery(
    ['project', slug || ''],
    () => getProjectBySlug(slug || '')
  );
  const { data: projectsData = [], isLoading: isLoadingProjects } = useCmsQuery(
    'projects-page',
    getProjectsPage
  );
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);
  const [currentImg, setCurrentImg] = useState(0);
  if (isLoadingProject || isLoadingProjects) {
    return (
      <div className="pt-28 pb-20 bg-white min-h-screen">
        <div className="container mx-auto px-4">
          <SkeletonText lines={2} className="mb-8 max-w-md" />
          <SkeletonHero className="h-[50vh] min-h-[400px] mb-16 rounded-3xl" />
          <div className="flex flex-col lg:flex-row gap-12">
            <div className="w-full lg:w-2/3 space-y-6">
              <SkeletonText lines={6} />
              <SkeletonText lines={4} />
            </div>
            <div className="w-full lg:w-1/3">
              <SkeletonCard className="h-96" />
            </div>
          </div>
        </div>
      </div>);

  }
  if (!project) {
    return (
      <div className="pt-32 pb-20 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <SEOHead title="Projet introuvable" description="Projet non trouvé" />
        <h1 className="text-3xl font-montserrat font-bold text-globus-blue-dark mb-4">
          Projet introuvable
        </h1>
        <Link
          to="/projets"
          className="text-globus-orange hover:underline flex items-center gap-2">
          
          <ArrowLeftIcon className="w-4 h-4" /> Retour au portfolio
        </Link>
      </div>);

  }
  const nextImg = () =>
  setCurrentImg((prev) => (prev + 1) % project.images.length);
  const prevImg = () =>
  setCurrentImg(
    (prev) => (prev - 1 + project.images.length) % project.images.length
  );
  // Get related projects
  const relatedProjects = projectsData.
  filter((p) => p.category === project.category && p.id !== slug).
  slice(0, 3);
  return (
    <div className="pt-52 xl:pt-36 sm:pt-36 pb-20 bg-white min-h-screen">
      <SEOHead
        title={project.title}
        description={project.challenge}
        ogImage={project.images[0]}
        canonicalPath={`/projets/${slug}`} />
      
      <div className="container mx-auto px-4">
        {/* Breadcrumb & Back */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <nav className="flex items-center text-sm font-opensans text-globus-gray">
            <Link
              to="/"
              className="hover:text-globus-orange transition-colors flex items-center gap-1">
              
              <HomeIcon className="w-4 h-4" /> Accueil
            </Link>
            <ChevronRightIcon className="w-4 h-4 mx-2" />
            <Link
              to="/projets"
              className="hover:text-globus-orange transition-colors">
              
              Portfolio
            </Link>
            <ChevronRightIcon className="w-4 h-4 mx-2" />
            <span className="text-globus-blue-dark font-semibold truncate max-w-[200px]">
              {project.title}
            </span>
          </nav>
        </div>

        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="bg-globus-blue/10 text-globus-blue px-4 py-1.5 rounded-full font-montserrat font-bold text-sm">
              {project.category}
            </span>
            <span
              className={`px-4 py-1.5 rounded-full font-montserrat font-bold text-sm flex items-center gap-2 ${project.status.includes('Livré') ? 'bg-green-100 text-green-700' : 'bg-globus-orange/10 text-globus-orange'}`}>
              
              <div
                className={`w-2 h-2 rounded-full ${project.status.includes('Livré') ? 'bg-green-500' : 'bg-globus-orange animate-pulse'}`}>
              </div>
              {project.status}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-montserrat font-extrabold text-globus-blue-dark mb-4 leading-tight">
            {project.title}
          </h1>
          <div className="flex items-center text-globus-gray font-opensans text-lg">
            <MapPinIcon className="w-5 h-5 mr-2 text-globus-orange" />
            {project.location}
          </div>
        </div>

        {/* Gallery Slider */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[50vh] min-h-[400px] mb-16 group bg-globus-light">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImg}
              src={project.images[currentImg]}
              alt={`${project.title} - Vue ${currentImg + 1}`}
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
                duration: 0.5
              }} />
            
          </AnimatePresence>
          {project.images.length > 1 &&
          <>
              <button
              onClick={prevImg}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white rounded-full flex items-center justify-center text-globus-blue-dark shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
              
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
              <button
              onClick={nextImg}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white rounded-full flex items-center justify-center text-globus-blue-dark shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
              
                <ChevronRightIcon className="w-6 h-6" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 px-4 py-2 rounded-full backdrop-blur-sm">
                {project.images.map((_: any, idx: number) =>
              <button
                key={idx}
                onClick={() => setCurrentImg(idx)}
                className={`h-2 rounded-full transition-all ${idx === currentImg ? 'bg-globus-orange w-6' : 'bg-white/60 hover:bg-white w-2'}`} />

              )}
              </div>
            </>
          }
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main Content */}
          <div className="w-full lg:w-2/3">
            <h2 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark mb-6 flex items-center gap-3">
              <div className="w-2 h-8 bg-globus-orange rounded-full"></div>
              Le Défi & La Solution
            </h2>
            <div className="prose prose-lg max-w-none font-opensans text-globus-gray">
              <p className="mb-6 leading-relaxed">
                <strong className="text-globus-blue-dark font-montserrat text-xl block mb-2">
                  Le Défi Initial
                </strong>
                {project.challenge}
              </p>
              <div className="bg-globus-light p-8 rounded-2xl border-l-4 border-globus-orange mb-8">
                <strong className="text-globus-blue-dark font-montserrat text-xl block mb-2">
                  L'Approche Globus
                </strong>
                <p className="leading-relaxed m-0">{project.solution}</p>
              </div>
            </div>
          </div>

          {/* Sidebar Specs */}
          <div className="w-full lg:w-1/3">
            <div className="bg-globus-blue-dark rounded-3xl p-8 shadow-xl text-white sticky top-32">
              <h3 className="font-montserrat font-bold text-2xl mb-8 border-b border-white/10 pb-4">
                Fiche Technique
              </h3>
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-globus-orange" />
                  </div>
                  <div>
                    <span className="block text-sm text-seconda-blue font-opensans">
                      Maître d'ouvrage
                    </span>
                    <span className="font-montserrat font-bold text-lg">
                      {project.client}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <MaximizeIcon className="w-5 h-5 text-globus-orange" />
                  </div>
                  <div>
                    <span className="block text-sm text-seconda-blue font-opensans">
                      Superficie
                    </span>
                    <span className="font-montserrat font-bold text-lg">
                      {project.area}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <CalendarIcon className="w-5 h-5 text-globus-orange" />
                  </div>
                  <div>
                    <span className="block text-sm text-seconda-blue font-opensans">
                      Durée des travaux
                    </span>
                    <span className="font-montserrat font-bold text-lg">
                      {project.duration}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <MapPinIcon className="w-5 h-5 text-globus-orange" />
                  </div>
                  <div>
                    <span className="block text-sm text-seconda-blue font-opensans">
                      Architecte
                    </span>
                    <span className="font-montserrat font-bold text-lg">
                      {project.architect}
                    </span>
                  </div>
                </li>
              </ul>
              <div className="mt-10 pt-8 border-t border-white/10">
                <p className="text-sm text-seconda-blue font-opensans mb-4 text-center">
                  Un projet similaire en tête ?
                </p>
                <Link
                  to="/contact"
                  className="block w-full text-center bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3 px-6 rounded-xl transition-colors shadow-md">
                  
                  Contactez-nous
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Progression du Projet */}
        {project.progression && project.progression.length > 0 &&
        <div className="mt-24">
            <h2 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark mb-10 flex items-center gap-3">
              <div className="w-2 h-8 bg-globus-orange rounded-full"></div>
              Progression du Projet
            </h2>
            <div className="relative">
              <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200 -z-10"></div>
              <div className="space-y-8">
                {project.progression.map((item: any, index: number) =>
              <motion.div
                key={index}
                initial={{
                  opacity: 0,
                  x: -20
                }}
                whileInView={{
                  opacity: 1,
                  x: 0
                }}
                viewport={{
                  once: true,
                  margin: '-100px'
                }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1
                }}
                className="relative flex items-start gap-6">
                
                    <div className="relative z-10 bg-white py-1">
                      {item.status === 'validé' &&
                  <CheckCircle2Icon className="w-8 h-8 text-green-500" />
                  }
                      {item.status === 'en-cours' &&
                  <div className="relative">
                          <CircleDotIcon className="w-8 h-8 text-globus-orange relative z-10" />
                          <div className="absolute inset-0 bg-globus-orange rounded-full animate-ping opacity-30"></div>
                        </div>
                  }
                      {item.status === 'à-venir' &&
                  <CircleIcon className="w-8 h-8 text-gray-300" />
                  }
                    </div>
                    <div className="flex-1 pt-1">
                      <h4
                    className={`font-montserrat font-bold text-lg ${item.status === 'à-venir' ? 'text-gray-400' : 'text-globus-blue-dark'}`}>
                    
                        {item.step}
                      </h4>
                      {item.status === 'en-cours' &&
                  <span className="inline-block mt-2 text-xs font-bold px-3 py-1 bg-globus-orange/10 text-globus-orange rounded-full">
                          En cours
                        </span>
                  }
                      {item.date &&
                  <p className="text-sm text-globus-gray font-opensans mt-1 flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5" /> {item.date}
                        </p>
                  }
                    </div>
                  </motion.div>
              )}
              </div>
            </div>
          </div>
        }

        {/* Vidéo de Présentation */}
        {project.videoUrl &&
        <div className="mt-24">
            <h2 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark mb-4 flex items-center gap-3">
              <div className="w-2 h-8 bg-globus-orange rounded-full"></div>
              Vidéo de Présentation
            </h2>
            <p className="text-globus-gray font-opensans mb-8 text-lg">
              Découvrez les coulisses et l'avancement de ce chantier en vidéo.
            </p>
            <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl bg-globus-light group">
              <iframe
              src={project.videoUrl}
              title={`Vidéo de présentation - ${project.title}`}
              className="absolute inset-0 w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen>
            </iframe>
            </div>
          </div>
        }

        {/* Related Projects */}
        {relatedProjects.length > 0 &&
        <div className="mt-24 pt-16 border-t border-gray-200">
            <h2 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark mb-8 text-center">
              Dans la même catégorie
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedProjects.map((project) =>
            <Link
              to={`/projets/${project.id}`}
              key={project.id}
              className="group rounded-2xl overflow-hidden shadow-lg block relative h-64">
              
                  <img
                src={project.image}
                alt={project.title}
                className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
              
                  <div className="absolute inset-0 bg-globus-blue-dark/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center">
                    <h4 className="text-white font-montserrat font-bold text-xl mb-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      {project.title}
                    </h4>
                    <span className="text-globus-orange font-montserrat font-bold text-sm flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                      Voir le projet <ArrowRightIcon className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
            )}
            </div>
          </div>
        }
      </div>
    </div>);

}