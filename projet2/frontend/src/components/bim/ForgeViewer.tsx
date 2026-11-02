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

type Stage = 'idle' | 'loading-script' | 'loading-token' | 'translating' | 'loading-document' | 'ready' | 'error' | 'no-credentials';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function ForgeViewer({ urn, onViewerReady, className = '' }: ForgeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [translationProgress, setTranslationProgress] = useState('');
  // Le parent re-rend à haute fréquence (curseurs temps réel) et recrée son
  // callback inline à chaque render : on le garde dans un ref pour que
  // l'initialisation ne dépende QUE de l'URN — sinon le viewer se
  // détruit/réinitialise en boucle et spamme /aps-token (quota Autodesk).
  const onViewerReadyRef = useRef(onViewerReady);
  onViewerReadyRef.current = onViewerReady;
  const resizeObsRef = useRef<ResizeObserver | null>(null);

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

      // ── Attendre la fin de la traduction Autodesk (DWG/RVT → SVF2) ──
      // Sans cette étape, Document.load échoue ou reste bloqué tant que le
      // job Model Derivative n'est pas terminé (~1-3 min pour un DWG).
      const bareUrn = urn.replace(/^urn:/, '');
      try {
        let st = await collaborationApi.getTranslationStatus(bareUrn);
        while (!cancelled && (st.status === 'inprogress' || st.status === 'pending')) {
          setStage('translating');
          setTranslationProgress(st.progress || '');
          await sleep(5000);
          st = await collaborationApi.getTranslationStatus(bareUrn);
        }
        if (cancelled) return;
        if (st.status === 'failed') {
          setError('La traduction Autodesk de cette maquette a échoué. Ré-uploadez le fichier.');
          setStage('error');
          return;
        }
        // 'success' → charger ; 'not_started'/inconnu → tenter le chargement
        // direct quand même (maquette traduite hors plateforme, URN externe…).
      } catch {
        // Statut indisponible (réseau, URN exotique) — non bloquant.
      }

      // Attendre que le conteneur ait une taille réelle : démarrer le viewer
      // sur un conteneur 0×0 (layout flex en cours de calcul, onglet en
      // arrière-plan) spamme "Framebuffer incomplete: attachment has zero
      // size" et produit un cadrage caméra dégénéré.
      for (let i = 0; i < 100 && !cancelled; i++) {
        const el = containerRef.current;
        if (el && el.clientWidth > 0 && el.clientHeight > 0) break;
        await sleep(100);
      }

      if (cancelled || !containerRef.current) return;
      const Autodesk = window.Autodesk!;
      const config = {
        // Paire documentée pour les traductions SVF2 : AutodeskProduction2 +
        // streamingV2. Mélanger AutodeskProduction (endpoints SVF classiques)
        // avec streamingV2 fait échouer le fetch des dérivés 2D (.f2d → 404).
        env: 'AutodeskProduction2',
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

        // Le conteneur (layout flex) peut mesurer 0×0 au premier rendu →
        // "Framebuffer incomplete: attachment has zero size". Resynchroniser
        // le canvas dès que le conteneur obtient sa taille réelle.
        if (typeof ResizeObserver !== 'undefined') {
          resizeObsRef.current?.disconnect();
          const ro = new ResizeObserver(() => {
            try { viewerRef.current?.resize?.(); } catch { /* noop */ }
          });
          ro.observe(containerRef.current);
          resizeObsRef.current = ro;
        }

        const fullUrn = urn.startsWith('urn:') ? urn : `urn:${urn}`;
        setStage('loading-document');
        Autodesk.Viewing.Document.load(
          fullUrn,
          (doc: any) => {
            if (cancelled) return;
            const viewable = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewable).then(() => {
              if (cancelled) return;
              // Le viewer a pu démarrer avec un conteneur à 0×0 (layout flex)
              // → le cadrage initial est dégénéré et le plan est hors champ.
              try { viewer.resize(); viewer.fitToView(); } catch { /* noop */ }
              setStage('ready');
              onViewerReadyRef.current?.(viewer);
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
      resizeObsRef.current?.disconnect();
      resizeObsRef.current = null;
      try { viewerRef.current?.tearDown?.(); } catch { /* noop */ }
      try { viewerRef.current?.finish?.(); } catch { /* noop */ }
      viewerRef.current = null;
    };
  }, [urn]);

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
    <div className={className || "relative w-full h-full"}>
      <div ref={containerRef} className="w-full h-full bg-gray-900 overflow-hidden" />
      {stage !== 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-white text-sm gap-3 z-10">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <p>
            {stage === 'loading-script' && 'Chargement du viewer 3D...'}
            {stage === 'loading-token' && 'Authentification...'}
            {stage === 'translating' && `Traduction Autodesk en cours${translationProgress ? ` (${translationProgress})` : ''}... Cela prend 1 à 3 min.`}
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
