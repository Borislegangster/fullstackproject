import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EyeIcon, EyeOffIcon, UserPlusIcon } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout';

export function RegisterPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      navigate('/connexion');
    }, 1500);
  };

  return (
    <AuthLayout
      panelTitle="Rejoignez l'excellence en construction"
      panelDescription="Créez votre compte client pour accéder au suivi en temps réel de vos projets, documents et échanges avec nos équipes."
      backTo="/connexion"
      backLabel="Retour à la connexion"
    >
      {/* Heading */}
      <h1 className="font-montserrat font-extrabold text-2xl md:text-3xl text-globus-blue-dark mb-2">
        Créer un compte
      </h1>
      <p className="font-opensans text-xs text-globus-orange bg-globus-orange/10 py-2 px-3 rounded-lg inline-block mb-7">
        Note : La création de compte est réservée aux clients ayant signé un contrat.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div>
          <label
            htmlFor="register-name"
            className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
          >
            Nom Complet
          </label>
          <input
            type="text"
            id="register-name"
            required
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 transition-all placeholder:text-gray-400"
            placeholder="Jean Dupont"
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="register-email"
            className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
          >
            Adresse E-mail
          </label>
          <input
            type="email"
            id="register-email"
            required
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 transition-all placeholder:text-gray-400"
            placeholder="votre@email.com"
          />
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="register-phone"
            className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
          >
            Numéro de Téléphone
          </label>
          <input
            type="tel"
            id="register-phone"
            required
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 transition-all placeholder:text-gray-400"
            placeholder="+237 6 00 00 00 00"
          />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="register-password"
            className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
          >
            Mot de passe
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="register-password"
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
                <EyeOffIcon className="w-4 h-4" />
              ) : (
                <EyeIcon className="w-4 h-4" />
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
            htmlFor="register-confirm"
            className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
          >
            Confirmation du mot de passe
          </label>
          <input
            type="password"
            id="register-confirm"
            required
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 transition-all placeholder:text-gray-400"
            placeholder="••••••••"
          />
        </div>

        {/* Terms */}
        <div className="flex items-start mt-2">
          <input
            type="checkbox"
            id="register-terms"
            required
            className="mt-1 w-4 h-4 text-globus-orange bg-gray-100 border-gray-300 rounded focus:ring-globus-orange"
          />
          <label
            htmlFor="register-terms"
            className="ml-2.5 text-xs font-opensans text-globus-gray leading-relaxed"
          >
            J'accepte les{' '}
            <Link
              to="/termes-et-conditions"
              className="text-globus-blue hover:underline"
            >
              Termes et Conditions
            </Link>{' '}
            et la{' '}
            <Link
              to="/politique-de-confidentialite"
              className="text-globus-blue hover:underline"
            >
              Politique de confidentialité
            </Link>
            .
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-globus-blue-dark hover:bg-[#162d4a] text-white font-montserrat font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-globus-blue-dark/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-70 active:scale-[0.98]"
        >
          {isSubmitting ? (
            'Création en cours...'
          ) : (
            <>
              <UserPlusIcon className="w-5 h-5" /> Créer mon compte
            </>
          )}
        </button>
      </form>

      {/* Footer link */}
      <div className="mt-7 pt-5 border-t border-gray-100 text-center">
        <p className="font-opensans text-sm text-globus-gray">
          Déjà un compte ?{' '}
          <Link
            to="/connexion"
            className="text-globus-orange font-bold hover:text-globus-orange-hover transition-colors"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}