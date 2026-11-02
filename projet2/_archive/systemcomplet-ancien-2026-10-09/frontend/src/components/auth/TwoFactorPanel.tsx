/**
 * TwoFactorPanel — Reusable 2FA enroll/disable widget.
 *
 * Drop it into any account-settings page. Handles:
 *   - Fetching current 2FA status
 *   - Starting enrollment (renders QR code + manual secret)
 *   - Verifying with a 6-digit code
 *   - Displaying backup codes once
 *   - Disabling 2FA after password confirmation
 */
import { useEffect, useState } from 'react';
import { ShieldCheckIcon, AlertTriangleIcon, CheckCircle2Icon, KeyIcon, CopyIcon } from 'lucide-react';
import {
  get2FAStatusApi, enroll2FAApi, verify2FAApi, disable2FAApi,
  type TwoFactorEnrollResponse,
} from '../../services/api/auth.api';

type Stage = 'loading' | 'idle-disabled' | 'idle-enabled' | 'enrolling' | 'success';

export function TwoFactorPanel() {
  const [stage, setStage] = useState<Stage>('loading');
  const [enrollData, setEnrollData] = useState<TwoFactorEnrollResponse | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get2FAStatusApi()
      .then(({ enabled }) => setStage(enabled ? 'idle-enabled' : 'idle-disabled'))
      .catch(() => setStage('idle-disabled'));
  }, []);

  const handleStartEnroll = async () => {
    setError(''); setBusy(true);
    try {
      const data = await enroll2FAApi();
      setEnrollData(data);
      setStage('enrolling');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erreur lors du démarrage');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Saisissez les 6 chiffres affichés par votre application');
      return;
    }
    setError(''); setBusy(true);
    try {
      const resp = await verify2FAApi(code);
      setBackupCodes(resp.backup_codes);
      setStage('success');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Code invalide');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!password) {
      setError('Saisissez votre mot de passe');
      return;
    }
    setError(''); setBusy(true);
    try {
      await disable2FAApi(password);
      setStage('idle-disabled');
      setPassword('');
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Mot de passe incorrect');
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'loading') {
    return <div className="text-sm text-gray-500">Chargement...</div>;
  }

  if (stage === 'idle-disabled') {
    return (
      <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
        <div className="flex items-start gap-4">
          <ShieldCheckIcon className="w-6 h-6 text-globus-blue-dark shrink-0" />
          <div className="flex-1">
            <h3 className="font-montserrat font-bold text-sm text-globus-blue-dark mb-1">
              Authentification à deux facteurs (2FA)
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Ajoutez une couche de sécurité supplémentaire en utilisant une
              application d'authentification (Google Authenticator, Microsoft
              Authenticator, Authy…).
            </p>
            <button
              onClick={handleStartEnroll}
              disabled={busy}
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-bold text-sm py-2 px-4 rounded-lg disabled:opacity-50">
              Activer la 2FA
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </div>
    );
  }

  if (stage === 'enrolling' && enrollData) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(enrollData.otp_uri)}&size=200x200`;
    return (
      <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-4">
        <h3 className="font-montserrat font-bold text-sm text-globus-blue-dark">
          Scanner le QR code
        </h3>
        <div className="flex items-start gap-4 flex-col sm:flex-row">
          <img src={qrSrc} alt="QR 2FA" className="w-48 h-48 border rounded" />
          <div className="flex-1 space-y-3">
            <p className="text-xs text-gray-600">
              Scannez ce QR code avec votre application d'authentification, puis
              saisissez le code à 6 chiffres qu'elle affiche.
            </p>
            <div className="bg-gray-50 p-2 rounded border text-xs font-mono break-all">
              {enrollData.secret}
            </div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="w-32 text-center text-lg font-mono tracking-widest border-2 border-gray-200 rounded-lg py-2 focus:outline-none focus:border-globus-orange" />
            <div className="flex gap-2">
              <button
                onClick={handleVerify}
                disabled={busy || code.length !== 6}
                className="bg-globus-orange hover:bg-globus-orange-hover disabled:opacity-50 text-white font-bold text-sm py-2 px-4 rounded-lg">
                Vérifier
              </button>
              <button
                onClick={() => { setStage('idle-disabled'); setEnrollData(null); setCode(''); }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm py-2 px-4 rounded-lg">
                Annuler
              </button>
            </div>
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (stage === 'success') {
    return (
      <div className="bg-green-50 rounded-xl p-5 border border-green-200 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2Icon className="w-6 h-6 text-green-600" />
          <h3 className="font-montserrat font-bold text-sm text-green-800">
            2FA activée. Conservez vos codes de secours.
          </h3>
        </div>
        <p className="text-xs text-gray-700">
          Ces codes vous permettent de vous connecter si vous perdez l'accès à
          votre application d'authentification. <strong>Imprimez-les ou conservez-les
          dans un gestionnaire de mots de passe sûr.</strong> Ils ne seront plus
          affichés.
        </p>
        <div className="bg-white border border-green-200 rounded-lg p-3 grid grid-cols-2 gap-2">
          {backupCodes.map((code) => (
            <div key={code} className="font-mono text-sm py-1 px-2 bg-gray-50 rounded text-center">
              {code}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(backupCodes.join('\n'));
            }}
            className="bg-globus-blue-dark hover:bg-globus-blue text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center gap-2">
            <CopyIcon className="w-4 h-4" /> Copier
          </button>
          <button
            onClick={() => setStage('idle-enabled')}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded-lg">
            J'ai sauvegardé mes codes
          </button>
        </div>
      </div>
    );
  }

  // idle-enabled
  return (
    <div className="bg-green-50 rounded-xl p-5 border border-green-200 space-y-3">
      <div className="flex items-center gap-3">
        <ShieldCheckIcon className="w-6 h-6 text-green-600" />
        <h3 className="font-montserrat font-bold text-sm text-green-800">
          2FA activée
        </h3>
      </div>
      <p className="text-xs text-gray-600">
        Votre compte est protégé par l'authentification à deux facteurs. Pour la
        désactiver, saisissez votre mot de passe ci-dessous.
      </p>
      <div className="flex gap-2 items-center">
        <KeyIcon className="w-4 h-4 text-gray-400" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe actuel"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-orange" />
        <button
          onClick={handleDisable}
          disabled={busy || !password}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold py-1.5 px-4 rounded-lg">
          Désactiver
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangleIcon className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
