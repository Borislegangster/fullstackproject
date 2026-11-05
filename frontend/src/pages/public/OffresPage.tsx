import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, HomeIcon, BuildingIcon, CrownIcon, GlobeIcon, WrenchIcon, CheckCircle2Icon } from 'lucide-react';


const universes = [
  {
    id: 'home',
    slug: 'home',
    name: 'GLOBUS HOME',
    tagline: 'Votre maison, notre expertise',
    description: 'Construction résidentielle sur-mesure pour particuliers. Villa moderne, maison traditionnelle ou résidence haut de gamme.',
    icon: HomeIcon,
    color: '#385AA6',
    features: ['Plans architecturaux personnalisés', 'Suivi de chantier en temps réel', 'Garantie décennale', 'Finitions haut de gamme'],
    image: '/images/universe-home.jpg',
  },
  {
    id: 'business',
    slug: 'business',
    name: 'GLOBUS BUSINESS',
    tagline: 'Construire votre succès',
    description: 'Solutions de construction commerciale et industrielle. Bureaux, entrepôts, centres commerciaux et bâtiments professionnels.',
    icon: BuildingIcon,
    color: '#FB8C43',
    features: ['Études de faisabilité', 'Respect des normes commerciales', 'Optimisation des espaces', 'Livraison clé en main'],
    image: '/images/universe-business.jpg',
  },
  {
    id: 'premium',
    slug: 'premium',
    name: 'GLOBUS PREMIUM',
    tagline: 'L\'excellence sans compromis',
    description: 'Projets d\'exception avec matériaux premium, technologies de pointe et finitions luxueuses pour les plus exigeants.',
    icon: CrownIcon,
    color: '#C7A94F',
    features: ['Architecte dédié', 'Matériaux importés premium', 'Domotique intégrée', 'Conciergerie chantier'],
    image: '/images/universe-premium.jpg',
  },
  {
    id: 'diaspora',
    slug: 'diaspora',
    name: 'GLOBUS DIASPORA',
    tagline: 'Construisez au Cameroun depuis l\'étranger',
    description: 'Service complet pour la diaspora camerounaise. Construisez votre projet à distance avec un suivi 100% digital.',
    icon: GlobeIcon,
    color: '#16A34A',
    features: ['Suivi vidéo en direct', 'Rapports hebdomadaires', 'Paiements sécurisés internationaux', 'Gestion administrative complète'],
    image: '/images/universe-diaspora.jpg',
  },
  {
    id: 'engineering',
    slug: 'engineering-services',
    name: 'SERVICES D\'INGÉNIERIE',
    tagline: 'Expertise technique pointue',
    description: 'Bureau d\'études, topographie, géotechnique, BIM, expertise structurelle et conseil technique pour professionnels.',
    icon: WrenchIcon,
    color: '#7C3AED',
    features: ['Études structurelles', 'Modélisation BIM', 'Topographie & géotechnique', 'Audit technique'],
    image: '/images/universe-engineering.jpg',
  },
];

export function OffresPage() {
  useEffect(() => { document.title = 'Nos Offres | Globus Engineering'; }, []);
  return (
    <>
      {/* Hero */}
      <section className="bg-globus-blue text-white py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-5xl font-bold font-gilroy mb-6"
          >
            Nos Univers & Offres
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-blue-100 max-w-3xl mx-auto"
          >
            Une offre adaptée à chaque projet, chaque ambition, chaque besoin.
            Globus Engineering vous accompagne avec des solutions sur-mesure.
          </motion.p>
        </div>
      </section>

      {/* Universe Cards */}
      <section className="py-16 lg:py-24 bg-globus-bg">
        <div className="max-w-7xl mx-auto px-4 space-y-16">
          {universes.map((u, idx) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`flex flex-col ${idx % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-8 lg:gap-12 items-center`}
            >
              {/* Image placeholder */}
              <div className="w-full lg:w-1/2">
                <div
                  className="aspect-[4/3] rounded-2xl shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: u.color + '15' }}
                >
                  <u.icon size={80} style={{ color: u.color }} strokeWidth={1.5} />
                </div>
              </div>

              {/* Content */}
              <div className="w-full lg:w-1/2">
                <div
                  className="inline-block px-3 py-1 rounded-full text-sm font-semibold text-white mb-4"
                  style={{ backgroundColor: u.color }}
                >
                  {u.name}
                </div>
                <h2 className="text-3xl font-bold font-gilroy text-globus-text mb-2">
                  {u.tagline}
                </h2>
                <p className="text-gray-600 mb-6">{u.description}</p>
                <ul className="space-y-2 mb-8">
                  {u.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-gray-700">
                      <CheckCircle2Icon size={18} style={{ color: u.color }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/offres/${u.slug}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-transform hover:scale-105"
                  style={{ backgroundColor: u.color }}
                >
                  Découvrir {u.name}
                  <ArrowRightIcon size={18} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold font-gilroy text-globus-text mb-4">
            Vous ne savez pas quelle offre choisir ?
          </h2>
          <p className="text-gray-600 mb-8">
            Décrivez votre projet et nos experts vous orienteront vers la solution la plus adaptée.
          </p>
          <Link
            to="/decrire-mon-projet"
            className="inline-flex items-center gap-2 bg-globus-orange text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-globus-orange-hover transition-colors"
          >
            Décrire mon projet
            <ArrowRightIcon size={20} />
          </Link>
        </div>
      </section>
    </>
  );
}
