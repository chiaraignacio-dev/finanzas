import { sbGet, sbPost, sbPatch } from './supabase';
import type {
  GastoRecurrente,
  GastoRecurrentePago,
  GastoRecurrenteConHistorial,
} from './types';

function periodoActual(): string {
  return new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' });
}

export async function getGastosRecurrentes(userId: string): Promise<GastoRecurrenteConHistorial[]> {
  const [gastos, pagos] = await Promise.all([
    sbGet<GastoRecurrente>('gastos_recurrentes', {
      user_id: `eq.${userId}`,
      activa  : 'eq.true',
    }, 0),
    sbGet<GastoRecurrentePago>('gastos_recurrentes_pagos', {}, 0),
  ]);

  const actual = periodoActual();

  return gastos.map((g) => {
    const pagosDeEste = pagos
      .filter((p) => p.gasto_recurrente_id === g.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      ...g,
      pagos           : pagosDeEste,
      ultimo_monto    : pagosDeEste[0]?.monto ?? g.monto_estimado,
      pagado_este_mes : pagosDeEste.some((p) => p.periodo === actual),
    };
  });
}

export async function crearGastoRecurrente(
  data: Omit<GastoRecurrente, 'id' | 'created_at' | 'updated_at'>
): Promise<GastoRecurrente> {
  return sbPost<GastoRecurrente>('gastos_recurrentes', data as Record<string, unknown>);
}

export async function actualizarGastoRecurrente(
  id  : string,
  data: Partial<Pick<GastoRecurrente,
    'nombre' | 'emoji' | 'descripcion' | 'tipo' | 'division' | 'monto_estimado' | 'activa'
  >>
): Promise<void> {
  await sbPatch('gastos_recurrentes', id, data as Record<string, unknown>);
}

export async function registrarPagoGastoRecurrente(
  pago: Omit<GastoRecurrentePago, 'id' | 'created_at'>
): Promise<GastoRecurrentePago> {
  return sbPost<GastoRecurrentePago>('gastos_recurrentes_pagos', pago as Record<string, unknown>);
}

// ── Alias legacy para ResumenForm ─────────────────────
/** @deprecated */
export const getSuscripciones          = getGastosRecurrentes;
/** @deprecated */
export const crearSuscripcion          = crearGastoRecurrente;
/** @deprecated */
export const actualizarSuscripcion     = actualizarGastoRecurrente;
/** @deprecated */
export const registrarPagoSuscripcion  = registrarPagoGastoRecurrente;
