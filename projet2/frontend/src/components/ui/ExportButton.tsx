/**
 * ExportButton — Unified UI for "Export Excel / PDF" triggers across ERP pages.
 *
 * Wraps a download helper so the caller only provides the action + label.
 * Handles the in-flight spinner state and surfaces errors via the provided
 * `onError` callback (typically a toast).
 */
import { useState } from 'react';
import { DownloadIcon, Loader2Icon } from 'lucide-react';

type Variant = 'ghost' | 'primary';

interface Props {
  label?: string;
  title?: string;
  onAction: () => Promise<unknown>;
  onError?: (message: string) => void;
  onSuccess?: () => void;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
}

const baseClass =
  'font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  ghost: 'bg-white hover:bg-gray-50 border border-gray-200 text-globus-blue-dark',
  primary: 'bg-globus-orange hover:bg-globus-orange-hover text-white shadow-sm',
};

export function ExportButton({
  label = 'Export Excel',
  title = 'Exporter au format Excel',
  onAction,
  onError,
  onSuccess,
  variant = 'ghost',
  className = '',
  disabled,
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await onAction();
      onSuccess?.();
    } catch (err: any) {
      onError?.(err?.response?.data?.detail || `Échec de l'export`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      title={title}
      onClick={handleClick}
      disabled={busy || disabled}
      className={`${baseClass} ${variants[variant]} ${className}`}>
      {busy ? (
        <Loader2Icon className="w-4 h-4 animate-spin" />
      ) : (
        <DownloadIcon className="w-4 h-4" />
      )}
      {label}
    </button>
  );
}
