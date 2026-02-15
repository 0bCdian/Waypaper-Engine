---
name: pwa-development
description: Progressive Web App development guidelines covering service workers, caching strategies, offline functionality, and installability
---

# Progressive Web App Development Guidelines

You are an expert in building Progressive Web Applications with offline-first capabilities.

## Core Principles

- Design for offline-first experience
- Implement proper caching strategies
- Ensure fast loading and smooth performance
- Follow web app manifest best practices
- Provide native-like experience

## Web App Manifest

```json
{
  "name": "My Progressive Web App",
  "short_name": "MyPWA",
  "description": "A description of your app",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## Service Worker Registration

```javascript
// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered:', registration.scope);
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  });
}
```

## Service Worker Implementation

```javascript
// sw.js
const CACHE_NAME = 'v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }).catch(() => {
      return caches.match('/offline.html');
    })
  );
});
```

## Caching Strategies

### Cache First (Static Assets)
```javascript
async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetch(request);
}
```

### Network First (Dynamic Content)
```javascript
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request);
  }
}
```

### Stale While Revalidate
```javascript
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    cache.put(request, response.clone());
    return response;
  });

  return cached || fetchPromise;
}
```

## Background Sync

```javascript
// Register sync in main app
async function registerSync() {
  const registration = await navigator.serviceWorker.ready;
  await registration.sync.register('sync-data');
}

// Handle sync in service worker
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  const data = await getQueuedData();
  await fetch('/api/sync', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
```

## Push Notifications

```javascript
// Request permission
async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: PUBLIC_VAPID_KEY
    });
    // Send subscription to server
  }
}

// Handle push in service worker
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png'
    })
  );
});
```

## Offline Detection

```javascript
// Check online status
window.addEventListener('online', () => {
  console.log('Back online');
  syncPendingData();
});

window.addEventListener('offline', () => {
  console.log('Offline mode');
  showOfflineIndicator();
});
```

## Performance Optimization

- Implement app shell architecture
- Use lazy loading for routes and components
- Optimize images with responsive formats
- Minimize JavaScript bundle size
- Use code splitting

## Testing

- Test offline functionality
- Verify caching behavior
- Test on various network conditions
- Validate manifest and icons
- Use Lighthouse for PWA audits

## Best Practices

- Serve over HTTPS
- Provide meaningful offline experience
- Handle service worker updates gracefully
- Implement proper error handling
- Add loading states and skeletons
