self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  self.registration.showNotification(d.title || 'MyFi', {
    body : d.body  || '',
    icon : d.icon  || '/finanzas/icon-192.png',
    badge: d.badge || '/finanzas/icon-96.png',
    tag  : d.tag   || 'myfi',
    data : d.data  || { url: '/finanzas/' },
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/finanzas/';
  e.waitUntil(clients.openWindow(url));
});
