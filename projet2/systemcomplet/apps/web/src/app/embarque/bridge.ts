/**
 * Pont page embarquée ↔ application mobile (canal JavaScript « GlobusApp » de la vue web Flutter).
 * Hors application (navigateur), les messages sont simplement ignorés.
 */
type Incoming = { type: string; [key: string]: unknown };

declare global {
  interface Window {
    GlobusApp?: { postMessage: (message: string) => void };
    globusBridge?: { receive: (message: Incoming) => void };
  }
}

export function toApp(type: string, data: Record<string, unknown> = {}): void {
  try {
    window.GlobusApp?.postMessage(JSON.stringify({ type, ...data }));
  } catch {
    /* hors application */
  }
}

/** Abonne la page aux commandes envoyées par l'application ; renvoie la fonction de désabonnement. */
export function fromApp(handler: (message: Incoming) => void): () => void {
  window.globusBridge = { receive: handler };
  return () => {
    if (window.globusBridge?.receive === handler) delete window.globusBridge;
  };
}
