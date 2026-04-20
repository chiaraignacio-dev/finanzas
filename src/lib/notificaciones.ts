// ── Servicio de notificaciones push ───────────────────
// Programa recordatorios para vencimientos de servicios

import { sbGet } from './supabase';
import { obtenerFechaISO } from './utils';
import type { Servicio } from './types';

const SW_URL = './sw.js';

// ── Registrar service worker ───────────────────────────
export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_URL);
  } catch (e) {
    console.error('Error registrando SW:', e);
    return null;
  }
}

// ── Solicitar permiso de notificaciones ────────────────
export async function solicitarPermisoNotificaciones(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const resultado = await Notification.requestPermission();
  return resultado === 'granted';
}

// ── Estado actual del permiso ──────────────────────────
export function obtenerEstadoNotificaciones(): 'activo' | 'bloqueado' | 'no-soportado' | 'pendiente' {
  if (!('Notification' in window)) return 'no-soportado';
  if (Notification.permission === 'granted') return 'activo';
  if (Notification.permission === 'denied')  return 'bloqueado';
  return 'pendiente';
}

// ── Programar recordatorio para un servicio ────────────
// Muestra la notificación si el vencimiento es dentro de los próximos 3 días
export function programarRecordatorioServicio(
  servicio: string,
  monto   : number,
  vctoStr : string,
): void {
  if (Notification.permission !== 'granted') return;

  const vcto    = new Date(vctoStr + 'T09:00:00');
  const ahora   = new Date();
  const diffMs  = vcto.getTime() - ahora.getTime();
  const diffDias = diffMs / (1000 * 60 * 60 * 24);

  // Solo programar si vence en los próximos 3 días
  if (diffMs <= 0 || diffDias > 3) return;

  const label = servicio.charAt(0).toUpperCase() + servicio.slice(1);
  const dias  = Math.ceil(diffDias);
  const cuando = dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;

  setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification(`🔌 ${label} vence ${cuando}`, {
        body: `$${Math.round(monto).toLocaleString('es-AR')} — recordá pagarlo antes del vencimiento.`,
        icon: '/favicon.ico',
        tag : `servicio-${servicio}-${vctoStr}`, // evita duplicados
      });
    }
  }, Math.max(0, diffMs - 24 * 60 * 60 * 1000)); // 24hs antes del vencimiento
}

// ── Programar todos los servicios pendientes del usuario ─
export async function programarRecordatoriosServicios(userId: string): Promise<void> {
  if (Notification.permission !== 'granted') return;

  try {
    const hoy        = obtenerFechaISO();
    const en7dias    = new Date();
    en7dias.setDate(en7dias.getDate() + 7);
    const en7diasStr = en7dias.toISOString().split('T')[0];

    const servicios = await sbGet<Servicio>('servicios', {
      user_id          : `eq.${userId}`,
      estado           : 'eq.pendiente',
      fecha_vencimiento: `gte.${hoy}`,
    }, 0);

    const proximosSemana = servicios.filter(
      s => s.fecha_vencimiento <= en7diasStr,
    );

    for (const s of proximosSemana) {
      programarRecordatorioServicio(
        s.servicio,
        parseFloat(s.mi_parte),
        s.fecha_vencimiento,
      );
    }
  } catch (e) {
    console.error('Error programando recordatorios:', e);
  }
}
