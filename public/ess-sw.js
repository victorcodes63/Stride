const CACHE = 'ess-shell-v3';
const RUNTIME = 'ess-runtime-v3';
const PRECACHE = [
  '/ess/offline',
  '/api/ess/manifest',
  '/icons/ess-192.svg',
  '/icons/ess-512.svg',
  '/icons/ess-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![CACHE, RUNTIME].includes(k)).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

async function putRuntime(request, response) {
  if (!response || response.status !== 200) return response;
  const cache = await caches.open(RUNTIME);
  await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept Next.js bundles — cache-first here breaks HMR and post-deploy chunk swaps.
  if (url.pathname.startsWith('/_next/')) return;

  const isEssPage = url.pathname.startsWith('/ess');
  const isEssAsset =
    url.pathname.startsWith('/icons/ess-') || url.pathname === '/api/ess/manifest';

  if (!isEssPage && !isEssAsset) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => putRuntime(request, res))
        .catch(() => caches.match(request).then((r) => r || caches.match('/ess/offline'))),
    );
    return;
  }

  if (isEssAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => putRuntime(request, res))),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => putRuntime(request, res))
      .catch(() => caches.match(request)),
  );
});
