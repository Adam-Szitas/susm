const files = /* BUILD_ASSETS */ [];
const cacheName = 'susm-release-BUILD_VERSION';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(files.map((url) => new Request(url, { cache: 'reload' })))),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== cacheName && /^(susm-release-|susm-cache-v\d+$)/.test(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  if (
    request.mode === 'navigate' &&
    /^\/(?:$|(?:projects|objects|dashboard|protocols|files|login|register|admin)(?:\/|$))/.test(
      url.pathname,
    )
  ) {
    event.respondWith(
      fetch(request).catch(async () => (await caches.open(cacheName)).match('/offline.html')),
    );
  } else if (!url.search && files.includes(url.pathname)) {
    event.respondWith(
      caches.open(cacheName).then(async (cache) => (await cache.match(request)) || fetch(request)),
    );
  }
});
