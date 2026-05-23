import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  EyeIcon,
  EyeOffIcon,
  LogInIcon,
  AlertCircleIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../context/AuthContext';

export function ErpLoginPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Redirect if already authenticated as ADMIN
  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      navigate('/erp', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login({ email, password });
      // After login we check the role — only ADMIN can access ERP
      // The role check will happen via the ProtectedRoute wrapping /erp
      navigate('/erp');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        setError('Trop de tentatives. Veuillez patienter avant de réessayer.');
      } else if (status === 401) {
        setError('Identifiants incorrects. Vérifiez votre email et mot de passe.');
      } else {
        setError('Une erreur est survenue. Veuillez réessayer plus tard.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      panelTitle="Plateforme de Gestion Interne"
      panelDescription="Accédez à l'ERP Globus pour gérer vos projets, équipes, finances et l'ensemble des opérations de l'entreprise."
      backTo="/"
      backLabel="Retour au site"
      panelBadge={
        <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/80 text-xs font-montserrat font-bold px-3 py-1.5 rounded-lg">
          <ShieldCheckIcon className="w-3.5 h-3.5 text-globus-orange" />
          ACCÈS ADMINISTRATEUR
        </span>
      }
    >
      {/* Heading */}
      <div className="flex items-center gap-2.5 mb-2">
        <ShieldCheckIcon className="w-6 h-6 text-globus-orange" />
        <h1 className="font-montserrat font-extrabold text-2xl md:text-3xl text-globus-blue-dark">
          Globus ERP
        </h1>
      </div>
      <p className="font-opensans text-sm text-globus-gray mb-8">
        Connexion à la plateforme de gestion interne.
      </p>

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
            htmlFor="erp-email"
            className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
          >
            Adresse E-mail
          </label>
          <input
            type="email"
            id="erp-email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 transition-all placeholder:text-gray-400"
            placeholder="admin@globus-btp.com"
          />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="erp-password"
            className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
          >
            Mot de passe
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="erp-password"
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

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-globus-orange/20 flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[0.98]"
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
              Connexion...
            </span>
          ) : (
            <>
              <LogInIcon className="w-5 h-5" /> Accéder à l'ERP
            </>
          )}
        </button>
      </form>

      {/* Footer link */}
      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <p className="font-opensans text-sm text-globus-gray">
          Espace Client ?{' '}
          <Link
            to="/connexion"
            className="text-globus-blue font-bold hover:underline"
          >
            Se connecter ici
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}