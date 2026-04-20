self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  self.registration.showNotification(d.title || 'MyFi', {
    body : d.body  || '',
    icon : '/favicon.ico',
    badge: '/favicon.ico',
    tag  : d.tag   || 'myfi',
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
