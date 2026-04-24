// ── Usuarios ───────────────────────────────────────────
export interface Usuario {
  id          : string;
  username    : string;
  nombre      : string;
  password_hash: string | null;
  ingreso_fijo: number | null;
  ingreso_q1  : number | null;
  ingreso_q2  : number | null;
}

// ── Movimientos ────────────────────────────────────────
export type TipoMovimiento  = 'gasto' | 'deuda' | 'ahorro' | 'ingreso';
export type EstadoMovimiento = 'confirmado' | 'pendiente' | 'parcial' | 'rechazado' | 'pagado';
export type TipoDivision    = 'personal' | 'prop' | 'mitad' | 'novia';

export interface Movimiento {
  id                    : string;
  created_at            : string;
  fecha                 : string;
  tipo                  : TipoMovimiento;
  descripcion           : string;
  categoria             : string;
  medio_pago            : string;
  division              : TipoDivision;
  tipo_division         : TipoDivision;
  monto_total           : string;
  mi_parte              : string;
  parte_usuario         : string;
  parte_contraparte     : string;
  monto_pagado          : string;
  monto_inicial_pagado  : string;
  es_deuda              : boolean;
  es_ahorro             : boolean;
  en_cuotas             : boolean;
  cant_cuotas           : number | null;
  notas                 : string | null;
  user_id               : string;
  es_compartido         : boolean;
  es_deuda_interpersonal: boolean;
  acreedor_user_id      : string | null;
  estado                : EstadoMovimiento;
  confirmado_por        : string | null;
  importacion_id        : string | null;
  resumen_id            : string | null;
}

// ── Ingresos ───────────────────────────────────────────
export type TipoIngreso = 'sueldo' | 'quincena' | 'extra' | 'otro';

export interface Ingreso {
  id             : string;
  created_at     : string;
  user_id        : string;
  descripcion    : string;
  monto          : string;
  fecha_esperada : string | null;
  fecha_recibido : string | null;
  recibido       : boolean;
  tipo           : TipoIngreso;
  recurrente     : boolean;
  notas          : string | null;
}

// ── Servicios ──────────────────────────────────────────
export type EstadoServicio = 'pendiente' | 'pagado';

export interface Servicio {
  id               : string;
  created_at       : string;
  mes              : string;
  anio             : number;
  servicio         : string;
  monto_total      : string;
  mi_parte         : string;
  consumo          : string | null;
  quien_pago       : string;
  notas            : string | null;
  user_id          : string;
  estado           : EstadoServicio;
  fecha_vencimiento: string;
  es_compartido    : boolean;
  pagado_en        : string | null;
}

// ── Metas ──────────────────────────────────────────────
export interface Meta {
  id             : string;
  created_at     : string;
  user_id        : string;
  nombre         : string;
  emoji          : string | null;
  monto_objetivo : string;
  monto_actual   : string;
  fecha_objetivo : string | null;
  activa         : boolean;
  es_compartida  : boolean;
}

// ── Medios de pago ─────────────────────────────────────
export type TipoMedio = 'credito' | 'debito' | 'efectivo' | 'billetera';

export interface MedioPago {
  id          : string;
  created_at  : string;
  user_id     : string;
  nombre      : string;
  tipo        : TipoMedio | null;
  banco       : string | null;
  dia_cierre  : string | null;
  limite      : number | null;
  saldo_deuda : number | null;
  activo      : boolean;
  datos_extra : Record<string, string> | null;
}

// ── Resumenes de tarjeta ───────────────────────────────
export type EstadoResumen = 'pendiente' | 'parcial' | 'pagado';

export interface ResumenTarjeta {
  id                  : string;
  created_at          : string;
  user_id             : string;
  tarjeta             : string;
  periodo             : string;
  fecha_vencimiento   : string;
  monto_total         : string;
  monto_pagado        : string;
  estado              : EstadoResumen;
  notas               : string | null;
  es_vigente          : boolean;
  resumen_anterior_id : string | null;
  monto_arrastrado    : string;
}

// ── BBVA Import ────────────────────────────────────────
export interface BBVAConsumo {
  fecha              : string;
  descripcion        : string;
  monto_pesos        : number;
  monto_dolares      : number;
  es_cuota           : boolean;
  cuota_actual       : number;
  cuota_total        : number;
  categoria_sugerida : string;
  division_sugerida  : TipoDivision;
  es_ambiguo         : boolean;
}

export interface BBVAResumen {
  periodo           : string;
  saldo_total       : number;
  total_intereses   : number;
  fecha_vencimiento : string;
  consumos          : BBVAConsumo[];
}

export interface BBVAItem extends BBVAConsumo {
  idx            : number;
  divSeleccionada: TipoDivision;
  catSeleccionada: string;
  guardado       : boolean;
}

// ── Categorías ─────────────────────────────────────────
export const CATEGORIAS = [
  'Alquiler', 'Supermercado', 'Transporte', 'Servicios',
  'Internet/Cable', 'Expensas', 'Delivery', 'Salidas/Ocio',
  'Ropa y calzado', 'Tecnología', 'Gym', 'Salud',
  'Educación', 'Regalo', 'Suscripciones', 'Viajes', 'Otro',
] as const;

export type Categoria = typeof CATEGORIAS[number];

// ── Deudas interpersonales ─────────────────────────────
export type EstadoDeudaInterpersonal = 'pendiente' | 'parcial' | 'pagado';
export type OrigenDeuda = 'gasto' | 'resumen' | 'manual';

export interface DeudaInterpersonal {
  id            : string;
  created_at    : string;
  acreedor_id   : string;
  deudor_id     : string;
  descripcion   : string;
  monto_total   : string;
  monto_pagado  : string;
  estado        : EstadoDeudaInterpersonal;
  origen        : OrigenDeuda;
  resumen_id    : string | null;
  movimiento_id : string | null;
  notas         : string | null;
}

export interface PagoDeudaInterpersonal {
  id         : string;
  created_at : string;
  deuda_id   : string;
  monto      : string;
  fecha      : string;
  confirmado : boolean;
  notas      : string | null;
}

// ── Consumo de resumen (con soporte compartido) ────────
export interface ConsumoResumen {
  descripcion : string;
  monto       : string;
  categoria   : string;
  fecha       : string;
  compartido  : boolean;
  division    : 'mitad' | 'prop' | 'personal';
}

// ── Presupuestos ───────────────────────────────────────
export interface Presupuesto {
  id          : string;
  created_at  : string;
  user_id     : string;
  categoria   : string;
  monto_limite: string;
  activo      : boolean;
}
