import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EyeIcon, EyeOffIcon, CheckCircleIcon, SaveIcon } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout';

export function ResetPasswordPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const getPasswordStrength = (pass: string) => {
    if (pass.length === 0)
      return { score: 0, label: '', color: 'bg-gray-200' };
    if (pass.length < 6)
      return { score: 1, label: 'Faible', color: 'bg-red-500' };
    if (pass.length < 10 || !/\d/.test(pass))
      return { score: 2, label: 'Moyen', color: 'bg-yellow-500' };
    return { score: 3, label: 'Fort', color: 'bg-green-500' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 1500);
  };

  return (
    <AuthLayout
      panelTitle="Sécurisez votre compte"
      panelDescription="Définissez un nouveau mot de passe robuste pour protéger l'accès à votre espace client Globus Engineering."
      backTo="/connexion"
      backLabel="Retour à la connexion"
    >
      {/* Heading */}
      <h1 className="font-montserrat font-extrabold text-2xl md:text-3xl text-globus-blue-dark mb-2">
        Nouveau mot de passe
      </h1>

      {isSuccess ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mt-6"
        >
          <div className="w-16 h-16 bg-green-50 border-2 border-green-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-2 text-center">
            Mot de passe modifié avec succès !
          </h3>
          <p className="font-opensans text-sm text-globus-gray mb-8 text-center leading-relaxed">
            Vous pouvez maintenant vous connecter avec votre nouveau mot de
            passe.
          </p>
          <Link
            to="/connexion"
            className="w-full inline-flex items-center justify-center gap-2 bg-globus-blue-dark hover:bg-[#162d4a] text-white font-montserrat font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-globus-blue-dark/20 active:scale-[0.98]"
          >
            Aller à la connexion
          </Link>
        </motion.div>
      ) : (
        <>
          <p className="font-opensans text-sm text-globus-gray mb-8 leading-relaxed">
            Choisissez un mot de passe sécurisé contenant au moins 8 caractères.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div>
              <label
                htmlFor="reset-password"
                className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
              >
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="reset-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {/* Password Strength Meter */}
              {password.length > 0 && (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="flex-1 flex gap-1 h-1.5">
                    <div
                      className={`flex-1 rounded-full transition-colors ${
                        strength.score >= 1 ? strength.color : 'bg-gray-200'
                      }`}
                    />
                    <div
                      className={`flex-1 rounded-full transition-colors ${
                        strength.score >= 2 ? strength.color : 'bg-gray-200'
                      }`}
                    />
                    <div
                      className={`flex-1 rounded-full transition-colors ${
                        strength.score >= 3 ? strength.color : 'bg-gray-200'
                      }`}
                    />
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      strength.score === 1
                        ? 'text-red-500'
                        : strength.score === 2
                        ? 'text-yellow-500'
                        : 'text-green-500'
                    }`}
                  >
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="reset-confirm"
                className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
              >
                Confirmation du nouveau mot de passe
              </label>
              <input
                type="password"
                id="reset-confirm"
                required
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 transition-all placeholder:text-gray-400"
                placeholder="••••••••"
              />
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
                  Enregistrement...
                </span>
              ) : (
                <>
                  <SaveIcon className="w-4 h-4" />
                  Enregistrer mon nouveau mot de passe
                </>
              )}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}