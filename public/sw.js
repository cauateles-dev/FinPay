const CACHE_NAME = 'finpay-pwa-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell and core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache bundle:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Caching strategy: Stale-While-Revalidate for app assets, bypass for Supabase/external API calls)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Evitar cache no ambiente de desenvolvimento ou preview do AI Studio
  const isDevelopment = url.hostname.includes('localhost') || 
                        url.hostname.includes('run.app') || 
                        url.hostname.includes('gitpod');

  if (isDevelopment) {
    return; // Não intercepta, deixa carregar direto da rede
  }

  // Bypass API calls (like Supabase database queries or authentication) to avoid caching dynamic live database updates
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch from network in the background to keep the cache modern/updated (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch((err) => {
          // Ignore network errors in background refresher
          console.debug('[Service Worker] Background fetch failed (offline):', err);
        });

        return cachedResponse;
      }

      // Fallback to normal fetch
      return fetch(event.request).then((networkResponse) => {
        // Cache new GET assets locally on the fly
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
