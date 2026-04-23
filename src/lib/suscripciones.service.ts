import { sbGet, sbPost, sbPatch } from './supabase';
import type { Suscripcion, SuscripcionPago, SuscripcionConHistorial } from './types';

function periodoActual(): string {
  return new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' });
}

export async function getSuscripciones(userId: string): Promise<SuscripcionConHistorial[]> {
  const [suscripciones, pagos] = await Promise.all([
    sbGet<Suscripcion>('suscripciones', { user_id: `eq.${userId}`, activa: 'eq.true' }, 0),
    sbGet<SuscripcionPago>('suscripcion_pagos', {}, 0),
  ]);

  const actual = periodoActual();

  return suscripciones.map((s) => {
    const pagosDeSub = pagos.filter((p) => p.suscripcion_id === s.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      ...s,
      pagos          : pagosDeSub,
      ultimo_monto   : pagosDeSub[0]?.monto ?? s.monto_estimado,
      pagado_este_mes: pagosDeSub.some((p) => p.periodo === actual),
    };
  });
}

export async function crearSuscripcion(
  data: Omit<Suscripcion, 'id' | 'created_at' | 'updated_at'>
): Promise<Suscripcion> {
  return sbPost<Suscripcion>('suscripciones', data as Record<string, unknown>);
}

export async function actualizarSuscripcion(
  id: string,
  data: Partial<Pick<Suscripcion, 'nombre' | 'emoji' | 'descripcion' | 'division' | 'monto_estimado' | 'activa'>>
): Promise<void> {
  await sbPatch('suscripciones', id, data as Record<string, unknown>);
}

export async function registrarPagoSuscripcion(
  pago: Omit<SuscripcionPago, 'id' | 'created_at'>
): Promise<SuscripcionPago> {
  return sbPost<SuscripcionPago>('suscripcion_pagos', pago as Record<string, unknown>);
}
