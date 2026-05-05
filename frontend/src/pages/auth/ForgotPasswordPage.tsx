import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MailIcon, ArrowLeftIcon } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-globus-blue-dark to-globus-blue relative overflow-hidden py-12 px-4">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }}>
      </div>

      <motion.div
        initial={{
          opacity: 0,
          scale: 0.95,
          y: 20
        }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0
        }}
        transition={{
          duration: 0.4
        }}
        className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 max-w-md w-full relative z-10">
        
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-6">
            <img
              src="/LogoGlobus.png"
              alt="Globus BTP Logo"
              className="h-12 object-contain mx-auto" />
            
          </Link>
          <h1 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark mb-2">
            Mot de passe oublié
          </h1>
        </div>

        {isSuccess ?
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          className="text-center">
          
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MailIcon className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-2">
              Email envoyé !
            </h3>
            <p className="font-opensans text-sm text-globus-gray mb-8">
              Si un compte existe avec cette adresse, vous recevrez un lien
              sécurisé pour réinitialiser votre mot de passe.
            </p>
            <Link
            to="/connexion"
            className="inline-flex items-center justify-center gap-2 text-globus-blue font-bold hover:underline">
            
              <ArrowLeftIcon className="w-4 h-4" /> Retour à la connexion
            </Link>
          </motion.div> :

        <>
            <p className="font-opensans text-sm text-globus-gray text-center mb-6">
              Entrez votre adresse e-mail et nous vous enverrons un lien de
              réinitialisation.
            </p>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                htmlFor="email"
                className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                
                  Adresse E-mail
                </label>
                <input
                type="email"
                id="email"
                required
                className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-3 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors"
                placeholder="votre@email.com" />
              
              </div>

              <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-70">
              
                {isSubmitting ?
              'Envoi en cours...' :
              'Envoyer le lien de réinitialisation'}
              </button>
            </form>

            <div className="mt-8 text-center">
              <Link
              to="/connexion"
              className="inline-flex items-center justify-center gap-2 text-sm text-globus-gray hover:text-globus-blue font-semibold transition-colors">
              
                <ArrowLeftIcon className="w-4 h-4" /> Retour à la connexion
              </Link>
            </div>
          </>
        }
      </motion.div>
    </div>);

}