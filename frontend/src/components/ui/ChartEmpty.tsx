/**
 * ChartEmpty — Compact placeholder shown inside a chart container when the
 * underlying query resolves with no data (or while loading / on error).
 *
 * Sized to fill its parent (h-full) so it visually replaces the chart.
 */
import { BarChart3Icon, Loader2Icon, AlertTriangleIcon } from 'lucide-react';

interface Props {
  /** 'loading' | 'error' | 'empty' (default) */
  state?: 'loading' | 'error' | 'empty';
  message?: string;
}

export function ChartEmpty({ state = 'empty', message }: Props) {
  const defaults: Record<string, string> = {
    loading: 'Chargement des données…',
    error: 'Impossible de charger les données',
    empty: 'Aucune donnée sur la période',
  };
  const text = message || defaults[state];

  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center gap-2 text-globus-gray">
      {state === 'loading' ? (
        <Loader2Icon className="w-7 h-7 animate-spin text-globus-blue/50" />
      ) : state === 'error' ? (
        <AlertTriangleIcon className="w-7 h-7 text-red-400" />
      ) : (
        <BarChart3Icon className="w-7 h-7 text-gray-300" />
      )}
      <p className="font-opensans text-xs max-w-[200px]">{text}</p>
    </div>
  );
}
