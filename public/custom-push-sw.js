// Service Worker Push Notification Handler for Munsi Store

self.addEventListener('push', function (event) {
  let notificationData = {
    title: 'Munsi Store নোটিফিকেশন',
    body: 'আপনার স্টোরে নতুন আপডেট এসেছে!',
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    url: '/',
    tag: 'munsi-store-push-' + Date.now(),
  };

  if (event.data) {
    try {
      const rawText = event.data.text();
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          if (parsed && typeof parsed === 'object') {
            notificationData = { ...notificationData, ...parsed };
          } else {
            notificationData.body = rawText;
          }
        } catch {
          notificationData.body = rawText;
        }
      }
    } catch (e) {
      console.warn('Custom push payload read notice:', e);
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/pwa-192x192.png',
    badge: notificationData.badge || '/icon.svg',
    image: notificationData.image || undefined,
    tag: notificationData.tag || 'munsi-store-alert',
    data: {
      url: notificationData.url || '/',
      timestamp: Date.now(),
      ...notificationData.data
    },
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    actions: [
      {
        action: 'open_app',
        title: '📱 অ্যাপে দেখুন',
      },
      {
        action: 'dismiss',
        title: 'বন্ধ করুন',
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
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

self.addEventListener('pushsubscriptionchange', function (event) {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(function (newSubscription) {
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
