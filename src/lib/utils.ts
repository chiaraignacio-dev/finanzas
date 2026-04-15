// ── Formato de moneda ──────────────────────────────────
export function fmt(n: number | string | null | undefined): string {
  return '$' + Math.round(parseFloat(String(n || 0))).toLocaleString('es-AR');
}

export function fmtK(n: number | string | null | undefined): string {
  const v = Math.round(parseFloat(String(n || 0)));
  if (v >= 1_000_000) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1_000)     return '$' + Math.round(v / 1000) + 'k';
  return '$' + v;
}

// ── Fechas ─────────────────────────────────────────────
export const HOY        = new Date();
export const FISO       = HOY.toISOString().split('T')[0];
export const FLAB       = HOY.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
export const DESDE_MES  = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, '0')}-01`;

// ── Hash simple (no criptográfico) ────────────────────
export function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return h.toString(16);
}

// ── Proporciones hogar ────────────────────────────────
export function getProp(
  ingreso_fijo_yo: number,
  ingreso_q1_yo: number,
  ingreso_q2_yo: number,
  ingreso_fijo_pareja: number,
  ingreso_q1_pareja: number,
  ingreso_q2_pareja: number
): number {
  const mi    = ingreso_fijo_yo    || (ingreso_q1_yo    + ingreso_q2_yo);
  const pareja = ingreso_fijo_pareja || (ingreso_q1_pareja + ingreso_q2_pareja);
  const tot   = mi + pareja;
  if (!tot) return 0.5;
  return mi / tot;
}

export function partePorDiv(
  monto: number,
  div: string,
  prop: number
): number {
  if (div === 'personal' || div === 'novia') return monto;
  if (div === 'prop')  return monto * prop;
  if (div === 'mitad') return monto * 0.5;
  return monto;
}
