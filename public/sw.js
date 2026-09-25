// Munsi Store & FMCG Order Booker - Service Worker
const CACHE_NAME = 'munsi-store-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push Notification Handler
self.addEventListener('push', (event) => {
  let data = {
    title: '🔔 মুন্সী স্টোর নোটিফিকেশন',
    body: 'আপনার স্টোরে নতুন আপডেট এসেছে!',
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    url: '/',
    tag: 'munsi-push-' + Date.now(),
  };

  if (event.data) {
    try {
      const rawText = event.data.text();
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          if (parsed && typeof parsed === 'object') {
            data = { ...data, ...parsed };
          } else {
            data.body = rawText;
          }
        } catch {
          data.body = rawText;
        }
      }
    } catch (e) {
      console.warn('Push payload read notice:', e);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/icon.svg',
    image: data.image || undefined,
    tag: data.tag || 'munsi-alert',
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
      ...data.data,
    },
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'open_app', title: '📱 অ্যাপে দেখুন' },
      { action: 'dismiss', title: 'বন্ধ করুন' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Push Subscription Change Handler
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((newSubscription) => {
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: newSubscription,
            oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null
          })
        });
      })
  );
});
