// ── Formato de moneda ──────────────────────────────────
export function fmt(n: number | string | null | undefined): string {
  return '$' + Math.round(num(n)).toLocaleString('es-AR');
}

export function fmtK(n: number | string | null | undefined): string {
  const v = Math.round(num(n));
  if (v >= 1_000_000) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1_000)     return '$' + Math.round(v / 1000) + 'k';
  return '$' + v;
}

// ── Conversión numérica segura (reemplaza los 53 parseFloat dispersos) ──
export function num(v: number | string | null | undefined): number {
  return parseFloat(String(v ?? 0)) || 0;
}

// ── Fechas — funciones, no constantes, para evitar stale values ──────
export const obtenerHoy      = (): Date   => new Date();
export const obtenerFechaISO = (): string => new Date().toISOString().split('T')[0];
export const obtenerFechaLab = (): string =>
  new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
export const obtenerDesdeMes = (): string => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
};

// ── Compatibilidad — se eliminan una vez que el código esté migrado ──
/** @deprecated Usar obtenerFechaISO() */
export const FISO      = obtenerFechaISO();
/** @deprecated Usar obtenerFechaLab() */
export const FLAB      = obtenerFechaLab();
/** @deprecated Usar obtenerDesdeMes() */
export const DESDE_MES = obtenerDesdeMes();

// ── Hash simple (no criptográfico) ─────────────────────
export function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return h.toString(16);
}

// ── Proporciones hogar ─────────────────────────────────
export function calcularProporcion(yo: {
  ingreso_fijo: number | null;
  ingreso_q1  : number | null;
  ingreso_q2  : number | null;
}, pareja: {
  ingreso_fijo: number | null;
  ingreso_q1  : number | null;
  ingreso_q2  : number | null;
}): number {
  const miIngreso     = num(yo.ingreso_fijo)     || (num(yo.ingreso_q1)     + num(yo.ingreso_q2));
  const ingresoPareja = num(pareja.ingreso_fijo) || (num(pareja.ingreso_q1) + num(pareja.ingreso_q2));
  const total         = miIngreso + ingresoPareja;
  return total ? miIngreso / total : 0.5;
}

/** @deprecated Usar calcularProporcion(yo, pareja) */
export function getProp(
  ingreso_fijo_yo: number, ingreso_q1_yo: number, ingreso_q2_yo: number,
  ingreso_fijo_pareja: number, ingreso_q1_pareja: number, ingreso_q2_pareja: number,
): number {
  const mi     = ingreso_fijo_yo     || (ingreso_q1_yo     + ingreso_q2_yo);
  const pareja = ingreso_fijo_pareja || (ingreso_q1_pareja + ingreso_q2_pareja);
  const tot    = mi + pareja;
  return tot ? mi / tot : 0.5;
}

export function partePorDiv(monto: number, div: string, prop: number): number {
  if (div === 'personal' || div === 'novia') return monto;
  if (div === 'prop')  return monto * prop;
  if (div === 'mitad') return monto * 0.5;
  return monto;
}
