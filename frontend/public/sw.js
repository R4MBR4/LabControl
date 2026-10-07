const CACHE_NAME = 'labcontrol-shell-v1';
const SCOPE_URL = self.registration.scope;
const INDEX_URL = new URL('index.html', SCOPE_URL).href;
const API_PATH = new URL('api/', SCOPE_URL).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const shellResponse = await fetch(INDEX_URL);
    if (!shellResponse.ok) throw new Error(`Não foi possível carregar o shell: ${shellResponse.status}`);
    const shellHtml = await shellResponse.clone().text();
    const shellAssets = [...shellHtml.matchAll(/\b(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)]
      .map((match) => new URL(match[1], INDEX_URL))
      .filter((url) => url.origin === self.location.origin && url.pathname.startsWith(new URL(SCOPE_URL).pathname))
      .map((url) => url.href);

    await cache.put(INDEX_URL, shellResponse);
    await cache.addAll([
      new URL('manifest.webmanifest', SCOPE_URL).href,
      new URL('labcontrol-icon.svg', SCOPE_URL).href,
      ...new Set(shellAssets)
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith('labcontrol-shell-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (
    request.method !== 'GET' ||
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname.startsWith(API_PATH)
  ) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(INDEX_URL, response.clone());
        }
        return response;
      } catch (error) {
        const cachedIndex = await caches.match(INDEX_URL);
        if (cachedIndex) return cachedIndex;
        throw error;
      }
    })());
    return;
  }

  if (!['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) return;

  event.respondWith((async () => {
    const cachedResponse = await caches.match(request, { ignoreVary: true });
    const refresh = fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    });
    if (cachedResponse) {
      refresh.catch((error) => console.error('[PWA] Falha ao atualizar recurso em cache:', error));
      return cachedResponse;
    }
    return refresh;
  })());
});
