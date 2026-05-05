import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRightIcon,
  MapPinIcon,
  FilterIcon,
  SearchIcon,
  CheckCircleIcon,
  HomeIcon,
  ChevronRightIcon,
  ClockIcon } from
'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getProjectsPage } from '../../services/api/cms.api';
import { SkeletonGrid } from '../../components/ui/Skeleton';
export { mockProjectsPageData as projectsData } from '../../services/api/mockData/pages.mock';
export function ProjectsPage() {
  const { data: projectsData, isLoading } = useCmsQuery(
    'projects-page',
    getProjectsPage
  );
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [activeCategory, setActiveCategory] = useState('Toutes catégories');
  const [activeStatus, setActiveStatus] = useState('Tous les projets');
  const [visibleCount, setVisibleCount] = useState(6);
  if (isLoading || !projectsData) {
    return (
      <div className="pt-40 pb-20 container mx-auto px-4">
        <SkeletonGrid count={6} />
      </div>);

  }
  const categories = [
  'Toutes catégories',
  'Résidentiel',
  'Commercial',
  'Industriel',
  'Institutionnel'];

  const statuses = ['Tous les projets', 'En cours', 'Terminés'];
  const getProjectStatus = (progress: number) =>
  progress === 100 ? 'Terminés' : 'En cours';
  const filteredProjects = projectsData.filter((p) => {
    const categoryMatch =
    activeCategory === 'Toutes catégories' || p.category === activeCategory;
    const statusMatch =
    activeStatus === 'Tous les projets' ||
    getProjectStatus(p.progress) === activeStatus;
    return categoryMatch && statusMatch;
  });
  return (
    <div className="pt-52 xl:pt-36 sm:pt-36 pb-20">
      <SEOHead
        title="Nos Réalisations"
        description="Découvrez nos projets de construction au Cameroun."
        canonicalPath="/projets" />

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 mb-6">
        <nav className="flex items-center text-sm font-opensans text-globus-gray">
            <Link
              to="/"
              className="hover:text-globus-orange transition-colors flex items-center gap-1">
              
              <HomeIcon className="w-4 h-4" /> Accueil
            </Link>
            <ChevronRightIcon className="w-4 h-4 mx-2" />
            <span className="text-globus-blue-dark font-semibold">
              
              Portfolio
            </span>
        </nav>
      </div>
      
      {/* Hero Banner */}
      <div className="bg-globus-blue-dark text-white py-20 mb-16 rounded-3xl mx-4 shadow-2xl">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-montserrat font-extrabold mb-4">
            Nos Réalisations
          </h1>
          <div className="h-1 w-24 bg-globus-orange mx-auto rounded-full mb-8"></div>
          <p className="font-opensans text-lg max-w-2xl mx-auto">
            Découvrez l'ensemble de nos projets de construction, rénovation et
            génie civil à travers le Cameroun.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {/* === FILTER ROW 1: Categories === */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {categories.map((cat) =>
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setVisibleCount(6);
            }}
            className={`font-montserrat font-semibold px-6 py-2.5 rounded-full transition-all text-sm border ${activeCategory === cat ? 'bg-globus-blue text-white border-globus-blue shadow-md' : 'bg-white text-globus-gray border-gray-200 hover:border-globus-blue hover:text-globus-blue'}`}>
            
              {cat}
            </button>
          )}
        </div>

        {/* === FILTER ROW 2: Status === */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {statuses.map((status) =>
          <button
            key={status}
            onClick={() => {
              setActiveStatus(status);
              setVisibleCount(6);
            }}
            className={`font-montserrat font-semibold px-5 py-2 rounded-full transition-all text-sm ${activeStatus === status ? 'bg-globus-blue-dark text-white shadow-md' : 'bg-white text-globus-gray hover:bg-seconda-blue hover:text-globus-blue-dark border border-gray-200'}`}>
            
              {status}
            </button>
          )}
        </div>

        {/* Project count */}
        <div className="mb-8">
          <p className="font-opensans text-globus-gray text-sm">
            <span className="font-montserrat font-bold text-globus-blue-dark">
              {filteredProjects.length}
            </span>{' '}
            projet{filteredProjects.length > 1 ? 's' : ''} trouvé
            {filteredProjects.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* === PROJECT CARDS GRID === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredProjects.slice(0, visibleCount).map((project, idx) => {
              const isComplete = project.progress === 100;
              return (
                <motion.div
                  key={project.id}
                  layout
                  initial={{
                    opacity: 0,
                    y: 20
                  }}
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.95
                  }}
                  transition={{
                    duration: 0.35,
                    delay: idx * 0.05
                  }}>
                  
                  <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100 flex flex-col h-full">
                    {/* Image */}
                    <div className="relative h-60 overflow-hidden group">
                      <img
                        src={project.image}
                        alt={project.title}
                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" />
                      
                      {/* Status Badge */}
                      <div className="absolute top-4 right-4 z-10">
                        <span
                          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-montserrat font-bold text-xs text-white shadow-lg ${isComplete ? 'bg-green-500' : 'bg-globus-orange'}`}>
                          
                          {isComplete ?
                          <CheckCircleIcon className="w-3.5 h-3.5" /> :

                          <ClockIcon className="w-3.5 h-3.5" />
                          }
                          {isComplete ? 'Terminé' : 'En cours'}
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-6 flex flex-col flex-grow">
                      {/* Title */}
                      <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-2 leading-tight">
                        {project.title}
                      </h3>

                      {/* Description */}
                      <p className="font-opensans text-globus-gray text-sm leading-relaxed mb-4 line-clamp-2">
                        {project.description}
                      </p>

                      {/* Category & Location */}
                      <div className="flex flex-col gap-1 mb-5 text-sm font-opensans">
                        <span className="text-globus-gray">
                          Catégorie:{' '}
                          <span className="font-semibold text-globus-blue-dark">
                            {project.category}
                          </span>
                        </span>
                        <span className="text-globus-gray flex items-center gap-1">
                          <MapPinIcon className="w-3.5 h-3.5 text-globus-orange" />
                          {project.location}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      {!isComplete &&
                      <div className="mb-5">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-montserrat font-bold text-globus-blue-dark text-sm">
                              Progression
                            </span>
                            <span className="font-montserrat font-extrabold text-globus-blue text-sm">
                              {project.progress}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                            className="h-full bg-gradient-to-r from-globus-blue to-globus-blue-dark rounded-full"
                            initial={{
                              width: 0
                            }}
                            whileInView={{
                              width: `${project.progress}%`
                            }}
                            viewport={{
                              once: true
                            }}
                            transition={{
                              duration: 1,
                              ease: 'easeOut',
                              delay: 0.2
                            }} />
                          
                          </div>
                        </div>
                      }

                      {/* Completed badge for finished projects */}
                      {isComplete &&
                      <div className="mb-5 flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg">
                          <CheckCircleIcon className="w-4 h-4" />
                          <span className="font-opensans text-sm font-semibold">
                            Projet livré avec succès
                          </span>
                        </div>
                      }

                      {/* CTA Link */}
                      <div className="mt-auto">
                        <Link
                          to={`/projets/${project.id}`}
                          className="inline-flex items-center gap-2 font-montserrat font-bold text-globus-blue hover:text-globus-orange transition-colors text-sm group/link">
                          
                          Voir les détails
                          <ArrowRightIcon className="w-4 h-4 transform group-hover/link:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>);

            })}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredProjects.length === 0 &&
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
            <SearchIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-2">
              Aucun projet trouvé
            </h3>
            <p className="font-opensans text-globus-gray mb-6">
              Aucun projet ne correspond à vos critères de recherche.
            </p>
            <button
            onClick={() => {
              setActiveCategory('Toutes catégories');
              setActiveStatus('Tous les projets');
            }}
            className="bg-globus-blue text-white px-6 py-2.5 rounded-lg font-montserrat font-semibold hover:bg-globus-blue-dark transition-colors">
            
              Réinitialiser les filtres
            </button>
          </div>
        }

        {/* Load More */}
        {filteredProjects.length > visibleCount &&
        <div className="mt-16 text-center">
            <button
            onClick={() => setVisibleCount((prev) => prev + 6)}
            className="bg-white border-2 border-globus-blue text-globus-blue hover:bg-globus-blue hover:text-white font-montserrat font-bold py-3 px-10 rounded-xl transition-all shadow-sm">
            
              Charger plus de projets
            </button>
          </div>
        }
      </div>
    </div>);

}