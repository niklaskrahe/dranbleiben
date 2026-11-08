// Service Worker: hält die App komplett offline bereit.
// Bei jeder Änderung an den Dateien VERSION hochzählen.
const PREFIX = "dranbleiben-";
const VERSION = PREFIX + "v1";
const ASSETS = [
  "./", "./index.html", "./core.js", "./app.js", "./config.js", "./supabase.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png",
  "./fonts/barlow-condensed-latin-600-normal.woff2", "./fonts/barlow-condensed-latin-800-normal.woff2",
  "./fonts/ibm-plex-sans-latin-400-normal.woff2", "./fonts/ibm-plex-sans-latin-500-normal.woff2",
  "./fonts/ibm-plex-sans-latin-600-normal.woff2", "./fonts/ibm-plex-mono-latin-500-normal.woff2"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

// Nur eigene alte Caches löschen (andere Apps auf derselben Domain, z. B. Sportduell, bleiben unberührt)
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase direkt übers Netz

  // Seite selbst: zuerst Netz (damit Updates sofort ankommen), offline aus dem Cache
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); }
        return res;
      }).catch(() => caches.match("./index.html", { ignoreSearch: true }))
    );
    return;
  }
  // Übrige Dateien: sofort aus dem Cache, im Hintergrund aktualisieren
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
