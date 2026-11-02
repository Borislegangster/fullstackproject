import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2Icon, XCircleIcon, LoaderIcon, ShieldCheckIcon, ArrowLeftIcon } from 'lucide-react';
import { usePaymentStatus } from '../../hooks/useClient';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Payment Callback Page — `/paiement/callback`
 *
 * Flutterwave redirects here after checkout with query params:
 *   ?tx_ref=FLW-FAC-2026-001-...&status=successful&transaction_id=12345
 *
 * The page polls GET /payments/{tx_ref}/status until the backend webhook
 * confirms the payment (COMPLETED) or marks it as FAILED.
 */
export function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const txRef = searchParams.get('tx_ref');
  const flwStatus = searchParams.get('status'); // from Flutterwave redirect
  const [displayState, setDisplayState] = useState<'verifying' | 'success' | 'failed' | 'cancelled'>('verifying');

  const { data: paymentStatus } = usePaymentStatus(txRef);

  // React to backend-confirmed status
  useEffect(() => {
    if (!paymentStatus) return;

    if (paymentStatus.status === 'COMPLETED') {
      setDisplayState('success');
      // Invalidate finances caches so the client sees updated data
      queryClient.invalidateQueries({ queryKey: ['client-finances'] });
      queryClient.invalidateQueries({ queryKey: ['client-finances-evolution'] });
      queryClient.invalidateQueries({ queryKey: ['client-finances-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['client-notifications'] });
    } else if (paymentStatus.status === 'FAILED') {
      setDisplayState('failed');
    } else if (paymentStatus.status === 'CANCELLED') {
      setDisplayState('cancelled');
    }
    // While PENDING, keep the 'verifying' state — the hook auto-polls every 3s
  }, [paymentStatus, queryClient]);

  // If Flutterwave redirect says cancelled and we have no backend data yet
  useEffect(() => {
    if (flwStatus === 'cancelled' && !paymentStatus) {
      setDisplayState('cancelled');
    }
  }, [flwStatus, paymentStatus]);

  // Auto-redirect after success
  useEffect(() => {
    if (displayState === 'success') {
      const timer = setTimeout(() => navigate('/finances'), 5000);
      return () => clearTimeout(timer);
    }
  }, [displayState, navigate]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 })
      .format(value)
      .replace('XAF', 'FCFA');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        {/* Verifying */}
        {displayState === 'verifying' && (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="relative mb-8">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
                <LoaderIcon className="w-10 h-10 text-globus-blue animate-spin" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-globus-orange rounded-full flex items-center justify-center shadow-lg">
                <ShieldCheckIcon className="w-4 h-4 text-white" />
              </div>
            </div>
            <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-3">
              Vérification en cours...
            </h2>
            <p className="font-opensans text-globus-gray leading-relaxed">
              Nous vérifions votre paiement auprès de Flutterwave.
              <br />
              Veuillez ne pas fermer cette page.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
              <div className="w-2 h-2 rounded-full bg-globus-blue animate-pulse" />
              Référence : {txRef || '—'}
            </div>
          </div>
        )}

        {/* Success */}
        {displayState === 'success' && (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10 }}
              className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"
            >
              <CheckCircle2Icon className="w-12 h-12 text-green-500" />
            </motion.div>
            <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-2">
              Paiement confirmé !
            </h2>
            <p className="font-opensans text-globus-gray mb-4">
              Votre règlement de{' '}
              <span className="font-bold text-globus-blue-dark">
                {paymentStatus ? formatCurrency(paymentStatus.amount) : '—'}
              </span>{' '}
              a été validé avec succès.
            </p>
            {paymentStatus?.flw_ref && (
              <p className="font-mono text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full mb-6">
                Réf. Flutterwave : {paymentStatus.flw_ref}
              </p>
            )}
            <p className="text-sm text-globus-gray font-opensans mb-6">
              Vous serez redirigé automatiquement...
            </p>
            <button
              onClick={() => navigate('/finances')}
              className="flex items-center gap-2 bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold px-6 py-3 rounded-xl transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Retour aux finances
            </button>
          </div>
        )}

        {/* Failed */}
        {displayState === 'failed' && (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <XCircleIcon className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-2">
              Paiement échoué
            </h2>
            <p className="font-opensans text-globus-gray mb-6">
              Le paiement n'a pas pu être confirmé. Aucun montant n'a été débité.
              Veuillez réessayer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/finances')}
                className="flex items-center gap-2 border border-gray-200 text-globus-blue-dark font-montserrat font-bold px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Retour
              </button>
            </div>
          </div>
        )}

        {/* Cancelled */}
        {displayState === 'cancelled' && (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mb-6">
              <XCircleIcon className="w-12 h-12 text-amber-500" />
            </div>
            <h2 className="font-montserrat font-bold text-2xl text-globus-blue-dark mb-2">
              Paiement annulé
            </h2>
            <p className="font-opensans text-globus-gray mb-6">
              Vous avez annulé le paiement. Aucun montant n'a été débité.
            </p>
            <button
              onClick={() => navigate('/finances')}
              className="flex items-center gap-2 bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold px-6 py-3 rounded-xl transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Retour aux finances
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
