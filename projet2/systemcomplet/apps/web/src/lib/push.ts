/** Abonnement aux notifications push du navigateur (Web Push VAPID). */

import { api } from "./api";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(): Promise<"enabled" | "denied" | "unavailable"> {
  if (!pushSupported()) return "unavailable";
  const { public_key } = await api<{ public_key: string | null }>("/push/vapid-public-key");
  if (!public_key) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource }));
  const json = subscription.toJSON();
  await api("/push/subscriptions", {
    method: "POST",
    body: {
      kind: "webpush",
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? null,
      auth: json.keys?.auth ?? null,
      application: "web",
      device_name: navigator.userAgent.slice(0, 150),
    },
  });
  return "enabled";
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  try {
    await api("/push/unsubscribe", { method: "POST", body: { endpoint: subscription.endpoint } });
  } finally {
    await subscription.unsubscribe();
  }
}
