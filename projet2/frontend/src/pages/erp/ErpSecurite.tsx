import { motion } from 'framer-motion';
import { ShieldCheckIcon } from 'lucide-react';
import { TwoFactorPanel } from '../../components/auth/TwoFactorPanel';
import { SessionsPanel } from '../../components/auth/SessionsPanel';

/**
 * Self-service security page available to ALL staff (not just admins).
 * Lets every user enroll/disable 2FA and manage their active sessions —
 * required so the enforce_2fa policy is actionable by non-admin staff.
 */
export function ErpSecurite() {
  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark flex items-center gap-2">
          <ShieldCheckIcon className="w-7 h-7 text-globus-orange" />
          Sécurité du compte
        </h2>
        <p className="font-opensans text-sm text-globus-gray mt-1">
          Gérez la double authentification (2FA) et vos sessions actives.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TwoFactorPanel />
        <SessionsPanel />
      </motion.div>
    </div>
  );
}
