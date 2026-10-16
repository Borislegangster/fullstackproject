/** WebAuthn (clés de sécurité / biométrie) : conversion des options JSON (base64url) ↔ API navigateur. */

function b64urlToBuffer(value: string): ArrayBuffer {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

function bufferToB64url(buffer: ArrayBuffer | null | undefined): string | null {
  if (!buffer) return null;
  const bytes = new Uint8Array(buffer);
  let raw = "";
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function webauthnSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}

/** Authentification (connexion MFA) : renvoie la réponse sérialisée attendue par l'API. */
export async function webauthnAuthenticate(options: any): Promise<Record<string, unknown>> {
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: b64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials ?? []).map((c: any) => ({ ...c, id: b64urlToBuffer(c.id) })),
  };
  const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Authentification annulée");
  const response = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    rawId: bufferToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToB64url(response.clientDataJSON),
      authenticatorData: bufferToB64url(response.authenticatorData),
      signature: bufferToB64url(response.signature),
      userHandle: bufferToB64url(response.userHandle),
    },
    clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
  };
}

/** Enregistrement d'une nouvelle clé de sécurité. */
export async function webauthnRegister(options: any): Promise<Record<string, unknown>> {
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: b64urlToBuffer(options.challenge),
    user: { ...options.user, id: b64urlToBuffer(options.user.id) },
    excludeCredentials: (options.excludeCredentials ?? []).map((c: any) => ({ ...c, id: b64urlToBuffer(c.id) })),
  };
  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Enregistrement annulé");
  const response = cred.response as AuthenticatorAttestationResponse;
  return {
    id: cred.id,
    rawId: bufferToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToB64url(response.clientDataJSON),
      attestationObject: bufferToB64url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
    clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
  };
}
