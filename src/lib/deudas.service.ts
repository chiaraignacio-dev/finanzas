// ── Servicio centralizado para deudas interpersonales ──
// Toda la lógica de crear/pagar deudas entre personas pasa por aquí

import { sbGet, sbPost, sbPatch } from './supabase';
import { FISO, partePorDiv } from './utils';
import type { DeudaInterpersonal, PagoDeudaInterpersonal } from './types';

// ── Crear deuda interpersonal ────────────────────────
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
    estado       : 'pendiente',
    origen       : params.origen,
    resumen_id   : params.resumenId   ?? null,
    movimiento_id: params.movimientoId ?? null,
    notas        : params.notas        ?? null,
  });
}

// ── Registrar pago de deuda interpersonal ────────────
export async function registrarPagoDeuda(params: {
  deudaId  : string;
  monto    : number;
  notas?   : string;
}): Promise<void> {
  // 1. Leer la deuda actual
  const deudas = await sbGet<DeudaInterpersonal>('deudas_interpersonales', {
    id: `eq.${params.deudaId}`,
  });
  if (!deudas.length) throw new Error('Deuda no encontrada');

  const deuda         = deudas[0];
  const saldo         = parseFloat(deuda.monto_total) - parseFloat(deuda.monto_pagado);
  const montoEfectivo = Math.min(params.monto, saldo);
  const nuevoMontoPag = parseFloat(deuda.monto_pagado) + montoEfectivo;
  const nuevoSaldo    = parseFloat(deuda.monto_total) - nuevoMontoPag;
  const nuevoEstado   = nuevoSaldo <= 0 ? 'pagado' : 'parcial';

  // 2. Registrar el pago (pendiente de confirmación del acreedor)
  await sbPost<PagoDeudaInterpersonal>('pagos_deuda_interpersonal', {
    deuda_id  : params.deudaId,
    monto     : montoEfectivo,
    fecha     : FISO,
    confirmado: false,
    notas     : params.notas ?? null,
  });

  // 3. Actualizar la deuda
  await sbPatch<DeudaInterpersonal>('deudas_interpersonales', params.deudaId, {
    monto_pagado: nuevoMontoPag,
    estado      : nuevoEstado,
  });
}

// ── Confirmar pago (desde el acreedor) ───────────────
export async function confirmarPagoDeuda(params: {
  pagoId      : string;
  deudaId     : string;
  acreedorId  : string;
}): Promise<void> {
  await sbPatch<PagoDeudaInterpersonal>('pagos_deuda_interpersonal', params.pagoId, {
    confirmado: true,
  });
  // Registrar ingreso del acreedor (impacta en disponible)
  const pagos = await sbGet<PagoDeudaInterpersonal>('pagos_deuda_interpersonal', {
    id: `eq.${params.pagoId}`,
  });
  if (!pagos.length) return;
  await sbPost('ingresos', {
    user_id        : params.acreedorId,
    descripcion    : 'Cobro deuda interpersonal',
    monto          : parseFloat(pagos[0].monto),
    tipo           : 'extra',
    fecha_esperada : FISO,
    fecha_recibido : FISO,
    recibido       : true,
    recurrente     : false,
  });
}

// ── Calcular parte proporcional ──────────────────────
export function calcularParteDeuda(
  montoTotal: number,
  division  : string,
  prop      : number
): number {
  return Math.round(partePorDiv(montoTotal, division, prop));
}
