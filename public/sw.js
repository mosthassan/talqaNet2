// Talqa Net Service Worker - Invalidation & Cleanup
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// Do not intercept network requests - allow fresh Vite/React modules
self.addEventListener('fetch', () => {
  // Pass through
});
