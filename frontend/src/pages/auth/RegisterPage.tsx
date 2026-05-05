import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EyeIcon, EyeOffIcon, UserPlusIcon } from 'lucide-react';
export function RegisterPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Simple password strength calculator
  const getPasswordStrength = (pass: string) => {
    if (pass.length === 0)
    return {
      score: 0,
      label: '',
      color: 'bg-gray-200'
    };
    if (pass.length < 6)
    return {
      score: 1,
      label: 'Faible',
      color: 'bg-red-500'
    };
    if (pass.length < 10 || !/\d/.test(pass))
    return {
      score: 2,
      label: 'Moyen',
      color: 'bg-yellow-500'
    };
    return {
      score: 3,
      label: 'Fort',
      color: 'bg-green-500'
    };
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
        
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-4">
            <img
              src="/LogoGlobus.png"
              alt="Globus BTP Logo"
              className="h-10 object-contain mx-auto" />
            
          </Link>
          <h1 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark mb-2">
            Créer un compte
          </h1>
          <p className="font-opensans text-xs text-globus-orange bg-globus-orange/10 p-2 rounded-lg inline-block">
            Note : La création de compte est réservée aux clients ayant signé un
            contrat.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
              
              Nom Complet
            </label>
            <input
              type="text"
              id="name"
              required
              className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors"
              placeholder="Jean Dupont" />
            
          </div>

          <div>
            <label
              htmlFor="email"
              className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
              
              Adresse E-mail
            </label>
            <input
              type="email"
              id="email"
              required
              className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors"
              placeholder="votre@email.com" />
            
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
              
              Numéro de Téléphone
            </label>
            <input
              type="tel"
              id="phone"
              required
              className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors"
              placeholder="+33 6 00 00 00 00" />
            
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
              
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors pr-12"
                placeholder="••••••••" />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-globus-blue-dark transition-colors">
                
                {showPassword ?
                <EyeOffIcon className="w-4 h-4" /> :

                <EyeIcon className="w-4 h-4" />
                }
              </button>
            </div>
            {/* Password Strength Meter */}
            {password.length > 0 &&
            <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 flex gap-1 h-1.5">
                  <div
                  className={`flex-1 rounded-full ${strength.score >= 1 ? strength.color : 'bg-gray-200'}`}>
                </div>
                  <div
                  className={`flex-1 rounded-full ${strength.score >= 2 ? strength.color : 'bg-gray-200'}`}>
                </div>
                  <div
                  className={`flex-1 rounded-full ${strength.score >= 3 ? strength.color : 'bg-gray-200'}`}>
                </div>
                </div>
                <span
                className={`text-xs font-bold ${strength.score === 1 ? 'text-red-500' : strength.score === 2 ? 'text-yellow-500' : 'text-green-500'}`}>
                
                  {strength.label}
                </span>
              </div>
            }
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-1">
              
              Confirmation du mot de passe
            </label>
            <input
              type="password"
              id="confirm"
              required
              className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-2.5 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors"
              placeholder="••••••••" />
            
          </div>

          <div className="flex items-start mt-4">
            <input
              type="checkbox"
              id="terms"
              required
              className="mt-1 w-4 h-4 text-globus-orange bg-gray-100 border-gray-300 rounded focus:ring-globus-orange" />
            
            <label
              htmlFor="terms"
              className="ml-2 text-xs font-opensans text-globus-gray leading-tight">
              
              J'accepte les{' '}
              <Link
                to="/termes-et-conditions"
                className="text-globus-blue hover:underline">
                
                Termes et Conditions
              </Link>{' '}
              et la{' '}
              <Link
                to="/politique-de-confidentialite"
                className="text-globus-blue hover:underline">
                
                Politique de confidentialité
              </Link>
              .
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold py-3 px-6 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-70">
            
            {isSubmitting ?
            'Création...' :

            <>
                <UserPlusIcon className="w-5 h-5" /> Créer mon compte
              </>
            }
          </button>
        </form>

        <div className="mt-6 text-center border-t border-gray-100 pt-4">
          <p className="font-opensans text-sm text-globus-gray">
            Déjà un compte ?{' '}
            <Link
              to="/connexion"
              className="text-globus-orange font-bold hover:underline">
              
              Se connecter
            </Link>
          </p>
        </div>
      </motion.div>
    </div>);

}