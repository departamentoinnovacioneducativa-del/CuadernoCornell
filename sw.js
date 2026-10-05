// CADA VEZ QUE HAGAS UN CAMBIO EN TU CÓDIGO, CAMBIA ESTE NÚMERO (ej. v3, v4, v5...)
const CACHE_NAME = 'cornell-cc-v3'; 

const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon.png'
];

self.addEventListener('install', event => {
    // Fuerzo a que el nuevo SW se instale inmediatamente sin esperar a que cierres la app
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log(`Cacheando archivos para ${CACHE_NAME}`);
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Borro todas las cachés viejas que no sean la versión actual
                    if (cacheName !== CACHE_NAME) {
                        console.log(`Borrando caché antigua: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Tomar el control de los clientes de inmediato
    return self.clients.claim(); 
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Devuelve la caché o hace la petición a la red
                return response || fetch(event.request);
            })
    );
});
