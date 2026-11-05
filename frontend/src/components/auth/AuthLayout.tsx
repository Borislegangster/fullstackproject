import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftIcon } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  /** Headline on the dark left panel */
  panelTitle?: string;
  /** Description on the dark left panel */
  panelDescription?: string;
  /** Where the "← Retour" link goes */
  backTo?: string;
  /** Label for the back link */
  backLabel?: string;
  /** Extra badge/icon on left panel */
  panelBadge?: React.ReactNode;
}

export function AuthLayout({
  children,
  panelTitle = 'Bienvenue sur Globus Engineering',
  panelDescription = 'Votre partenaire de confiance pour tous vos projets de construction et de génie civil au Cameroun.',
  backTo = '/',
  backLabel = 'Retour à l\'accueil',
  panelBadge,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ═══ LEFT PANEL — Dark branding ═══ */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[45%] relative overflow-hidden bg-globus-blue-dark flex-col justify-between p-10 xl:p-14">
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #0f1f35 0%, #1e3a5f 40%, #1a3050 100%)',
          }}
        />

        {/* Decorative shapes */}
        <svg
          className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-[0.07]"
          viewBox="0 0 600 800"
          fill="none"
        >
          <circle cx="450" cy="120" r="180" fill="#F97316" />
          <circle cx="80" cy="650" r="120" fill="#F97316" />
          <circle cx="520" cy="600" r="60" fill="#1D4ED8" />
          <circle cx="300" cy="400" r="8" fill="#BFDBFE" />
          <circle cx="150" cy="300" r="5" fill="#BFDBFE" />
          <circle cx="480" cy="350" r="6" fill="#BFDBFE" />
        </svg>

        {/* Wavy decorative line */}
        <svg
          className="absolute left-6 top-[30%] w-12 opacity-20 pointer-events-none"
          viewBox="0 0 40 300"
          fill="none"
        >
          <path
            d="M20 0 C5 30 35 60 20 90 C5 120 35 150 20 180 C5 210 35 240 20 270 C5 300 35 330 20 360"
            stroke="#00C6FF"
            strokeWidth="3"
            fill="none"
          />
        </svg>

        {/* Floating shapes — animated */}
        <motion.div
          className="absolute right-10 top-16 w-14 h-14 rounded-xl bg-globus-orange/30 backdrop-blur-sm"
          animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute left-8 bottom-32 w-10 h-10 rounded-full bg-globus-orange/40"
          animate={{ y: [0, 10, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          className="absolute right-24 bottom-48 w-6 h-6 rounded-full bg-seconda-blue/30"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Logo + brand */}
          <Link to="/" className="flex items-center gap-3 mb-16">
            <img
              src="/LogoGlobus.png"
              alt="Globus Engineering"
              className="h-10 object-contain brightness-0 invert"
            />
          </Link>

          {panelBadge && (
            <div className="mb-6">{panelBadge}</div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-montserrat font-extrabold text-3xl xl:text-4xl text-white leading-tight mb-6"
          >
            {panelTitle}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="font-opensans text-base text-white/70 leading-relaxed max-w-md"
          >
            {panelDescription}
          </motion.p>
        </div>

        {/* Bottom info */}
        <div className="relative z-10">
          <div className="flex items-center gap-6 mb-4">
            {[
              { value: '15+', label: "Ans d'expérience" },
              { value: '200+', label: 'Projets livrés' },
              { value: '100%', label: 'Satisfaction' },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + idx * 0.15 }}
                className="text-center"
              >
                <p className="font-montserrat font-extrabold text-xl text-globus-orange">
                  {stat.value}
                </p>
                <p className="font-opensans text-xs text-white/50 mt-0.5">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
          <p className="font-opensans text-xs text-white/30">
            © {new Date().getFullYear()} Globus Engineering SARL — Tous droits réservés
          </p>
        </div>
      </div>

      {/* ═══ RIGHT PANEL — Form area ═══ */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0">
        {/* Mobile header (shown only on small screens) */}
        <div className="lg:hidden bg-globus-blue-dark px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/LogoGlobus.png"
              alt="Globus"
              className="h-8 object-contain brightness-0 invert"
            />
          </Link>
          <Link
            to={backTo}
            className="flex items-center gap-1.5 text-white/70 text-sm font-opensans hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Retour
          </Link>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-12 xl:px-20 bg-white">
          <div className="w-full max-w-[440px]">
            {/* Back link — desktop only */}
            <Link
              to={backTo}
              className="hidden lg:inline-flex items-center gap-2 text-sm text-globus-gray hover:text-globus-blue-dark font-opensans font-medium transition-colors mb-8"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              {backLabel}
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {children}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
