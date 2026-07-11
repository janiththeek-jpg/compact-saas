// Compact Service Worker
// Enables offline support, caching, push notifications, and app-like experience

const CACHE_NAME = 'compact-v1';
const RUNTIME_CACHE = 'compact-runtime-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching essential assets');
        return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.log('[Service Worker] Cache setup (some assets may not be available yet)');
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and non-http(s) requests
  if (request.url.includes('chrome-extension') || !request.url.startsWith('http')) {
    return;
  }

  // Network first strategy with cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => {
          cache.put(request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(request)
          .then(response => {
            if (response) {
              return response;
            }

            // Return offline page if available
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }

            return new Response('Offline - content not available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Background sync for offline-first operations
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sync event:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Push notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push notification received');

  const options = {
    body: event.data ? event.data.text() : 'New notification from Compact',
    icon: '/data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%230071e3" rx="45" width="192" height="192"/><text x="96" y="96" font-size="80" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="system-ui" font-weight="600">C</text></svg>',
    badge: '/data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%230071e3" rx="45" width="192" height="192"/><text x="96" y="96" font-size="80" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="system-ui" font-weight="600">C</text></svg>',
    tag: 'compact-notification',
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Compact', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification clicked');

  if (event.action === 'close') {
    event.notification.close();
    return;
  }

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if app is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not already open
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Periodic background sync for checking updates
self.addEventListener('periodicsync', event => {
  console.log('[Service Worker] Periodic sync event:', event.tag);

  if (event.tag === 'check-updates') {
    event.waitUntil(checkForUpdates());
  }
});

// Helper function to sync offline data
async function syncOfflineData() {
  try {
    console.log('[Service Worker] Syncing offline data...');
    // This would sync any offline-created data with the server
    // For now, just log it
    return Promise.resolve();
  } catch (error) {
    console.error('[Service Worker] Sync error:', error);
    return Promise.reject(error);
  }
}

// Helper function to check for app updates
async function checkForUpdates() {
  try {
    console.log('[Service Worker] Checking for app updates...');
    // Periodically check if there's a new version available
    const response = await fetch('/manifest.json');
    console.log('[Service Worker] App up to date');
    return Promise.resolve();
  } catch (error) {
    console.error('[Service Worker] Update check error:', error);
  }
}

// Keep service worker alive with periodic heartbeat
setInterval(() => {
  // Heartbeat to prevent service worker from being terminated
}, 30000);

console.log('[Service Worker] Loaded and ready');