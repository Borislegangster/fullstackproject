import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EyeIcon, EyeOffIcon, LogInIcon, AlertCircleIcon } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout';

const MOCK_CREDENTIALS = {
  email: 'jean.talla@email.com',
  password: 'Globus2024!',
};

export function LoginPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    setTimeout(() => {
      if (
        email.toLowerCase() === MOCK_CREDENTIALS.email &&
        password === MOCK_CREDENTIALS.password
      ) {
        navigate('/espace-client');
      } else {
        setError('Email ou mot de passe incorrect. Veuillez réessayer.');
        setIsSubmitting(false);
      }
    }, 1200);
  };

  return (
    <AuthLayout
      panelTitle="Suivez vos chantiers en temps réel"
      panelDescription="Accédez à votre espace client sécurisé pour consulter l'avancement de vos projets, vos documents et communiquer avec nos équipes."
      backTo="/"
      backLabel="Retour à l'accueil"
    >
      {/* Heading */}
      <h1 className="font-montserrat font-extrabold text-2xl md:text-3xl text-globus-blue-dark mb-2">
        Bienvenue !
      </h1>
      <p className="font-opensans text-sm text-globus-gray mb-8">
        Connectez-vous à votre espace client.
      </p>

      {/* Demo Credentials Banner */}
      <div className="bg-globus-blue-dark/[0.03] border border-globus-blue-dark/10 rounded-xl p-4 mb-6">
        <p className="font-montserrat font-bold text-[11px] text-globus-blue-dark mb-2 uppercase tracking-wider">
          🔐 Identifiants de démonstration
        </p>
        <div className="space-y-1 font-opensans text-sm text-globus-gray">
          <p>
            Email :{' '}
            <span className="font-mono font-semibold text-globus-blue-dark select-all">
              jean.talla@email.com
            </span>
          </p>
          <p>
            Mot de passe :{' '}
            <span className="font-mono font-semibold text-globus-blue-dark select-all">
              Globus2024!
            </span>
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-5 flex items-center gap-3"
        >
          <AlertCircleIcon className="w-5 h-5 text-red-500 shrink-0" />
          <p className="font-opensans text-sm text-red-700">{error}</p>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label
            htmlFor="login-email"
            className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
          >
            Adresse E-mail
          </label>
          <input
            type="email"
            id="login-email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 transition-all placeholder:text-gray-400"
            placeholder="jean.talla@email.com"
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label
              htmlFor="login-password"
              className="block font-montserrat font-semibold text-globus-blue-dark text-sm"
            >
              Mot de passe
            </label>
            <Link
              to="/mot-de-passe-oublie"
              className="text-sm text-globus-orange hover:text-globus-orange-hover font-opensans font-semibold transition-colors"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="login-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 transition-all placeholder:text-gray-400 pr-12"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-globus-blue-dark transition-colors"
            >
              {showPassword ? (
                <EyeOffIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="login-remember"
            className="w-4 h-4 text-globus-orange bg-gray-100 border-gray-300 rounded focus:ring-globus-orange"
          />
          <label
            htmlFor="login-remember"
            className="ml-2.5 text-sm font-opensans text-globus-gray"
          >
            Se souvenir de moi
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-globus-blue-dark hover:bg-[#162d4a] text-white font-montserrat font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-globus-blue-dark/20 flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[0.98]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Connexion en cours...
            </span>
          ) : (
            <>
              <LogInIcon className="w-5 h-5" /> Connexion
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <p className="font-opensans text-sm text-globus-gray">
          Pas encore de compte ?{' '}
          <Link
            to="/inscription"
            className="text-globus-orange font-bold hover:text-globus-orange-hover transition-colors"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}