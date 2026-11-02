import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, HardHatIcon, HomeIcon, ChevronRightIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getServicesPage } from '../../services/api/cms.api';
import { SkeletonGrid } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { getIcon } from '../../utils/iconRegistry';
export function ServicesPage() {
  const { data: services, isLoading, isError, refetch } = useCmsQuery(
    'services-page',
    getServicesPage
  );
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  if (isLoading) {
    return (
      <div className="pt-40 pb-20 container mx-auto px-4">
        <SkeletonGrid count={4} />
      </div>);

  }
  if (isError) {
    return (
      <div className="pt-40 pb-20 container mx-auto px-4">
        <EmptyState
          icon={<HardHatIcon className="w-8 h-8" />}
          title="Impossible de charger les services"
          description="Une erreur est survenue lors du chargement. Veuillez réessayer."
          action={{ label: 'Réessayer', onClick: () => refetch() }} />
      </div>);

  }
  if (!services || services.length === 0) {
    return (
      <div className="pt-40 pb-20 container mx-auto px-4">
        <EmptyState
          icon={<HardHatIcon className="w-8 h-8" />}
          title="Aucun service disponible"
          description="Nos services seront publiés prochainement. Revenez bientôt." />
      </div>);

  }
  return (
    <div className="pt-52 xl:pt-36 sm:pt-36 pb-20">
      <SEOHead
        title="Nos Services"
        description="Construction de bâtiments, conception architecturale, génie civil et rénovation. Découvrez tous nos services BTP."
        canonicalPath="/services" />
      
      {/* Hero Banner */}
      <div className="text-white">
        <div className="container mx-auto px-4 mb-6">
          <nav className="flex items-center text-sm font-opensans text-globus-gray">
            <Link
              to="/"
              className="hover:text-globus-orange transition-colors flex items-center gap-1">
              
              <HomeIcon className="w-4 h-4" /> Accueil
            </Link>
            <ChevronRightIcon className="w-4 h-4 mx-2" />
            <span className="text-globus-blue-dark font-semibold">
              Nos Services
            </span>
          </nav>
        </div>

        {/* Hero Banner */}
        <section className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden mb-16 rounded-3xl mx-4 shadow-2xl">
          <div className="absolute inset-0 bg-globus-blue-dark/80 z-10"></div>
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-globus-blue-dark via-globus-blue to-globus-blue-dark" />

          <div className="relative z-20 text-center px-4">
            <motion.h1
              initial={{
                opacity: 0,
                y: 20
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              className="text-4xl md:text-5xl lg:text-6xl font-montserrat font-extrabold text-white mb-4">
              
              Nos domaines d'expertise
            </motion.h1>
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.8
              }}
              animate={{
                opacity: 1,
                scale: 1
              }}
              transition={{
                delay: 0.2
              }}
              className="h-1 w-24 bg-globus-orange mx-auto rounded-full">
            </motion.div>
          </div>
        </section>

        {/* Services Grid */}
        <section className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {services.map((service, idx) =>
            <motion.div
              key={service.id}
              initial={{
                opacity: 0,
                y: 30
              }}
              whileInView={{
                opacity: 1,
                y: 0
              }}
              viewport={{
                once: true,
                margin: '-50px'
              }}
              transition={{
                delay: idx * 0.1,
                duration: 0.5
              }}>
              
                <Link
                to={`/services/${service.id}`}
                className="group block relative rounded-2xl overflow-hidden shadow-lg h-[400px]">
                
                  <img
                  src={service.image}
                  alt={service.title}
                  className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                
                  <div className="absolute inset-0 bg-gradient-to-t from-globus-blue-dark via-globus-blue-dark/70 to-transparent opacity-90 group-hover:opacity-80 transition-opacity duration-300"></div>

                  <div className="absolute inset-0 p-8 flex flex-col justify-end">
                    <div className="w-16 h-16 bg-globus-orange rounded-2xl flex items-center justify-center mb-6 transform group-hover:-translate-y-2 transition-transform duration-300 shadow-xl">
                      {getIcon(service.iconKey, 'w-12 h-12 text-white')}
                    </div>
                    <h4 className="font-montserrat font-bold text-globus-orange mb-2 transform group-hover:-translate-y-2 transition-transform duration-300 delay-75">
                      {service.subtitle}
                    </h4>
                    <h3 className="font-montserrat font-extrabold text-3xl text-white mb-4 transform group-hover:-translate-y-2 transition-transform duration-300 delay-100">
                      {service.title}
                    </h3>
                    <p className="font-opensans text-seconda-blue mb-6 line-clamp-2 transform group-hover:-translate-y-2 transition-transform duration-300 delay-150">
                      {service.desc}
                    </p>
                    <div className="flex items-center gap-2 text-white font-montserrat font-bold transform group-hover:translate-x-2 transition-transform duration-300">
                      Découvrir ce service{' '}
                      <ArrowRightIcon className="w-5 h-5" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            )}
          </div>
        </section>
      </div>
    </div>);

}