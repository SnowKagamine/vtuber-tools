// Antrovia PWA Service Worker
// Strategy:
//   - Same origin: Network First (always fresh, cache as offline fallback)
//   - GAS API: bypass (no cache)
//   - YouTube and 3rd party: bypass
// No version bump needed: users always get the latest when online.

const CACHE_NAME = 'antrovia-runtime';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      // Clean up legacy versioned caches if any
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Bypass GAS / YouTube / third-party hosts
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('youtube.com') ||
      url.hostname.includes('ytimg.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('googleusercontent.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // Same origin: Network First with cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then((networkRes) => {
        // Cache successful response for offline fallback
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, clone).catch(() => {});
          });
        }
        return networkRes;
      }).catch(() => {
        // Offline: fall back to cache
        return caches.match(req).then(cached => cached || new Response('Offline', { status: 503 }));
      })
    );
  }
});
