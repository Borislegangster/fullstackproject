/**
 * TempWorkerQrModal — Renders a QR badge for a temp worker and lets the
 * operator download or print it.
 *
 * Backed by `GET /hr/temp-workers/{id}/qr.png`, which streams a polished
 * badge PNG including the worker name + speciality. We display it inline
 * using a blob URL so we don't bypass the auth header.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { XIcon, DownloadIcon, Loader2Icon, PrinterIcon } from 'lucide-react';
import { fetchTempWorkerQrBlob, downloadTempWorkerQr } from '../../services/api/downloads';

interface Props {
  workerId: string;
  workerName: string;
  onClose: () => void;
}

export function TempWorkerQrModal({ workerId, workerName, onClose }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    fetchTempWorkerQrBlob(workerId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = window.URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.detail || 'Échec du chargement du QR');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [workerId]);

  const handlePrint = () => {
    if (!src) return;
    const win = window.open('', '_blank', 'width=420,height=620');
    if (!win) return;
    win.document.write(`
      <!doctype html><html><head><title>Badge QR — ${workerName}</title>
      <style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff}
      img{max-width:90%;max-height:90vh;border:1px solid #d1d5db;padding:8px;background:white}</style>
      </head><body><img src="${src}" alt="QR" onload="window.print()" /></body></html>
    `);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-montserrat font-bold text-base text-globus-blue-dark">Badge QR</h3>
            <p className="font-opensans text-xs text-globus-gray">{workerName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Fermer">
            <XIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center gap-3 min-h-[260px] justify-center">
          {loading && <Loader2Icon className="w-8 h-8 text-globus-blue animate-spin" />}
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          {src && (
            <img
              src={src}
              alt={`QR de ${workerName}`}
              className="max-w-full rounded-md border border-gray-200"
            />
          )}
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex gap-2 justify-end">
          <button
            onClick={handlePrint}
            disabled={!src}
            className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-globus-blue-dark font-bold text-xs py-2 px-3 rounded-lg disabled:opacity-50">
            <PrinterIcon className="w-3.5 h-3.5" />
            Imprimer
          </button>
          <button
            onClick={() => downloadTempWorkerQr(workerId, workerName)}
            disabled={!src}
            className="flex items-center gap-1.5 bg-globus-blue-dark hover:bg-globus-blue text-white font-bold text-xs py-2 px-3 rounded-lg disabled:opacity-50">
            <DownloadIcon className="w-3.5 h-3.5" />
            Télécharger PNG
          </button>
        </div>
      </motion.div>
    </div>
  );
}
