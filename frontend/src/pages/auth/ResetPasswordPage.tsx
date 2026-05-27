import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EyeIcon, EyeOffIcon, CheckCircleIcon, SaveIcon, AlertCircleIcon, ShieldCheckIcon } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth, getLandingPage } from '../../context/AuthContext';

export function ResetPasswordPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setNewPassword, user, forceReset } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Get invitation token from URL if present (onboarding flow)
  const invitationToken = searchParams.get('token') || undefined;

  const getPasswordStrength = (pass: string) => {
    if (pass.length === 0)
      return { score: 0, label: '', color: 'bg-gray-200' };
    
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1)
      return { score: 1, label: 'Faible', color: 'bg-red-500' };
    if (score <= 2)
      return { score: 2, label: 'Moyen', color: 'bg-yellow-500' };
    return { score: 3, label: 'Fort', color: 'bg-green-500' };
  };

  const strength = getPasswordStrength(password);

  const passwordRules = [
    { label: 'Au moins 8 caractères', met: password.length >= 8 },
    { label: 'Une majuscule et une minuscule', met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'Un chiffre', met: /\d/.test(password) },
    { label: 'Un caractère spécial', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (strength.score < 2) {
      setError('Le mot de passe est trop faible. Ajoutez des majuscules, chiffres ou caractères spéciaux.');
      return;
    }

    setIsSubmitting(true);
    try {
      await setNewPassword(password, invitationToken);
      setIsSuccess(true);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 400) {
        setError(err?.response?.data?.detail || 'Le mot de passe ne respecte pas les exigences de sécurité.');
      } else if (status === 401) {
        setError("Votre session a expiré. Veuillez vous reconnecter.");
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    const role = user?.role || 'CLIENT';
    navigate(getLandingPage(role), { replace: true });
  };

  return (
    <AuthLayout
      panelTitle="Sécurisez votre compte"
      panelDescription="Définissez un nouveau mot de passe robuste pour protéger l'accès à votre espace Globus Engineering."
      backTo={forceReset ? undefined : "/connexion"}
      backLabel={forceReset ? undefined : "Retour à la connexion"}
    >
      {/* Force Reset Banner */}
      {forceReset && !isSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-5 flex items-start gap-3"
        >
          <ShieldCheckIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-montserrat font-bold text-sm text-amber-800">
              Changement de mot de passe obligatoire
            </p>
            <p className="font-opensans text-xs text-amber-600 mt-0.5">
              Pour des raisons de sécurité, vous devez définir un nouveau mot de passe avant de continuer.
            </p>
          </div>
        </motion.div>
      )}

      {/* Heading */}
      <h1 className="font-montserrat font-extrabold text-2xl md:text-3xl text-globus-blue-dark mb-2">
        {forceReset ? 'Créez votre mot de passe' : 'Nouveau mot de passe'}
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
            Mot de passe {forceReset ? 'créé' : 'modifié'} avec succès !
          </h3>
          <p className="font-opensans text-sm text-globus-gray mb-8 text-center leading-relaxed">
            {forceReset 
              ? 'Votre compte est maintenant prêt. Vous pouvez accéder à votre espace.'
              : 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.'}
          </p>
          {forceReset ? (
            <button
              onClick={handleContinue}
              className="w-full inline-flex items-center justify-center gap-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-globus-orange/20 active:scale-[0.98]"
            >
              Accéder à mon espace
            </button>
          ) : (
            <Link
              to="/connexion"
              className="w-full inline-flex items-center justify-center gap-2 bg-globus-blue-dark hover:bg-[#162d4a] text-white font-montserrat font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-globus-blue-dark/20 active:scale-[0.98]"
            >
              Aller à la connexion
            </Link>
          )}
        </motion.div>
      ) : (
        <>
          <p className="font-opensans text-sm text-globus-gray mb-6 leading-relaxed">
            Choisissez un mot de passe sécurisé pour protéger votre compte.
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
                  autoComplete="new-password"
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

            {/* Password Requirements */}
            {password.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                {passwordRules.map((rule) => (
                  <div key={rule.label} className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        rule.met ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      {rule.met && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-xs font-opensans ${rule.met ? 'text-green-700' : 'text-gray-500'}`}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="reset-confirm"
                className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2"
              >
                Confirmation du mot de passe
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  id="reset-confirm"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full bg-white border rounded-xl px-4 py-3 font-opensans text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 pr-12 ${
                    confirmPassword.length > 0 && password !== confirmPassword
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                      : confirmPassword.length > 0 && password === confirmPassword
                      ? 'border-green-300 focus:border-green-400 focus:ring-green-200'
                      : 'border-gray-200 focus:border-globus-orange focus:ring-globus-orange/20'
                  }`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-globus-blue-dark transition-colors"
                >
                  {showConfirm ? (
                    <EyeOffIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-red-500 font-opensans mt-1.5">
                  Les mots de passe ne correspondent pas
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || strength.score < 2 || password !== confirmPassword || password.length < 8}
              className="w-full bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-globus-orange/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
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
                  {forceReset ? 'Créer mon mot de passe' : 'Enregistrer le nouveau mot de passe'}
                </>
              )}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}