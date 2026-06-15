// ── Fino Palastro — Service Worker ─────────────────────────────────────────
const CACHE_NAME = 'fino-palastro-v2';

// Arquivos que ficam disponíveis offline
const STATIC_ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js'
];

// ── INSTALL: pré-carrega os assets estáticos ────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpa caches antigos ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── NOTIFICATION CLICK: abre o app ao tocar na notificação ─────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/index.html');
    })
  );
});

// ── FETCH: network-first para Firebase/APIs, cache-first para estáticos ─────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase, Google APIs, InfinitePay → sempre direto da rede
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('googleapis.com') ||
    url.includes('infinitepay') ||
    url.includes('workers.dev') ||
    url.includes('viacep') ||
    url.includes('wa.me')
  ) {
    return; // deixa o browser lidar normalmente
  }

  // Para todo o resto: tenta rede, cai no cache se offline
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Salva cópia fresca no cache se for GET bem-sucedido
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: serve do cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback para index.html se for navegação
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
