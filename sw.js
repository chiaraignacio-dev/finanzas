self.addEventListener('push', e => {
    const d = e.data?.json() || {};
    self.registration.showNotification(d.title || 'Finanzas', {
        body: d.body || '',
        icon: '/favicon.ico'
    });
});
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(clients.openWindow('/'));
});