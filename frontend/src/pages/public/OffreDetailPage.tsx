import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, StarIcon, MessageCircleIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { axiosClient as api } from '../../services/api/axiosClient';

export function OffreDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  useEffect(() => { document.title = `Offre ${slug || ''} | Globus Engineering`; }, [slug]);

  const { data: offer, isLoading } = useQuery({
    queryKey: ['cms-offer', slug],
    queryFn: async () => {
      const { data } = await api.get(`/cms/offers/${slug}`);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-globus-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-globus-blue" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-globus-bg">
        <h1 className="text-3xl font-bold font-gilroy text-globus-text mb-4">Offre non trouvée</h1>
        <Link to="/offres" className="text-globus-blue hover:underline flex items-center gap-1">
          <ArrowLeftIcon size={16} /> Retour aux offres
        </Link>
      </div>
    );
  }

  return (
    <>

      {/* Hero */}
      <section className="bg-globus-blue text-white py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4">
          <Link to="/offres" className="inline-flex items-center gap-1 text-blue-200 hover:text-white mb-6">
            <ArrowLeftIcon size={16} /> Toutes les offres
          </Link>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-semibold mb-4">
              {offer.universe}
            </span>
            <h1 className="text-4xl lg:text-5xl font-bold font-gilroy mb-4">
              {offer.hero_title || offer.name}
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl">
              {offer.hero_subtitle || offer.tagline || offer.description}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      {offer.features?.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl font-bold font-gilroy text-globus-text mb-10 text-center">
              Ce qui est inclus
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {offer.features.map((f: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="p-6 rounded-xl bg-globus-bg"
                >
                  <CheckCircle2Icon size={24} className="text-globus-blue mb-3" />
                  <h3 className="font-semibold text-globus-text mb-1">
                    {typeof f === 'string' ? f : f.name}
                  </h3>
                  {typeof f !== 'string' && f.description && (
                    <p className="text-sm text-gray-600">{f.description}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Offers / Packages */}
      {offer.offers?.length > 0 && (
        <section className="py-16 bg-globus-bg">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl font-bold font-gilroy text-globus-text mb-10 text-center">
              Nos formules
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {offer.offers.map((pkg: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white rounded-2xl shadow-lg p-8 flex flex-col"
                >
                  <h3 className="text-xl font-bold text-globus-text mb-2">{pkg.name}</h3>
                  <p className="text-gray-600 mb-4 flex-1">{pkg.description}</p>
                  {pkg.price_range && (
                    <div className="text-2xl font-bold text-globus-blue mb-4">{pkg.price_range}</div>
                  )}
                  {pkg.features?.map((feat: string, j: number) => (
                    <div key={j} className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                      <CheckCircle2Icon size={14} className="text-globus-success" /> {feat}
                    </div>
                  ))}
                  <Link
                    to="/decrire-mon-projet"
                    className="mt-6 block text-center bg-globus-blue text-white py-3 rounded-lg font-semibold hover:bg-globus-blue-dark transition-colors"
                  >
                    {pkg.cta || 'Demander un devis'}
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {offer.testimonials?.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-bold font-gilroy text-globus-text mb-10 text-center">
              Ils nous font confiance
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {offer.testimonials.map((t: any, i: number) => (
                <div key={i} className="bg-globus-bg rounded-xl p-6">
                  <div className="flex gap-1 mb-3">
                    {[...Array(5)].map((_, s) => (
                      <StarIcon key={s} size={16} className={s < (t.rating || 5) ? 'text-globus-orange fill-globus-orange' : 'text-gray-300'} />
                    ))}
                  </div>
                  <p className="text-gray-700 italic mb-4">"{t.text || t.content}"</p>
                  <div className="font-semibold text-globus-text">{t.name}</div>
                  {t.role && <div className="text-sm text-gray-500">{t.role}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {offer.faq?.length > 0 && (
        <section className="py-16 bg-globus-bg">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-3xl font-bold font-gilroy text-globus-text mb-10 text-center">
              Questions fréquentes
            </h2>
            <div className="space-y-4">
              {offer.faq.map((item: any, i: number) => (
                <details key={i} className="bg-white rounded-xl p-6 shadow-sm group">
                  <summary className="font-semibold text-globus-text cursor-pointer flex items-center justify-between">
                    {item.question || item.q}
                    <span className="text-globus-blue group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-gray-600 mt-3">{item.answer || item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 bg-globus-blue text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold font-gilroy mb-4">
            {offer.cta_title || 'Prêt à démarrer votre projet ?'}
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            {offer.cta_description || 'Contactez-nous pour obtenir un devis personnalisé et gratuit.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/decrire-mon-projet"
              className="inline-flex items-center justify-center gap-2 bg-globus-orange text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-globus-orange-hover transition-colors"
            >
              Décrire mon projet <ArrowRightIcon size={20} />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 bg-white/10 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/20 transition-colors"
            >
              <MessageCircleIcon size={20} /> Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
