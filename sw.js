/* OpsDesk — service worker.
   Network-first with a cache fallback: always fresh when online, and the
   whole app still opens with no connection (data is in localStorage anyway).
   Bump VERSION on every release so old caches get swept. */
var VERSION = "opsdesk-v3.1.0";

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(VERSION).then(function (cache) {
      return fetch(e.request)
        .then(function (res) {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(function () {
          return cache.match(e.request).then(function (hit) {
            if (hit) return hit;
            if (e.request.mode === "navigate") return cache.match("./index.html");
            return Response.error();
          });
        });
    })
  );
});
