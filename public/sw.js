// Minimal SW for offline push notifications
const scheduledNotifications = new Map(); // recordId -> [timeoutIds]

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_VACCINE') {
    const { recordId, patientName, vaccineName, daysBefore, fireAtMs } = event.data.payload;
    const msUntilFire = fireAtMs - Date.now();
    
    if (msUntilFire > 0) {
      const timeoutId = setTimeout(() => {
        self.registration.showNotification(`Vaccination Reminder: ${patientName}`, {
          body: `${vaccineName} is due in ${daysBefore} day${daysBefore > 1 ? 's' : ''}. Please contact the parents.`,
          icon: '/favicon.ico',
          tag: `vac-${recordId}-${daysBefore}`,
          requireInteraction: true
        });
      }, msUntilFire);

      if (!scheduledNotifications.has(recordId)) {
        scheduledNotifications.set(recordId, []);
      }
      scheduledNotifications.get(recordId).push(timeoutId);
    }
  } else if (event.data && event.data.type === 'CANCEL_VACCINE') {
    const { recordId } = event.data.payload;
    if (scheduledNotifications.has(recordId)) {
      const timeouts = scheduledNotifications.get(recordId);
      timeouts.forEach(clearTimeout);
      scheduledNotifications.delete(recordId);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Focus the app if it's already open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
