import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { SEOHead } from '../../components/seo/SEOHead';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getLegalPage } from '../../services/api/cms.api';
import { SkeletonText } from '../../components/ui/Skeleton';
export function CookiePolicyPage() {
  const { data: pageData, isLoading } = useCmsQuery(['legal', 'cookies'], () =>
  getLegalPage('cookies')
  );
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  if (isLoading || !pageData) {
    return (
      <div className="pt-40 pb-20 container mx-auto px-4 max-w-4xl">
        <SkeletonText lines={2} className="mb-12 text-center" />
        <SkeletonText lines={15} />
      </div>);

  }
  return (
    <div className="pt-40 xl:pt-28 sm:pt-28 pb-20 bg-gray-50 min-h-screen">
      <SEOHead
        title={pageData.title}
        description="Cookies utilisés et gestion."
        canonicalPath="/cookies" />
      
      {/* Hero Banner */}
      <div className="text-white py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <span className="inline-block bg-globus-light text-globus-gray px-4 py-1.5 rounded-full text-sm font-opensans mb-6 border border-gray-200">
              Dernière mise à jour : {pageData.lastUpdated}
            </span>
            <motion.h1
              initial={{
                opacity: 0,
                y: 20
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              className="text-4xl md:text-5xl font-montserrat font-extrabold text-globus-blue-dark mb-4">
              
              {pageData.title}
            </motion.h1>
            <div className="h-1 w-24 bg-globus-orange mx-auto rounded-full mb-6"></div>
            <p className="font-opensans text-lg text-globus-gray">
              Informations sur l'utilisation des cookies sur notre site web.
            </p>
          </div>

          <div className="space-y-12 font-opensans text-globus-gray leading-relaxed">
            {pageData.sections.map((section, idx) =>
            <section
              key={idx}
              className={
              idx === 0 ?
              'bg-globus-light p-8 rounded-2xl border-l-4 border-globus-orange' :
              ''
              }>
              
                <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-4">
                  {section.title}
                </h2>
                <div className="whitespace-pre-line">{section.content}</div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>);

}