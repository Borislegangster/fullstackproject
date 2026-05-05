import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EyeIcon, EyeOffIcon, CheckCircleIcon } from 'lucide-react';
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
            Nouveau mot de passe
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
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-2">
              Mot de passe modifié avec succès !
            </h3>
            <p className="font-opensans text-sm text-globus-gray mb-8">
              Vous pouvez maintenant vous connecter avec votre nouveau mot de
              passe.
            </p>
            <Link
            to="/connexion"
            className="w-full inline-block bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold py-3 px-6 rounded-lg transition-colors shadow-md">
            
              Aller à la connexion
            </Link>
          </motion.div> :

        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
              htmlFor="password"
              className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
              
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
              
                Confirmation du nouveau mot de passe
              </label>
              <input
              type="password"
              id="confirm"
              required
              className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-3 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors"
              placeholder="••••••••" />
            
            </div>

            <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-70">
            
              {isSubmitting ?
            'Enregistrement...' :
            'Enregistrer mon nouveau mot de passe'}
            </button>
          </form>
        }
      </motion.div>
    </div>);

}