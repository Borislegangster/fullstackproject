/**
 * TwoFactorChallengeForm — Reusable second-step login form.
 *
 * Used by both LoginPage (client portal) and ErpLoginPage (staff portal).
 * Submits the TOTP / backup code against the challenge token returned by the
 * `/auth/login` 2FA branch.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircleIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type Theme = 'client' | 'erp';

interface Props {
  challengeToken: string;
  /** Called after a successful verification with the resolved role. */
  onSuccess: (role: string, forceReset: boolean) => void;
  onCancel: () => void;
  theme?: Theme;
}

export function TwoFactorChallengeForm({
  challengeToken,
  onSuccess,
  onCancel,
  theme = 'client',
}: Props) {
  const { complete2FA } = useAuth();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submitColor =
    theme === 'erp'
      ? 'bg-globus-orange hover:bg-globus-orange-hover shadow-globus-orange/20'
      : 'bg-globus-blue-dark hover:bg-[#162d4a] shadow-globus-blue-dark/20';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setError('');
    setIsSubmitting(true);
    try {
      const result = await complete2FA(challengeToken, code);
      onSuccess(result.role, result.forceReset);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Code invalide');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <h1 className="font-montserrat font-extrabold text-2xl md:text-3xl text-globus-blue-dark mb-2">
        Vérification en deux étapes
      </h1>
      <p className="font-opensans text-sm text-globus-gray mb-8">
        Saisissez le code à 6 chiffres affiché par votre application
        d'authentification (ou un code de secours).
      </p>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-5 flex items-center gap-3">
          <AlertCircleIcon className="w-5 h-5 text-red-500 shrink-0" />
          <p className="font-opensans text-sm text-red-700">{error}</p>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError('');
          }}
          autoFocus
          placeholder="123456"
          className="w-full text-center text-2xl font-mono tracking-widest bg-white border border-gray-200 rounded-xl px-4 py-4 focus:outline-none focus:border-globus-orange focus:ring-2 focus:ring-globus-orange/20" />
        <button
          type="submit"
          disabled={isSubmitting || !code}
          className={`w-full ${submitColor} text-white font-montserrat font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50`}>
          {isSubmitting ? 'Vérification...' : 'Vérifier et se connecter'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-sm text-globus-gray hover:text-globus-blue-dark">
          ← Recommencer
        </button>
      </form>
    </>
  );
}
