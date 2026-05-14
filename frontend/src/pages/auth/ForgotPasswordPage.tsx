import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MailIcon, ArrowLeftIcon, SendIcon } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout';

export function ForgotPasswordPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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
      panelTitle="Récupérez votre accès en toute sécurité"
      panelDescription="Pas de panique ! Nous allons vous envoyer un lien sécurisé par e-mail pour réinitialiser votre mot de passe en quelques instants."
      backTo="/connexion"
      backLabel="Retour à la connexion"
    >
      {/* Heading */}
      <h1 className="font-montserrat font-extrabold text-2xl md:text-3xl text-globus-blue-dark mb-2">
        Mot de passe oublié
      </h1>

      {isSuccess ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mt-6"
        >
          <div className="w-16 h-16 bg-green-50 border-2 border-green-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <MailIcon className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-2 text-center">
            Email envoyé !
          </h3>
          <p className="font-opensans text-sm text-globus-gray mb-8 text-center leading-relaxed">
            Si un compte existe avec cette adresse, vous recevrez un lien
            sécurisé pour réinitialiser votre mot de passe.
          </p>
          <Link
            to="/connexion"
            className="w-full inline-flex items-center justify-center gap-2 bg-globus-blue-dark hover:bg-[#162d4a] text-white font-montserrat font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-globus-blue-dark/20 active:scale-[0.98]"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Retour à la connexion
          </Link>
        </motion.div>
      ) : (
        <>
          <p className="font-opensans text-sm text-globus-gray mb-8 leading-relaxed">
            Entrez votre adresse e-mail et nous vous enverrons un lien de
            réinitialisation.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="forgot-email"
                className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
              >
                Adresse E-mail
              </label>
              <input
                type="email"
                id="forgot-email"
                required
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-opensans text-sm focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20 transition-all placeholder:text-gray-400"
                placeholder="votre@email.com"
              />
            </div>

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
                  Envoi en cours...
                </span>
              ) : (
                <>
                  <SendIcon className="w-4 h-4" />
                  Envoyer le lien de réinitialisation
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link
              to="/connexion"
              className="inline-flex items-center justify-center gap-2 text-sm text-globus-gray hover:text-globus-blue-dark font-opensans font-semibold transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" /> Retour à la connexion
            </Link>
          </div>
        </>
      )}
    </AuthLayout>
  );
}