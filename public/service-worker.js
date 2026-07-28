
// voyage-ai Service Worker
// 策略分流（解決「正式站永遠慢一版」）：
//   - 導覽/HTML（app shell 入口）：network-first —— 線上一律拿最新，離線才退回快取。
//   - 其他同源 GET（Vite 產出的 hashed 靜態資產，內容不可變）：stale-while-revalidate，最省流量。
const CACHE_NAME = 'voyage-ai-v5';
const APP_SHELL = '/index.html';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : undefined))))
      .then(() => self.clients.claim())
  );
});

// 是否為「導覽請求」（載入頁面本身，而非資產）
function isNavigationRequest(request) {
  return request.mode === 'navigate'
    || (request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 只處理同源 GET；跨源（Gemini / Google Maps / CDN / 字型）一律放行，避免 CORS 與快取污染。
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // 1) 導覽/HTML：network-first —— 確保 app shell 永遠最新。
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(APP_SHELL)))
    );
    return;
  }

  // 2) 其他同源資產（hashed，內容不可變）：stale-while-revalidate。
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => undefined);
      return cachedResponse || fetchPromise;
    })
  );
});
