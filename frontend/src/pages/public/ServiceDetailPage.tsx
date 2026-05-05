import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  HomeIcon,
  ChevronDownIcon } from
'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getServiceBySlug, getProjectsPage } from '../../services/api/cms.api';
import {
  SkeletonHero,
  SkeletonText,
  SkeletonCard } from
'../components/ui/Skeleton';
import { getIcon } from '../../utils/iconRegistry';
import { getContactInfo } from '../../services/api/cms.api';
// FAQ Accordion Item
function FaqItem({
  question,
  answer,
  isOpen,
  onToggle
}: {question: string;answer: string;isOpen: boolean;onToggle: () => void;}) {
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden transition-all">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-globus-light/50 transition-colors">
        
        <span className="font-montserrat font-bold text-globus-blue-dark text-lg pr-4">
          {question}
        </span>
        <ChevronDownIcon
          className={`w-6 h-6 text-globus-orange flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        
      </button>
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? 'auto' : 0,
          opacity: isOpen ? 1 : 0
        }}
        transition={{
          duration: 0.3,
          ease: 'easeInOut'
        }}
        className="overflow-hidden">
        
        <div className="px-6 pb-6 pt-0">
          <p className="font-opensans text-globus-gray leading-relaxed">
            {answer}
          </p>
        </div>
      </motion.div>
    </div>);

}
export function ServiceDetailPage() {
  const { slug } = useParams<{
    slug: string;
  }>();
  const navigate = useNavigate();
  const { data: service, isLoading: isLoadingService } = useCmsQuery(
    ['service', slug || ''],
    () => getServiceBySlug(slug || '')
  );
  const { data: projectsData = [], isLoading: isLoadingProjects } = useCmsQuery(
    'projects-page',
    getProjectsPage
  );
  const { data: contactInfo } = useCmsQuery('contact-info', getContactInfo);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);
  if (isLoadingService || isLoadingProjects) {
    return (
      <div className="pt-20 pb-20">
        <SkeletonHero className="h-[40vh] min-h-[300px]" />
        <div className="container mx-auto px-4 mt-12">
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
  if (!service) {
    return (
      <div className="pt-32 pb-20 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <SEOHead title="Service introuvable" description="Service non trouvé" />
        <h1 className="text-3xl font-montserrat font-bold text-globus-blue-dark mb-4">
          Service introuvable
        </h1>
        <Link
          to="/services"
          className="text-globus-orange hover:underline flex items-center gap-2">
          
          <ArrowLeftIcon className="w-4 h-4" /> Retour aux services
        </Link>
      </div>);

  }
  // Get related projects
  const relatedProjects = projectsData.
  filter(
    (p) =>
    p.category === service.relatedCategory || p.category === 'En Cours'
  ).
  slice(0, 3);
  return (
    <div className="pt-52 xl:pt-36 sm:pt-36 pb-20">
      <SEOHead
        title={service.title}
        description={service.subtitle}
        canonicalPath={`/services/${slug}`} />

        <div className="container mx-auto px-4 mb-6">
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm font-opensans text-globus-gray">
          <Link
            to="/"
            className="hover:text-globus-orange transition-colors flex items-center gap-1">

            <HomeIcon className="w-4 h-4" /> Accueil
          </Link>
          <ChevronRightIcon className="w-4 h-4 mx-2" />
          <Link to="/services" className="hover:text-globus-orange transition-colors flex items-center gap-1">
            Nos Services
          </Link>
          <ChevronRightIcon className="w-4 h-4 mx-2" />
          <span className="text-globus-blue-dark font-semibold">
            {service.title}
          </span>
        </nav>
      </div>
      
      {/* Hero Banner */}
      <div className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden rounded-3xl mx-4 shadow-2xl mb-16">
        <div className="absolute inset-0 bg-gradient-to-r from-globus-blue-dark/95 to-globus-blue-dark/40 z-10"></div>
        <img
          src={service.image}
          alt={service.title}
          className="absolute inset-0 w-full h-full object-cover" />
        
        <div className="container mx-auto px-4 relative z-20">
          <motion.div
            initial={{
              opacity: 0,
              y: 30
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            className="max-w-3xl">
            
            <span className="inline-block bg-globus-orange text-white font-montserrat font-bold text-xs px-3 py-1 rounded-full mb-4">
              {service.subtitle}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-montserrat font-extrabold text-white mb-6 leading-tight">
              {service.title}
            </h1>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main Content */}
          <div className="w-full lg:w-2/3">
            <motion.div
              initial={{
                opacity: 0,
                y: 20
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              transition={{
                delay: 0.2
              }}>
              
              <h2 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark mb-6">
                Présentation de notre expertise
              </h2>
              <div className="prose prose-lg max-w-none font-opensans text-globus-gray mb-10">
                <p className="lead text-xl text-globus-blue-dark font-semibold mb-6">
                  {service.desc}
                </p>
                <p>{service.details}</p>
              </div>

              {/* Benefits */}
              <div className="bg-globus-light p-8 md:p-10 rounded-3xl border border-gray-100 mb-10 shadow-sm">
                <h3 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-8 flex items-center gap-3">
                  <div className="w-2 h-8 bg-globus-orange rounded-full"></div>
                  Vos Avantages avec Globus
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {service.benefits.map((benefit: string, idx: number) =>
                  <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2Icon className="w-6 h-6 text-globus-orange flex-shrink-0 mt-0.5" />
                      <span className="font-opensans font-semibold text-globus-blue-dark">
                        {benefit}
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-1/3">
            <motion.div
              initial={{
                opacity: 0,
                x: 20
              }}
              animate={{
                opacity: 1,
                x: 0
              }}
              transition={{
                delay: 0.3
              }}
              className="bg-globus-blue-dark rounded-3xl p-8 text-white sticky top-32 shadow-2xl">
              
              <h3 className="font-montserrat font-bold text-2xl mb-4">
                Besoin de ce service ?
              </h3>
              <p className="font-opensans text-seconda-blue mb-8">
                Discutez de votre projet de{' '}
                <strong>{service.title.toLowerCase()}</strong> avec nos experts
                et obtenez une estimation détaillée.
              </p>
              <Link
                to="/contact"
                className="block w-full text-center bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-4 px-6 rounded-xl transition-colors shadow-md mb-4">
                
                Demander un devis
              </Link>
              <a
                href={`tel:${contactInfo?.phone?.replace(/[^0-9+]/g, '') || '+33123456789'}`}
                className="block w-full text-center bg-white/10 hover:bg-white/20 text-white font-montserrat font-bold py-4 px-6 rounded-xl transition-colors mb-4">
                
                Appeler le {contactInfo?.phone || '+33 1 23 45 67 89'}
              </a>
              <a
                href={
                contactInfo?.whatsapp ?
                `https://wa.me/${contactInfo.whatsapp.replace(/[^0-9]/g, '')}` :
                'https://wa.me/33612345678'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-[#25D366] hover:bg-[#20bd5a] text-white font-montserrat font-bold py-4 px-6 rounded-xl transition-colors">
                
                WhatsApp
              </a>
            </motion.div>
          </div>
        </div>

        {/* ===== NOTRE PROCESSUS ===== */}
        <section className="mt-24">
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
                Méthodologie
              </span>
              <div className="h-1 w-8 bg-globus-orange"></div>
            </motion.div>
            <h2 className="font-montserrat font-extrabold text-3xl md:text-4xl text-globus-blue-dark">
              Notre Processus
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {service.processSteps.map((step: any, idx: number) =>
            <motion.div
              key={idx}
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
                delay: idx * 0.15,
                duration: 0.5
              }}
              className="relative">
              
                {/* Connector line */}
                {idx < service.processSteps.length - 1 &&
              <div className="hidden lg:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-40px)] h-0.5 bg-gray-200 z-0"></div>
              }

                <div className="relative z-10 flex flex-col items-center text-center">
                  {/* Step number + icon */}
                  <div className="relative mb-6">
                    <div className="w-20 h-20 bg-globus-blue-dark rounded-2xl flex items-center justify-center shadow-xl">
                      {getIcon(step.iconKey, 'w-7 h-7 text-white')}
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-globus-orange rounded-full flex items-center justify-center shadow-md">
                      <span className="font-montserrat font-extrabold text-white text-sm">
                        {idx + 1}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-3">
                    {step.title}
                  </h3>
                  <p className="font-opensans text-globus-gray text-sm leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* ===== QUESTIONS FRÉQUENTES ===== */}
        <section className="mt-24">
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
            <h2 className="font-montserrat font-extrabold text-3xl md:text-4xl text-globus-blue-dark">
              Questions Fréquentes
            </h2>
            <p className="font-opensans text-globus-gray mt-4 max-w-2xl mx-auto">
              Les réponses aux questions les plus posées par nos clients
              concernant notre service de {service.title.toLowerCase()}.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {service.faq.map((item: any, idx: number) =>
            <motion.div
              key={idx}
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
                delay: idx * 0.1
              }}>
              
                <FaqItem
                question={item.q}
                answer={item.a}
                isOpen={openFaq === idx}
                onToggle={() => setOpenFaq(openFaq === idx ? null : idx)} />
              
              </motion.div>
            )}
          </div>
        </section>

        {/* ===== PROJETS ASSOCIÉS (avec progression) ===== */}
        {relatedProjects.length > 0 &&
        <section className="mt-24 mb-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark">
                Projets Associés
              </h2>
              <Link
              to="/projets"
              className="hidden md:flex items-center gap-2 text-globus-orange font-montserrat font-bold hover:text-globus-orange-hover transition-colors">
              
                Voir tout le portfolio <ArrowRightIcon className="w-5 h-5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedProjects.map((project) =>
            <Link
              to={`/projets/${project.id}`}
              key={project.id}
              className="group rounded-2xl overflow-hidden shadow-lg block bg-white border border-gray-100">
              
                  {/* Image */}
                  <div className="relative h-56 overflow-hidden">
                    <img
                  src={project.image}
                  alt={project.title}
                  className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                
                    <div className="absolute inset-0 bg-gradient-to-t from-globus-blue-dark/80 via-transparent to-transparent"></div>
                    {/* Status badge */}
                    <div className="absolute top-4 left-4">
                      <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-montserrat font-bold text-xs text-white shadow-md ${project.progress === 100 ? 'bg-green-600' : 'bg-globus-orange'}`}>
                    
                        <div
                      className={`w-2 h-2 rounded-full ${project.progress === 100 ? 'bg-green-300' : 'bg-white animate-pulse'}`}>
                    </div>
                        {project.progress === 100 ? 'Livré' : 'En Cours'}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-6">
                    <span className="text-globus-orange font-montserrat font-bold text-xs block mb-2">
                      {project.category}
                    </span>
                    <h4 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-4 group-hover:text-globus-blue transition-colors">
                      {project.title}
                    </h4>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-opensans text-globus-gray text-xs font-semibold">
                          Avancement
                        </span>
                        <span className="font-montserrat font-extrabold text-globus-blue text-sm">
                          {project.progress}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                      className={`h-full rounded-full ${project.progress === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-globus-blue to-globus-blue-dark'}`}
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
                  </div>
                </Link>
            )}
            </div>
          </section>
        }
      </div>
    </div>);

}