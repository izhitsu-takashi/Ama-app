/* eslint-disable no-undef */

// Basic Firebase Messaging service worker
// This file must be served from the origin root as /firebase-messaging-sw.js

self.addEventListener('install', () => {
  // Activate immediately on install
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// If using Firebase Messaging v9 compat in SW is needed, we'd import scripts here if required.
// For simple background notifications delivered via showNotification from functions, we can rely on 'push' event.

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = (() => {
    try { return event.data.json(); } catch { return {}; }
  })();

  // Support both notification and data-only payloads
  const notification = payload.notification || {};
  const title = notification.title || (payload.data && payload.data.title) || '新しい通知';
  const body = notification.body || (payload.data && payload.data.body) || '';
  const icon = (notification.icon || (payload.data && payload.data.icon)) || '/assets/icons/icon-192.png';
  const badge = (notification.badge || (payload.data && payload.data.badge)) || '/assets/icons/icon-72.png';
  const url = (payload.data && payload.data.url) || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) {
        client.focus();
        client.postMessage({ type: 'notification-clicked', url });
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(url);
    }
  })());
});
