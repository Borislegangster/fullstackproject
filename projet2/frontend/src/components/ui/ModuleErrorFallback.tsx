/**
 * ModuleErrorFallback — Compact error UI for module-level ErrorBoundary use.
 *
 * @example
 * <ErrorBoundary fallback={<ModuleErrorFallback module="Chantiers" />}>
 *   <ErpChantiers />
 * </ErrorBoundary>
 */
import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';

interface Props {
  module?: string;
}

export function ModuleErrorFallback({ module }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-md mx-auto">
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
        <AlertTriangleIcon className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-2">
        {module ? `Erreur module ${module}` : 'Erreur de chargement'}
      </h3>
      <p className="font-opensans text-sm text-globus-gray mb-5">
        Ce module a rencontré un problème. Le reste de l'application reste accessible.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 bg-globus-blue-dark hover:bg-globus-blue text-white font-bold text-sm py-2 px-4 rounded-lg transition-colors">
        <RefreshCwIcon className="w-4 h-4" />
        Recharger
      </button>
    </div>
  );
}
