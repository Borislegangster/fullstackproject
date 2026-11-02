/**
 * SigningOtpDialog — Two-step electronic signature flow for the client portal.
 *
 *   Step 1: Ask the server to email a 6-digit code (request-otp).
 *   Step 2: User keys the code in, server verifies it, returns the document
 *           hash + signed_at — we show the receipt so the user knows the
 *           signature is anchored.
 *
 * The component is purely presentational once mounted — the parent decides
 * when to show it (e.g. "Signer" button). It calls `onSigned()` on success
 * so the parent can refresh the document list.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  XIcon, Loader2Icon, ShieldCheckIcon, MailIcon, CheckCircle2Icon, AlertTriangleIcon,
} from 'lucide-react';
import { requestSigningOtp, verifySigningOtp } from '../../services/api/downloads';
import { formatDateTime } from '../../utils/datetime';

type Step = 'request' | 'verify' | 'done';

interface SignedReceipt {
  document_hash: string;
  signed_at: string;
}

interface Props {
  documentId: string;
  documentName: string;
  onClose: () => void;
  onSigned?: (receipt: SignedReceipt) => void;
}

export function SigningOtpDialog({ documentId, documentName, onClose, onSigned }: Props) {
  const [step, setStep] = useState<Step>('request');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ttlMinutes, setTtlMinutes] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<SignedReceipt | null>(null);

  // Kick off the first OTP request automatically when the dialog opens.
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    requestSigningOtp(documentId)
      .then((res) => {
        if (cancelled) return;
        setTtlMinutes(res.ttl_minutes);
        setStep('verify');
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.detail || 'Impossible d’envoyer le code');
      })
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Le code doit contenir 6 chiffres');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await verifySigningOtp(documentId, code);
      const r = { document_hash: res.document_hash, signed_at: res.signed_at };
      setReceipt(r);
      setStep('done');
      onSigned?.(r);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Code incorrect ou expiré');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setError(null);
    setCode('');
    try {
      const res = await requestSigningOtp(documentId);
      setTtlMinutes(res.ttl_minutes);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Échec du renvoi du code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-globus-blue" />
            <h3 className="font-montserrat font-bold text-base text-globus-blue-dark">
              Signature électronique
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Fermer">
            <XIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="font-opensans text-sm text-globus-gray">
            Vous êtes sur le point de signer : <strong>{documentName}</strong>
          </p>

          {step === 'request' && busy && (
            <div className="flex items-center justify-center gap-3 py-6">
              <Loader2Icon className="w-5 h-5 animate-spin text-globus-blue" />
              <span className="text-sm text-globus-gray">Envoi du code par email…</span>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                <MailIcon className="w-5 h-5 text-globus-blue shrink-0 mt-0.5" />
                <div className="text-sm text-globus-blue-dark">
                  Nous avons envoyé un code à 6 chiffres à votre adresse email.
                  {ttlMinutes && (
                    <span className="block text-xs text-globus-gray mt-1">
                      Le code expire dans {ttlMinutes} minutes.
                    </span>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="font-opensans text-xs font-bold text-globus-blue-dark uppercase tracking-wide">
                  Code de signature
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1 w-full text-center text-2xl tracking-[10px] font-mono font-bold border border-gray-200 rounded-lg py-3 focus:outline-none focus:border-globus-blue focus:ring-2 focus:ring-globus-blue/20"
                  placeholder="••••••"
                />
              </label>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
                  <AlertTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={busy}
                  className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-globus-blue-dark font-bold text-sm py-2.5 rounded-lg disabled:opacity-60">
                  Renvoyer
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={busy || code.length !== 6}
                  className="flex-1 bg-globus-orange hover:bg-globus-orange-hover text-white font-bold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <ShieldCheckIcon className="w-4 h-4" />}
                  Signer
                </button>
              </div>
            </div>
          )}

          {step === 'done' && receipt && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                <CheckCircle2Icon className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className="font-bold text-sm text-green-900">Document signé ✓</p>
                  <p className="text-xs text-green-800">Votre signature est anchorée par un hash cryptographique.</p>
                </div>
              </div>
              <div className="text-xs space-y-1 bg-gray-50 border border-gray-100 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-globus-gray">Signé le</span>
                  <span className="font-mono">{formatDateTime(receipt.signed_at)}</span>
                </div>
                <div>
                  <span className="text-globus-gray">Empreinte du document</span>
                  <p className="font-mono break-all text-globus-blue-dark mt-0.5">{receipt.document_hash}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full bg-globus-blue-dark hover:bg-globus-blue text-white font-bold text-sm py-2.5 rounded-lg">
                Fermer
              </button>
            </div>
          )}

          {step === 'request' && error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
              <AlertTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
