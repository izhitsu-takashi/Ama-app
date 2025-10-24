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
  const title = notification.title || (payload.data && payload.data.title) || 'AMA - 新しい通知';
  const body = notification.body || (payload.data && payload.data.body) || '';
  const icon = (notification.icon || (payload.data && payload.data.icon)) || '/assets/icons/icon-192.png';
  const badge = (notification.badge || (payload.data && payload.data.badge)) || '/assets/icons/icon-72.png';
  const url = (payload.data && payload.data.url) || '/';
  const type = (payload.data && payload.data.type) || 'general';

  // 通知のオプションを設定
  const options = {
    body,
    icon,
    badge,
    data: { url, type },
    tag: `ama-${type}-${Date.now()}`, // 重複通知を防ぐ
    requireInteraction: false, // 自動で消える
    silent: false, // 音を出す
    actions: [
      {
        action: 'view',
        title: '開く',
        icon: '/assets/icons/icon-72.png'
      },
      {
        action: 'dismiss',
        title: '閉じる',
        icon: '/assets/icons/icon-72.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  const action = event.action;
  
  event.waitUntil((async () => {
    if (action === 'dismiss') {
      // 通知を閉じるだけ
      return;
    }
    
    // 既存のタブを探す
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    
    // 既存のタブがある場合はフォーカスしてURLを更新
    for (const client of allClients) {
      if ('focus' in client && 'navigate' in client) {
        await client.focus();
        await client.navigate(url);
        client.postMessage({ 
          type: 'notification-clicked', 
          url,
          action: action || 'view'
        });
        return;
      }
    }
    
    // 新しいタブを開く
    if (self.clients.openWindow) {
      const newClient = await self.clients.openWindow(url);
      if (newClient) {
        newClient.postMessage({ 
          type: 'notification-clicked', 
          url,
          action: action || 'view'
        });
      }
    }
  })());
});


