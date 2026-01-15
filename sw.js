// Service Worker for AR Notes App
// Handles offline functionality and caching

const CACHE_NAME = 'ar-notes-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[SW] All assets cached');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('[SW] Cache installation failed:', err);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip chrome extension requests
    if (event.request.url.startsWith('chrome-extension://')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached response if found
                if (cachedResponse) {
                    console.log('[SW] Serving from cache:', event.request.url);
                    return cachedResponse;
                }
                
                // Otherwise fetch from network
                console.log('[SW] Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        // Cache successful responses
                        if (response && response.status === 200 && response.type === 'basic') {
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return response;
                    })
                    .catch((err) => {
                        console.error('[SW] Fetch failed:', err);
                        // Return offline page or default response
                        return new Response(
                            '<html><body><h1>Offline</h1><p>Please check your internet connection.</p></body></html>',
                            { headers: { 'Content-Type': 'text/html' } }
                        );
                    });
            })
    );
});

// Background sync for offline note creation
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered');
    
    if (event.tag === 'sync-notes') {
        event.waitUntil(syncNotes());
    }
});

async function syncNotes() {
    console.log('[SW] Syncing notes...');
    // This would sync any offline-created notes when connection is restored
    // Implementation depends on your backend
}

// Push notifications (optional feature)
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New AR note nearby!',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">📍</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><text y="0.9em" font-size="80">📍</text></svg>',
        vibrate: [200, 100, 200],
        tag: 'ar-notes',
        requireInteraction: false
    };
    
    event.waitUntil(
        self.registration.showNotification('AR Notes', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

console.log('[SW] Service worker script loaded');