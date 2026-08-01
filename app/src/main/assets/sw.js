// ============================================
// ALPHEX AI SOLUTIONS POS - Service Worker
// ============================================

const CACHE_NAME = 'alpex-pos-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/scanner.js',
    '/js/supabase-client.js',
    '/config.js',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(fetchRes => {
                if (fetchRes.ok && event.request.url.startsWith(self.location.origin)) {
                    const clone = fetchRes.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return fetchRes;
            });
        }).catch(() => {
            if (event.request.destination === 'document') {
                return caches.match('/index.html');
            }
        })
    );
});
