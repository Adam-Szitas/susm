const CACHE_NAME = 'susm-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.ico'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Cache install failed:', error);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all pages immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const request = event.request;
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  // Skip caching for API calls, file operations, and external resources
  const isSameOrigin = url.origin === self.location.origin;
  const isApiCall = url.pathname.startsWith('/api/') || 
                    url.pathname.startsWith('/file/') ||
                    url.pathname.startsWith('/uploads/') ||
                    url.pathname.startsWith('/projects/') ||
                    url.pathname.startsWith('/objects/') ||
                    url.pathname.startsWith('/files') ||
                    url.pathname.startsWith('/auth/') ||
                    url.pathname.startsWith('/company/');
  
  // Only cache same-origin static assets (HTML, CSS, JS, images, fonts, etc.)
  const isStaticAsset = /\.(html|css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url.pathname) ||
                         url.pathname === '/' ||
                         url.pathname === '/index.html';
  
  if (!isSameOrigin || isApiCall || !isStaticAsset) {
    // For API calls, external resources, and non-static assets, always fetch from network
    event.respondWith(fetch(request));
    return;
  }
  
  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }
        // Otherwise fetch from network and cache it
        return fetch(request).then((response) => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // Clone the response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail, return offline page if available
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
        // Return a basic offline response for other requests
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
