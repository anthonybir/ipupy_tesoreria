/**
 * ABSD Service Worker - IPU PY Treasury System
 * Anthony Bir System Designs (ABSD) Studio
 *
 * Paraguayan Pragmatism: Offline-first service worker
 * for reliable treasury management even with poor connectivity
 */

const CACHE_NAME = 'absd-treasury-v1.2.0';
const RUNTIME_CACHE = 'absd-runtime';

// Assets to cache immediately (critical resources)
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/css/absd-tokens.css',
  '/js/absd-components.js',
  '/js/es-gn-locale.js',
  '/js/offline-storage.js',
  '/manifest.json'
];

// API endpoints that should be cached
const CACHEABLE_APIS = [
  '/api/churches',
  '/api/dashboard',
  '/api/reports/recent'
];

// Fonts and static assets
const STATIC_ASSETS = [
  '/fonts/absd-fonts.css'
  // Font files will be cached when requested
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('ABSD Service Worker: Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('ABSD Service Worker: Caching core assets');
        return cache.addAll([...CORE_ASSETS, ...STATIC_ASSETS]);
      })
      .then(() => {
        console.log('ABSD Service Worker: Core assets cached');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('ABSD Service Worker: Failed to cache core assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('ABSD Service Worker: Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old cache versions
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('ABSD Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('ABSD Service Worker: Activated');
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different request types with appropriate strategies
  if (request.method === 'GET') {
    event.respondWith(handleGetRequest(request));
  } else if (request.method === 'POST') {
    event.respondWith(handlePostRequest(request));
  }
});

/**
 * Handle GET requests with cache-first or network-first strategies
 */
async function handleGetRequest(request) {
  const url = new URL(request.url);

  try {
    // Strategy 1: Cache-first for static assets
    if (isStaticAsset(url.pathname)) {
      return await cacheFirst(request);
    }

    // Strategy 2: Enhanced stale-while-revalidate for API calls
    if (isApiRequest(url.pathname)) {
      return await enhancedApiStrategy(request);
    }

    // Strategy 3: Stale-while-revalidate for HTML pages
    if (isHtmlRequest(request)) {
      return await staleWhileRevalidate(request);
    }

    // Default: Network-first
    return await networkFirst(request);

  } catch (error) {
    console.error('ABSD Service Worker: Fetch error', error);
    return await getOfflineFallback(request);
  }
}

/**
 * Handle POST requests (form submissions, data saves)
 */
async function handlePostRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);

    if (response.ok) {
      return response;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }

  } catch (error) {
    console.error('ABSD Service Worker: POST request failed, storing for later sync', error);

    // Store failed POST requests for background sync
    await storeFailedRequest(request);

    // Return a custom response indicating offline save
    return new Response(
      JSON.stringify({
        success: false,
        offline: true,
        message: 'Guardado localmente. Se sincronizará cuando regrese la conexión.'
      }),
      {
        status: 202, // Accepted
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Cache-first strategy: Check cache first, fallback to network
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }

  return response;
}

/**
 * Enhanced API strategy: Intelligent stale-while-revalidate with TTL
 */
async function enhancedApiStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const url = new URL(request.url);

  // Define cache TTL based on endpoint
  const cacheTTL = getApiCacheTTL(url.pathname);

  try {
    // Check cache first
    const cached = await cache.match(request);

    if (cached) {
      const cacheTime = new Date(cached.headers.get('X-Cache-Time') || 0);
      const isStale = Date.now() - cacheTime.getTime() > cacheTTL;

      if (!isStale) {
        // Fresh cache - return immediately
        console.log('ABSD Service Worker: Fresh cache hit for', url.pathname);
        return cached;
      } else {
        // Stale cache - return it but start background revalidation
        console.log('ABSD Service Worker: Stale cache, revalidating', url.pathname);

        // Background revalidation (don't await)
        backgroundRevalidate(request, cache);

        // Return stale cache with indicator
        return await addStaleHeader(cached);
      }
    }

    // No cache - try network first
    const response = await fetch(request);

    if (response.ok) {
      // Cache with timestamp
      const responseToCache = response.clone();
      responseToCache.headers.set('X-Cache-Time', new Date().toISOString());
      cache.put(request, responseToCache);

      console.log('ABSD Service Worker: Network response cached for', url.pathname);
      return response;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }

  } catch (error) {
    console.error('ABSD Service Worker: Network failed for', url.pathname, error);

    // Fallback to any available cache
    const cached = await cache.match(request);
    if (cached) {
      console.log('ABSD Service Worker: Fallback to stale cache for', url.pathname);
      return await addOfflineHeader(cached);
    }

    // No cache available - return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Service unavailable offline',
        message: 'Esta función requiere conexión a internet',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
          'X-Served-By': 'ABSD-ServiceWorker',
          'X-Offline-Mode': 'true'
        }
      }
    );
  }
}

/**
 * Background revalidation without blocking
 */
async function backgroundRevalidate(request, cache) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const responseToCache = response.clone();
      responseToCache.headers.set('X-Cache-Time', new Date().toISOString());
      cache.put(request, responseToCache);

      console.log('ABSD Service Worker: Background revalidation complete');
    }
  } catch (error) {
    console.error('ABSD Service Worker: Background revalidation failed', error);
  }
}

/**
 * Get cache TTL based on API endpoint
 */
function getApiCacheTTL(pathname) {
  if (pathname.includes('/api/funds')) {return 2 * 60 * 1000;}      // 2 minutes
  if (pathname.includes('/api/churches')) {return 10 * 60 * 1000;}  // 10 minutes
  if (pathname.includes('/api/dashboard')) {return 1 * 60 * 1000;}  // 1 minute
  if (pathname.includes('/api/db-test')) {return 30 * 1000;}        // 30 seconds

  return 5 * 60 * 1000; // Default 5 minutes
}

/**
 * Add stale cache indicator to response
 */
async function addStaleHeader(response) {
  const responseClone = response.clone();
  const body = await responseClone.text();

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers),
      'X-Served-By': 'ABSD-ServiceWorker',
      'X-Cache-Status': 'stale',
      'X-Revalidating': 'true'
    }
  });
}

/**
 * Stale-while-revalidate: Return cache immediately, update in background
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Start background fetch
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  // Return cached version immediately if available
  if (cached) {
    return cached;
  }

  // If no cache, wait for network
  return await fetchPromise;
}

/**
 * Network-first strategy
 */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    throw error;
  }
}

/**
 * Get offline fallback response
 */
async function getOfflineFallback(request) {
  // Return offline page for navigation requests
  if (request.mode === 'navigate') {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match('/index.html');
  }

  // Return empty response for other requests
  return new Response('', {
    status: 408,
    statusText: 'Request Timeout (Offline)'
  });
}

/**
 * Add offline indicator to response headers
 */
async function addOfflineHeader(response) {
  const responseClone = response.clone();
  const body = await responseClone.text();

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers),
      'X-Served-By': 'ABSD-ServiceWorker',
      'X-Offline-Cache': 'true'
    }
  });
}

/**
 * Store failed requests for background sync
 */
async function storeFailedRequest(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      body: await request.text(),
      timestamp: Date.now()
    };

    // Store in IndexedDB via message to client
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'STORE_FAILED_REQUEST',
        data: requestData
      });
    });

  } catch (error) {
    console.error('ABSD Service Worker: Failed to store request', error);
  }
}

// Helper functions to determine request types

function isStaticAsset(pathname) {
  return pathname.startsWith('/css/') ||
         pathname.startsWith('/js/') ||
         pathname.startsWith('/fonts/') ||
         pathname.startsWith('/icons/') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.js') ||
         pathname.endsWith('.woff2') ||
         pathname.endsWith('.woff') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.svg');
}

function isApiRequest(pathname) {
  return pathname.startsWith('/api/') ||
         CACHEABLE_APIS.some(api => pathname.startsWith(api));
}

function isHtmlRequest(request) {
  return request.headers.get('Accept')?.includes('text/html');
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-failed-requests') {
    console.log('ABSD Service Worker: Background sync triggered');
    event.waitUntil(syncFailedRequests());
  }
});

async function syncFailedRequests() {
  // This would work with the offline storage system
  // to retry failed requests when connection is restored
  console.log('ABSD Service Worker: Syncing failed requests...');

  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_FAILED_REQUESTS'
    });
  });
}

// Push notifications (for future implementation)
self.addEventListener('push', (event) => {
  console.log('ABSD Service Worker: Push message received');

  const options = {
    body: 'Tiene reportes pendientes por enviar',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'treasury-reminder'
    },
    actions: [
      {
        action: 'view',
        title: 'Ver Dashboard',
        icon: '/icons/action-view.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/icons/action-close.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('IPU PY Tesorería', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('ABSD Service Worker: Notification clicked');
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      self.clients.openWindow('/')
    );
  }
});

// Message handling from clients
self.addEventListener('message', (event) => {
  const { type } = event.data || {};

  switch (type) {
  case 'SKIP_WAITING':
    self.skipWaiting();
    break;

  case 'GET_VERSION':
    event.ports[0].postMessage({
      version: CACHE_NAME,
      status: 'active'
    });
    break;

  case 'FORCE_UPDATE':
    // Clear caches and update
    caches.keys().then(names => {
      return Promise.all(names.map(name => caches.delete(name)));
    }).then(() => {
      self.skipWaiting();
    });
    break;

  default:
    console.log('ABSD Service Worker: Unknown message type', type);
  }
});

console.log('ABSD Service Worker: Loaded successfully');

// Performance monitoring
self.addEventListener('fetch', (event) => {
  // Track cache hit rates and performance metrics
  const startTime = performance.now();

  event.respondWith(
    handleGetRequest(event.request).then((response) => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Log performance metrics (could send to analytics)
      if (duration > 1000) {
        console.warn(`ABSD Service Worker: Slow request (${duration}ms):`, event.request.url);
      }

      return response;
    })
  );
});