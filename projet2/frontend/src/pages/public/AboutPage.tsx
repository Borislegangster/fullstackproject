import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2Icon, AwardIcon } from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { Link } from 'react-router-dom';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getAboutPage } from '../../services/api/cms.api';
import { SkeletonHero, SkeletonGrid } from '../../components/ui/Skeleton';
import { getIcon } from '../../utils/iconRegistry';
export function AboutPage() {
  const { data: pageData, isLoading } = useCmsQuery('about-page', getAboutPage);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  if (isLoading || !pageData) {
    return (
      <div className="pt-20 pb-20">
        <SkeletonHero className="h-[40vh] min-h-[300px] mb-24" />
        <div className="container mx-auto px-4 mb-24">
          <SkeletonGrid count={3} />
        </div>
      </div>);

  }
  return (
    <div className="pt-52 pb-20 xl:pt-36 sm:pt-36">
      <SEOHead
        title="À Propos"
        description="Découvrez Globus Engineering SARL, plus de 15 ans d'expérience dans le BTP. Notre histoire, nos valeurs et nos certifications."
        canonicalPath="/a-propos" />
      
      {/* Hero Banner */}
      <div className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden mb-16 rounded-3xl mx-4 shadow-2xl">
        <div className="absolute inset-0 bg-globus-blue-dark/80 z-10"></div>
        <img
          src={pageData.heroImage}
          alt="Équipe Globus"
          className="absolute inset-0 w-full h-full object-cover" />
        
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
            
            {pageData.heroTitle}
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
      </div>

      {/* Histoire et Vision */}
      <section className="container mx-auto px-4 mb-24">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-montserrat font-extrabold text-3xl md:text-4xl text-globus-blue-dark mb-8">
            Notre Histoire & Notre Vision
          </h2>
          <p className="font-opensans text-lg text-globus-gray leading-relaxed mb-6">
            {pageData.mission}
          </p>
          <p className="font-opensans text-lg text-globus-gray leading-relaxed mb-12">
            {pageData.vision}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {pageData.values.map((val, idx) =>
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
              }}
              className="bg-globus-light p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              
                <div className="mb-4">
                  {getIcon(val.iconKey, 'w-10 h-10 text-globus-orange')}
                </div>
                <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-3">
                  {val.title}
                </h3>
                <p className="font-opensans text-globus-gray">{val.desc}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* L'Équipe Dirigeante */}
      <section className="bg-globus-light py-20 mb-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-montserrat font-extrabold text-3xl md:text-4xl text-globus-blue-dark mb-4">
              L'Équipe Dirigeante
            </h2>
            <p className="font-opensans text-globus-gray max-w-2xl mx-auto">
              Des experts passionnés qui pilotent vos projets vers l'excellence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {pageData.team.map((member, idx) =>
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
                delay: idx * 0.1
              }}
              className="bg-white rounded-xl overflow-hidden shadow-lg group">
              
                <div className="h-72 overflow-hidden">
                  <img
                  src={member.photo}
                  alt={member.name}
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
                
                </div>
                <div className="p-6 text-center border-t-4 border-globus-orange">
                  <h3 className="font-montserrat font-extrabold text-xl text-globus-blue-dark mb-1">
                    {member.name}
                  </h3>
                  <p className="font-opensans font-semibold text-globus-gray text-sm">
                    {member.role}
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Certifications & Agréments */}
      <section className="container mx-auto px-4 mb-24">
        <div className="max-w-5xl mx-auto bg-globus-blue-dark rounded-3xl p-10 md:p-16 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
            <div className="w-full md:w-1/3 flex justify-center">
              <AwardIcon className="w-40 h-40 text-globus-orange opacity-80" />
            </div>
            <div className="w-full md:w-2/3">
              <h2 className="font-montserrat font-extrabold text-3xl mb-6">
                Certifications & Agréments
              </h2>
              <p className="font-opensans text-seconda-blue mb-8 text-lg">
                Notre engagement envers la qualité et la sécurité est reconnu
                par les plus hautes instances. Nous opérons dans le strict
                respect des normes en vigueur.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pageData.certifications?.map((cert, idx) =>
                <li key={idx} className="flex items-center gap-3">
                    <CheckCircle2Icon className="w-5 h-5 text-globus-orange flex-shrink-0" />
                    <span className="font-opensans font-semibold">{cert}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="text-center px-4">
        <h2 className="font-montserrat font-extrabold text-3xl text-globus-blue-dark mb-8">
          Prêt à bâtir l'avenir avec nous ?
        </h2>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            to="/contact"
            className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-4 px-8 rounded-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
            
            Confiez-nous votre projet
          </Link>
          <Link
            to="/contact"
            className="bg-white border-2 border-globus-blue text-globus-blue hover:bg-globus-blue hover:text-white font-montserrat font-bold py-4 px-8 rounded-lg transition-all">
            
            Rejoignez notre équipe
          </Link>
        </div>
      </section>
    </div>);

}