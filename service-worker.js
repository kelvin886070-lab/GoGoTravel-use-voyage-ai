
const CACHE_NAME = 'voyage-ai-v3';

// Install Event: Cache critical assets immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  // CRITICAL FIX: Only cache requests from the same origin (localhost)
  // This prevents CORS errors when fetching from external APIs (Gemini, Maps) or CDNs
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response immediately if available
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache new response for next time
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // If network fails (offline), return nothing (or fallback)
        // Since we return cachedResponse || fetchPromise below, this catch keeps the promise chain alive
      });

      // Return cached response if found, else wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
