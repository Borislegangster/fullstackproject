/**
 * ForgeViewer — Thin React wrapper around the Autodesk APS Viewer v7.
 *
 * Loads the Autodesk script & stylesheet on first mount, asks the backend for
 * a viewer-scope access token (`GET /collaboration/aps-token`), then loads the
 * provided URN. Exposes `onViewerReady` so the parent (e.g. CollaborationCanvas)
 * can subscribe to camera changes and overlay annotations.
 *
 * Gracefully degrades when APS credentials are not configured: shows a friendly
 * placeholder so dev work isn't blocked by Autodesk setup.
 */
import { useEffect, useRef, useState } from 'react';
import { collaborationApi } from '../../services/api/collaboration.api';

const VIEWER_SCRIPT_SRC =
  'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
const VIEWER_STYLE_SRC =
  'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';

declare global {
  interface Window {
    Autodesk?: any;
  }
}

let scriptLoadingPromise: Promise<void> | null = null;

function loadViewerScript(): Promise<void> {
  if (window.Autodesk?.Viewing) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    // Stylesheet
    if (!document.querySelector(`link[href="${VIEWER_STYLE_SRC}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = VIEWER_STYLE_SRC;
      document.head.appendChild(link);
    }
    // Script
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${VIEWER_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Autodesk viewer script failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = VIEWER_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadingPromise = null;
      reject(new Error('Autodesk viewer script failed to load'));
    };
    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}

export interface ForgeViewerProps {
  urn: string;
  onViewerReady?: (viewer: any) => void;
  className?: string;
}

type Stage = 'idle' | 'loading-script' | 'loading-token' | 'loading-document' | 'ready' | 'error' | 'no-credentials';

export function ForgeViewer({ urn, onViewerReady, className = '' }: ForgeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setStage('loading-script');
      try {
        await loadViewerScript();
      } catch (e) {
        if (!cancelled) {
          setError("Impossible de charger le viewer Autodesk. Vérifiez votre connexion.");
          setStage('error');
        }
        return;
      }

      setStage('loading-token');
      let tokenResp;
      try {
        tokenResp = await collaborationApi.getApsToken();
      } catch (e: any) {
        if (cancelled) return;
        if (e?.response?.status === 503) {
          setStage('no-credentials');
        } else {
          setError(e?.response?.data?.detail || "Impossible d'obtenir le token APS");
          setStage('error');
        }
        return;
      }

      if (cancelled || !containerRef.current) return;
      const Autodesk = window.Autodesk!;
      const config = {
        env: 'AutodeskProduction',
        api: 'streamingV2',
        getAccessToken: (onTokenReady: (token: string, expires: number) => void) => {
          onTokenReady(tokenResp.access_token, tokenResp.expires_in);
        },
      };

      Autodesk.Viewing.Initializer(config, () => {
        if (cancelled || !containerRef.current) return;
        const viewer = new Autodesk.Viewing.GuiViewer3D(containerRef.current);
        viewer.start();
        viewerRef.current = viewer;

        const fullUrn = urn.startsWith('urn:') ? urn : `urn:${urn}`;
        setStage('loading-document');
        Autodesk.Viewing.Document.load(
          fullUrn,
          (doc: any) => {
            if (cancelled) return;
            const viewable = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewable).then(() => {
              if (cancelled) return;
              setStage('ready');
              onViewerReady?.(viewer);
            });
          },
          (errCode: any, errMsg: any) => {
            if (cancelled) return;
            setError(`Échec chargement document: ${errMsg || errCode}`);
            setStage('error');
          }
        );
      });
    }

    start();
    return () => {
      cancelled = true;
      try { viewerRef.current?.tearDown?.(); } catch { /* noop */ }
      try { viewerRef.current?.finish?.(); } catch { /* noop */ }
      viewerRef.current = null;
    };
  }, [urn, onViewerReady]);

  if (stage === 'no-credentials') {
    return (
      <PlaceholderCard
        className={className}
        title="Viewer Autodesk non configuré"
        body="Pour visualiser ce plan 3D, ajoutez APS_CLIENT_ID et APS_CLIENT_SECRET dans backend/.env puis redémarrez le serveur. Les autres fonctionnalités de la session (curseurs, annotations, chat) restent utilisables avec un fond blanc." />
    );
  }

  if (stage === 'error') {
    return <PlaceholderCard className={className} title="Erreur viewer" body={error} variant="error" />;
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full bg-gray-900" />
      {stage !== 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-white text-sm gap-3 z-10">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <p>
            {stage === 'loading-script' && 'Chargement du viewer 3D...'}
            {stage === 'loading-token' && 'Authentification...'}
            {stage === 'loading-document' && 'Chargement du modèle BIM...'}
          </p>
        </div>
      )}
    </div>
  );
}

function PlaceholderCard({
  className = '', title, body, variant = 'info',
}: {
  className?: string; title: string; body: string; variant?: 'info' | 'error';
}) {
  return (
    <div className={`bg-gray-900 text-white flex items-center justify-center p-10 ${className}`}>
      <div className="max-w-md text-center">
        <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">{variant === 'error' ? '⚠️' : '🔬'}</span>
        </div>
        <h2 className="text-white font-bold text-xl mb-3">{title}</h2>
        <p className="text-gray-400 text-sm">{body}</p>
      </div>
    </div>
  );
}
