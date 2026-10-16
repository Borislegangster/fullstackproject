/* Service worker GLOBUS : notifications push (Web Push VAPID). Aucune mise en cache de données métier. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "GLOBUS ENGINEERING", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "GLOBUS ENGINEERING";
  const options = {
    body: payload.body || "",
    // Icône unique de la plateforme (réglage CMS « Icône de la plateforme »).
    icon: payload.icon || "/api/v1/public/brand/icon-192.png",
    badge: "/api/v1/public/brand/icon-96.png",
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    requireInteraction: !!payload.requireInteraction,
    data: { url: payload.url || "/", ...(payload.data || {}) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/";
  let target = "/";
  try {
    const url = new URL(raw, self.location.origin);
    target = url.origin === self.location.origin ? url.pathname + url.search + url.hash : "/";
  } catch (e) {
    target = "/";
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
