// ── Servicio centralizado para deudas interpersonales ──

import { sbGet, sbPost, sbPatch } from './supabase';
import { obtenerFechaISO, partePorDiv } from './utils';
import type { DeudaInterpersonal, PagoDeudaInterpersonal } from './types';

// ── Crear deuda interpersonal ────────────────────────
// Por defecto arranca en 'por_aceptar' para que el deudor la acepte primero
export async function crearDeudaInterpersonal(params: {
  acreedorId  : string;
  deudorId    : string;
  descripcion : string;
  montoTotal  : number;
  origen      : 'gasto' | 'resumen' | 'manual';
  resumenId?  : string;
  movimientoId?: string;
  notas?      : string;
}): Promise<DeudaInterpersonal> {
  return sbPost<DeudaInterpersonal>('deudas_interpersonales', {
    acreedor_id  : params.acreedorId,
    deudor_id    : params.deudorId,
    descripcion  : params.descripcion,
    monto_total  : params.montoTotal,
    monto_pagado : 0,
    estado       : 'por_aceptar',   // ← deudor debe aceptar antes de que impacte
    origen       : params.origen,
    resumen_id   : params.resumenId    ?? null,
    movimiento_id: params.movimientoId ?? null,
    notas        : params.notas        ?? null,
  });
}

// ── El deudor acepta la deuda ────────────────────────
export async function aceptarDeuda(deudaId: string): Promise<void> {
  await sbPatch<DeudaInterpersonal>('deudas_interpersonales', deudaId, {
    estado: 'pendiente',
  });
}

// ── El deudor declara que pagó (parcial o total) ─────
// Crea el registro en pagos_deuda_interpersonal con confirmado=false
// y pasa la deuda a 'por_confirmar' para que el acreedor lo valide
export async function declararPagoDeuda(params: {
  deudaId : string;
  monto   : number;
  notas?  : string;
}): Promise<void> {
  const deudas = await sbGet<DeudaInterpersonal>('deudas_interpersonales', {
    id: `eq.${params.deudaId}`,
  });
  if (!deudas.length) throw new Error('Deuda no encontrada');

  const deuda         = deudas[0];
  const saldo         = parseFloat(deuda.monto_total) - parseFloat(deuda.monto_pagado);
  const montoEfectivo = Math.min(params.monto, saldo);

  // Registrar pago pendiente de confirmación
  await sbPost<PagoDeudaInterpersonal>('pagos_deuda_interpersonal', {
    deuda_id  : params.deudaId,
    monto     : montoEfectivo,
    fecha     : obtenerFechaISO(),
    confirmado: false,
    notas     : params.notas ?? null,
  });

  // Pasar la deuda a 'por_confirmar'
  await sbPatch<DeudaInterpersonal>('deudas_interpersonales', params.deudaId, {
    estado: 'por_confirmar',
  });
}

// ── El acreedor confirma que recibió el pago ─────────
export async function confirmarPagoRecibido(params: {
  deudaId : string;
  pagoId  : string;
  monto   : number;
  acreedorId: string;
}): Promise<void> {
  const deudas = await sbGet<DeudaInterpersonal>('deudas_interpersonales', {
    id: `eq.${params.deudaId}`,
  });
  if (!deudas.length) throw new Error('Deuda no encontrada');

  const deuda      = deudas[0];
  const nuevoPag   = parseFloat(deuda.monto_pagado) + params.monto;
  const nuevoSaldo = parseFloat(deuda.monto_total) - nuevoPag;
  const nuevoEstado = nuevoSaldo <= 0 ? 'pagado' : 'parcial';

  // Marcar el pago como confirmado
  await sbPatch<PagoDeudaInterpersonal>('pagos_deuda_interpersonal', params.pagoId, {
    confirmado: true,
  });

  // Actualizar la deuda
  await sbPatch<DeudaInterpersonal>('deudas_interpersonales', params.deudaId, {
    monto_pagado: nuevoPag,
    estado      : nuevoEstado,
  });

  // Registrar ingreso en la cuenta del acreedor
  await sbPost('ingresos', {
    user_id        : params.acreedorId,
    descripcion    : `Cobro confirmado: ${deuda.descripcion}`,
    monto          : params.monto,
    tipo           : 'extra',
    fecha_esperada : obtenerFechaISO(),
    fecha_recibido : obtenerFechaISO(),
    recibido       : true,
    recurrente     : false,
  });
}

// ── Rechazar deuda (deudor no está de acuerdo) ───────
export async function rechazarDeuda(deudaId: string): Promise<void> {
  await sbPatch<DeudaInterpersonal>('deudas_interpersonales', deudaId, {
    estado: 'pagado', // la descartamos del balance
    notas : 'Rechazada por el deudor',
  });
}

// ── Legacy: usado por PagarDeudas para cobros directos ─
/** @deprecated Usar declararPagoDeuda + confirmarPagoRecibido */
export async function registrarPagoDeuda(params: {
  deudaId: string;
  monto  : number;
  notas? : string;
}): Promise<void> {
  return declararPagoDeuda(params);
}

// ── Calcular parte proporcional ──────────────────────
export function calcularParteDeuda(
  montoTotal: number,
  division  : string,
  prop      : number
): number {
  return Math.round(partePorDiv(montoTotal, division, prop));
}
