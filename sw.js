/* Cuaderno Cornell — service worker v5.
   Caché primero con actualización en segundo plano: la app abre
   sin conexión y los cambios llegan solos en la siguiente visita. */
const CACHE_NAME = 'cornell-cc-v5';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon.png',
    './icon-192.png',
    './icon-maskable.png',
    './lib/jspdf.umd.min.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
    event.respondWith(
        caches.match(event.request).then(hit => {
            const net = fetch(event.request).then(res => {
                if (res && res.status === 200) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
                }
                return res;
            }).catch(() => hit);
            return hit || net;
        })
    );
});
