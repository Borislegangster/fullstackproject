import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  HomeIcon,
  Building2Icon,
  SparklesIcon,
  GlobeIcon,
  WrenchIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  UsersIcon,
  CheckIcon,
  MessageSquareIcon,
} from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';

/* ── Universe data ───────────────────────────────────────────── */

interface Universe {
  slug: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accentColor: string;
  accentBg: string;
  accentText: string;
  tagline: string;
  target: string;
  offers: string[];
  mechanism: string;
  cta: string;
}

const universes: Universe[] = [
  {
    slug: 'home',
    title: 'GLOBUS HOME',
    subtitle: 'Particuliers',
    icon: HomeIcon,
    accentColor: '#385AA6',
    accentBg: 'bg-globus-primary',
    accentText: 'text-globus-primary',
    tagline: 'Votre maison, de l’idée aux finitions',
    target: 'Particuliers, familles, primo-accédants',
    offers: [
      'Home Start — Étude & conception',
      'Home Build — Construction clé en main',
      'Home Reno — Rénovation complète',
      'Home Finish — Finitions & aménagements',
    ],
    mechanism: 'Projection + Réassurance',
    cta: 'Découvrir Home',
  },
  {
    slug: 'business',
    title: 'GLOBUS BUSINESS',
    subtitle: 'Entreprises & Investisseurs',
    icon: Building2Icon,
    accentColor: '#1e3a5f',
    accentBg: 'bg-globus-blue-dark',
    accentText: 'text-globus-blue-dark',
    tagline: 'Espaces professionnels performants',
    target: 'Entreprises, promoteurs, investisseurs',
    offers: [
      'Business Build — Bureaux & commerces',
      'Business Industrial — Bâtiments industriels',
      'Business Invest — Immeubles de rapport',
    ],
    mechanism: 'ROI + Maîtrise',
    cta: 'Découvrir Business',
  },
  {
    slug: 'premium',
    title: 'GLOBUS PREMIUM',
    subtitle: 'Haut de gamme',
    icon: SparklesIcon,
    accentColor: '#B8860B',
    accentBg: 'bg-[#B8860B]',
    accentText: 'text-[#B8860B]',
    tagline: 'Architecture, confort, technologie',
    target: 'Clients exigeants, architectes',
    offers: [
      'Premium Villa — Villas d’exception',
      'Premium Smart — Domotique & smart home',
      'Premium Design — Architecture signature',
    ],
    mechanism: 'Projection + Exclusivité + Preuve',
    cta: 'Découvrir Premium',
  },
  {
    slug: 'diaspora',
    title: 'GLOBUS DIASPORA',
    subtitle: 'Camerounais à l’étranger',
    icon: GlobeIcon,
    accentColor: '#2E8B57',
    accentBg: 'bg-[#2E8B57]',
    accentText: 'text-[#2E8B57]',
    tagline: 'Construire au Cameroun à distance',
    target: 'Diaspora camerounaise, expatriés',
    offers: [
      'Diaspora Pilot — Suivi à distance en temps réel',
      'Diaspora Trust — Garanties & assurances renforcées',
      'Diaspora Build — Construction clé en main pilotée',
    ],
    mechanism: 'Confiance + Transparence + Contrôle',
    cta: 'Découvrir Diaspora',
  },
  {
    slug: 'engineering',
    title: 'ENGINEERING SERVICES',
    subtitle: 'Tous segments',
    icon: WrenchIcon,
    accentColor: '#FB8C43',
    accentBg: 'bg-globus-accent',
    accentText: 'text-globus-accent',
    tagline: 'Expertises transversales',
    target: 'Tous types de clients et projets',
    offers: [
      'Études de structure',
      'Ingénierie MEP',
      'VRD & Aménagement',
      'Management de projet',
    ],
    mechanism: 'Expertise + Preuve',
    cta: 'Découvrir nos expertises',
  },
];

/* ── Component ───────────────────────────────────────────────── */

export function OffresPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-52 xl:pt-36 sm:pt-36 pb-20">
      <SEOHead
        title="Nos Offres"
        description="Découvrez les 5 univers Globus Engineering : Home, Business, Premium, Diaspora et Engineering Services. Une offre adaptée à chaque projet de construction au Cameroun."
        keywords="construction Cameroun, offres BTP, maison clé en main, bâtiment industriel, diaspora, premium"
        canonicalPath="/offres"
      />

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 mb-6">
        <nav className="flex items-center text-sm font-poppins text-globus-gray">
          <Link
            to="/"
            className="hover:text-globus-accent transition-colors flex items-center gap-1"
          >
            <HomeIcon className="w-4 h-4" /> Accueil
          </Link>
          <ChevronRightIcon className="w-4 h-4 mx-2" />
          <span className="text-globus-primary font-semibold">Nos Offres</span>
        </nav>
      </div>

      {/* Hero Banner */}
      <section className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden mb-16 rounded-3xl mx-4 shadow-2xl">
        <div className="absolute inset-0 bg-globus-blue-dark/80 z-10" />
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-globus-blue-dark via-globus-primary to-globus-blue-dark" />

        <div className="relative z-20 text-center px-4 max-w-3xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl lg:text-6xl font-gilroy font-extrabold text-white mb-4"
          >
            5 Univers, 1 Engagement
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-lg md:text-xl text-seconda-blue font-poppins"
          >
            Quel que soit votre profil ou votre ambition, Globus Engineering a
            l&apos;offre qu&apos;il vous faut.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="h-1 w-24 bg-globus-accent mx-auto rounded-full mt-6"
          />
        </div>
      </section>

      {/* Universe Cards */}
      <section className="container mx-auto px-4 mb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {universes.map((u, idx) => {
            const Icon = u.icon;
            return (
              <motion.div
                key={u.slug}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
                className={`bg-white rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 overflow-hidden flex flex-col ${
                  idx === universes.length - 1 ? 'md:col-span-2 lg:col-span-1 lg:mx-auto lg:w-full' : ''
                }`}
                style={{ borderTop: `4px solid ${u.accentColor}` }}
              >
                <div className="p-8 flex flex-col flex-1">
                  {/* Icon + title */}
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
                      style={{ backgroundColor: u.accentColor }}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-gilroy font-extrabold text-xl text-globus-blue-dark leading-tight">
                        {u.title}
                      </h3>
                      <span className="text-sm font-poppins text-globus-gray">
                        {u.subtitle}
                      </span>
                    </div>
                  </div>

                  {/* Tagline */}
                  <p className="font-poppins font-semibold text-lg mb-3" style={{ color: u.accentColor }}>
                    {u.tagline}
                  </p>

                  {/* Target audience badge */}
                  <div className="inline-flex items-center gap-2 bg-globus-bg rounded-full px-4 py-1.5 mb-5 w-fit">
                    <UsersIcon className="w-4 h-4 text-globus-gray" />
                    <span className="text-sm font-poppins text-globus-gray">{u.target}</span>
                  </div>

                  {/* Offers list */}
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {u.offers.map((offer) => (
                      <li key={offer} className="flex items-start gap-2.5">
                        <CheckIcon
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: u.accentColor }}
                        />
                        <span className="text-sm font-poppins text-gray-700">{offer}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Mechanism tag */}
                  <div className="mb-6">
                    <span
                      className="inline-block text-xs font-poppins font-semibold tracking-wide uppercase px-3 py-1 rounded-full text-white"
                      style={{ backgroundColor: u.accentColor }}
                    >
                      {u.mechanism}
                    </span>
                  </div>

                  {/* CTA */}
                  <Link
                    to={`/offres/${u.slug}`}
                    className="group flex items-center justify-center gap-2 font-gilroy font-bold text-white py-3 px-6 rounded-xl transition-all hover:shadow-lg"
                    style={{ backgroundColor: u.accentColor }}
                  >
                    {u.cta}
                    <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto bg-gradient-to-br from-globus-primary to-globus-blue-dark rounded-3xl p-10 md:p-16 text-center text-white shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-globus-accent/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <MessageSquareIcon className="w-12 h-12 text-globus-accent mx-auto mb-6" />
            <h2 className="font-gilroy font-extrabold text-3xl md:text-4xl mb-4">
              Vous ne savez pas par o&ugrave; commencer ?
            </h2>
            <p className="font-poppins text-seconda-blue text-lg mb-8 max-w-xl mx-auto">
              D&eacute;crivez votre projet en quelques minutes. Notre &eacute;quipe vous
              orientera vers l&apos;offre la plus adapt&eacute;e &agrave; vos besoins.
            </p>
            <Link
              to="/decrire-mon-projet"
              className="inline-flex items-center gap-2 bg-globus-accent hover:bg-globus-accent-dark text-white font-gilroy font-bold py-4 px-8 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              D&eacute;crire mon projet
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
