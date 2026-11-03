// ASOSC dashboard service worker: shows "new form" push notifications.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ASOSC", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "New form", {
      body: data.body || "",
      icon: "https://res.cloudinary.com/daldas2e7/image/upload/f_png,w_192/v1782010314/asosc/logo.webp",
      badge: "https://res.cloudinary.com/daldas2e7/image/upload/f_png,w_96/v1782010314/asosc/logo.webp",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/upgrade?tool=dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/upgrade?tool=dashboard", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin + "/upgrade")) return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
