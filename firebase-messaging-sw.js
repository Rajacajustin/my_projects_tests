// Firebase Messaging Service Worker Stub
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// This configuration is auto-injected or can be defined statically
// Service worker stub for background notification handling
self.addEventListener('install', (event) => {
  console.log('[FCM Service Worker] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[FCM Service Worker] Activated');
});

self.addEventListener('push', function(event) {
  console.log('[FCM Service Worker] Push Received.');
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { notification: { title: 'New Message', body: event.data ? event.data.text() : '' } };
  }

  const title = payload.notification?.title || 'New Message';
  const options = {
    body: payload.notification?.body || 'You have a new message.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {}
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
