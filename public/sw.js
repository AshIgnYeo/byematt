/**
 * ByeMatt's service worker. It exists for exactly two reasons: receiving push
 * payloads while the app is closed, and making the app installable so iOS will
 * deliver them at all.
 *
 * There is deliberately no fetch handler and no cache. Every screen in this app
 * is a live poll of a game happening in the same room — a stale cached feed is
 * worse than no feed, and Chrome dropped the fetch-handler requirement for
 * installability in 129.
 */

// A new deploy mid-party should take over immediately rather than waiting for
// every tab to close.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let alert = {};
  try {
    alert = event.data ? event.data.json() : {};
  } catch {
    // Unencrypted or malformed payload — still worth a generic buzz.
  }

  const tag = alert.tag || "byematt";

  event.waitUntil(
    self.registration.showNotification(alert.title || "ByeMatt", {
      body: alert.body || "",
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      image: alert.image,
      tag,
      // Same tag replaces the old notification, but should still buzz: two
      // captures in a row are two events, not one update.
      renotify: true,
      vibrate: [40, 60, 40],
      data: { url: alert.url || "/feed" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/feed";

  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Reuse the tab that's already open — on a phone that's the installed
      // app, and opening a second window would lose their place.
      for (const client of open) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }

      await self.clients.openWindow(url);
    })(),
  );
});
