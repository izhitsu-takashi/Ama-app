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

  // デスクトップ通知機能は無効化
  console.log('プッシュ通知を受信しましたが、デスクトップ通知機能は無効化されています:', payload);
});

self.addEventListener('notificationclick', (event) => {
  // デスクトップ通知機能は無効化されているため、何もしない
  console.log('通知クリックが検出されましたが、デスクトップ通知機能は無効化されています');
});


