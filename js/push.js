// ══════════════════════════════════════════════════════
//  push.js — Web Push notifications
// ══════════════════════════════════════════════════════


function checkPushStatus() {
  const statusEl = document.getElementById('push-status');
  const btnEl    = document.getElementById('push-btn');

  if (!('Notification' in window)) {
    if (statusEl) statusEl.textContent = 'Tu navegador no soporta notificaciones push.';
    return;
  }

  if (Notification.permission === 'granted') {
    if (btnEl)    { btnEl.textContent = '🔔 Notificaciones activas'; btnEl.disabled = true; }
    if (statusEl) statusEl.textContent = 'Las notificaciones están activas en este dispositivo.';
  } else if (Notification.permission === 'denied') {
    if (statusEl) statusEl.textContent = 'Bloqueaste las notificaciones. Habilitá desde la configuración del navegador.';
  }
}

async function enablePush() {
  if (!('Notification' in window)) { toast('Tu navegador no soporta notificaciones', 'err'); return; }

  const perm = await Notification.requestPermission();

  if (perm === 'granted') {
    const btnEl    = document.getElementById('push-btn');
    const statusEl = document.getElementById('push-status');
    if (btnEl)    { btnEl.textContent = '🔔 Notificaciones activas'; btnEl.disabled = true; }
    if (statusEl) statusEl.textContent = '¡Listo! Recibirás alertas en este dispositivo.';
    toast('Notificaciones activadas ✓');

    // Registrar service worker en blob para notificaciones de fondo
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch { /* ignorar si el browser no lo permite */ }
    }
  } else {
    toast('No se pudo activar las notificaciones', 'err');
  }
}

/**
 * Programa una notificación push para el día de vencimiento
 * de un servicio (solo si el vencimiento está dentro de los
 * próximos 7 días).
 */
function schedulePushForService(servicio, monto, vctoDate) {
  if (Notification.permission !== 'granted') return;

  const vcto  = new Date(vctoDate + 'T09:00:00');
  const now   = new Date();
  const delay = vcto - now;

  if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) {
    setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('🔌 Servicio por vencer', {
          body : `${servicio.charAt(0).toUpperCase() + servicio.slice(1)}: ${fmt(monto)} vence hoy`,
          icon : '/favicon.ico'
        });
      }
    }, delay);
  }
}
