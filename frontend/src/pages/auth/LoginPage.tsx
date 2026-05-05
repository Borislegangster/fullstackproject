import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EyeIcon, EyeOffIcon, LogInIcon, AlertCircleIcon } from 'lucide-react';
const MOCK_CREDENTIALS = {
  email: 'jean.talla@email.com',
  password: 'Globus2024!'
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
      password === MOCK_CREDENTIALS.password)
      {
        navigate('/espace-client');
      } else {
        setError('Email ou mot de passe incorrect. Veuillez réessayer.');
        setIsSubmitting(false);
      }
    }, 1200);
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-globus-blue-dark to-globus-blue relative overflow-hidden py-12 px-4">
      {/* Subtle background pattern overlay */}
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
            Connexion
          </h1>
          <p className="font-opensans text-sm text-globus-gray">
            Accédez à votre espace client pour suivre vos chantiers.
          </p>
        </div>

        {/* Demo Credentials Banner */}
        <div className="bg-globus-blue/5 border border-globus-blue/20 rounded-xl p-4 mb-6">
          <p className="font-montserrat font-bold text-xs text-globus-blue-dark mb-2 uppercase tracking-wider">
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

        {error &&
        <motion.div
          initial={{
            opacity: 0,
            y: -10
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5 flex items-center gap-3">
          
            <AlertCircleIcon className="w-5 h-5 text-red-500 shrink-0" />
            <p className="font-opensans text-sm text-red-700">{error}</p>
          </motion.div>
        }

        <form onSubmit={handleSubmit} className="space-y-5">
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
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-3 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors"
              placeholder="jean.talla@email.com" />
            
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label
                htmlFor="password"
                className="block font-montserrat font-semibold text-globus-blue-dark text-sm">
                
                Mot de passe
              </label>
              <Link
                to="/mot-de-passe-oublie"
                className="text-sm text-globus-orange hover:underline font-opensans font-semibold">
                
                Mot de passe oublié ?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-3 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors pr-12"
                placeholder="••••••••" />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-globus-blue-dark transition-colors">
                
                {showPassword ?
                <EyeOffIcon className="w-5 h-5" /> :

                <EyeIcon className="w-5 h-5" />
                }
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="remember"
              className="w-4 h-4 text-globus-orange bg-gray-100 border-gray-300 rounded focus:ring-globus-orange" />
            
            <label
              htmlFor="remember"
              className="ml-2 text-sm font-opensans text-globus-gray">
              
              Se souvenir de moi
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3 px-6 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 mt-4 disabled:opacity-70">
            
            {isSubmitting ?
            <span className="flex items-center gap-2">
                <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24">
                
                  <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4">
                </circle>
                  <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                </path>
                </svg>
                Connexion en cours...
              </span> :

            <>
                <LogInIcon className="w-5 h-5" /> Se connecter
              </>
            }
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 pt-6">
          <p className="font-opensans text-sm text-globus-gray">
            Pas encore de compte ?{' '}
            <Link
              to="/inscription"
              className="text-globus-blue font-bold hover:underline">
              
              Créer un compte
            </Link>
          </p>
        </div>
      </motion.div>
    </div>);

}