import { useMemo }         from 'react';
import { useState }        from 'react';
import { fmt, num }        from '../../lib/utils';
import type { Movimiento } from '../../lib/types';
import styles              from './GraficoTorta.module.css';

interface CategoriaData {
  categoria: string;
  total    : number;
  pct      : number;
}

/**
 * GraficoTorta — donut SVG interactivo por categoría.
 *
 * FUENTE DE DATOS: recibe los movimientos ya filtrados desde Dashboard.
 * No hace queries propias. Los datos son exactamente los mismos que
 * componen el número "Gastado" de las tarjetas del Dashboard:
 *
 *   - tipo = 'gasto'
 *   - estado = 'confirmado'
 *   - es_ahorro = false
 *   - resumen_id IS NULL  (excluye consumos de tarjeta — solo el pago cuenta)
 *
 * En modo 'yo'    → suma mi_parte de cada movimiento
 * En modo 'hogar' → suma monto_total de cada movimiento
 */
interface Props {
  movimientos: Movimiento[];
  modo       : 'yo' | 'hogar';
}

const COLORES = [
  '#2a9d5c', '#dc3545', '#d97706', '#7c3aed', '#0891b2',
  '#be185d', '#059669', '#b45309', '#4f46e5', '#0f766e',
  '#9333ea', '#c2410c',
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const gap   = 1.5;
  const s     = polarToCartesian(cx, cy, r, startAngle + gap / 2);
  const e     = polarToCartesian(cx, cy, r, endAngle   - gap / 2);
  const large = endAngle - startAngle - gap > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

export function GraficoTorta({ movimientos, modo }: Props) {
  const [activo, setActivo] = useState<string | null>(null);

  const { datos, total } = useMemo(() => {
    const mapa: Record<string, number> = {};
    movimientos.forEach(m => {
      const cat = m.categoria || 'Sin categoría';
      const val = modo === 'hogar' ? num(m.monto_total) : num(m.mi_parte);
      mapa[cat] = (mapa[cat] || 0) + val;
    });
    const totalCalc = Object.values(mapa).reduce((a, v) => a + v, 0);
    const ordenado: CategoriaData[] = Object.entries(mapa)
      .map(([categoria, t]) => ({
        categoria,
        total: t,
        pct  : totalCalc > 0 ? (t / totalCalc) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
    return { datos: ordenado, total: totalCalc };
  }, [movimientos, modo]);

  if (datos.length === 0) {
    return <div className={styles.vacio}>Sin gastos confirmados este mes.</div>;
  }

  const CX = 80; const CY = 80; const R = 68; const R_INNER = 38;
  let anguloActual = 0;
  const slices = datos.map((d, i) => {
    const angulo = (d.pct / 100) * 360;
    const slice  = { ...d, startAngle: anguloActual, endAngle: anguloActual + angulo, color: COLORES[i % COLORES.length] };
    anguloActual += angulo;
    return slice;
  });

  const activoData = activo ? datos.find(d => d.categoria === activo) : datos[0];

  return (
    <div className={styles.wrap}>
      <div className={styles.titulo}>Gasto por categoría</div>
      <div className={styles.contenido}>
        <div className={styles.tortaWrap}>
          <svg viewBox="0 0 160 160" className={styles.svg}>
            {slices.map((s, i) => (
              <path
                key={i}
                d={arcPath(CX, CY, R, s.startAngle, s.endAngle)}
                fill={s.color}
                opacity={activo && activo !== s.categoria ? 0.3 : 1}
                className={styles.slice}
                onMouseEnter={() => setActivo(s.categoria)}
                onMouseLeave={() => setActivo(null)}
                onClick    ={() => setActivo(prev => prev === s.categoria ? null : s.categoria)}
              />
            ))}
            <circle cx={CX} cy={CY} r={R_INNER} fill="var(--sf)" />
            <text x={CX} y={CY - 8} textAnchor="middle" fontSize={9} fill="var(--tx3)" fontFamily="var(--font-sans)">
              {activoData ? activoData.pct.toFixed(1) + '%' : ''}
            </text>
            <text x={CX} y={CY + 6} textAnchor="middle" fontSize={7} fill="var(--tx3)" fontFamily="var(--font-sans)">
              {activoData ? fmt(activoData.total) : ''}
            </text>
          </svg>
        </div>
        <div className={styles.leyenda}>
          {slices.map((s, i) => (
            <div
              key={i}
              className={`${styles.leyItem} ${activo === s.categoria ? styles.leyActivo : ''}`}
              onMouseEnter={() => setActivo(s.categoria)}
              onMouseLeave={() => setActivo(null)}
              onClick    ={() => setActivo(prev => prev === s.categoria ? null : s.categoria)}
            >
              <span className={styles.leyCuadro} style={{ background: s.color }} />
              <span className={styles.leyCat}>{s.categoria}</span>
              <span className={styles.leyPct}>{s.pct.toFixed(0)}%</span>
              <span className={styles.leyMonto}>{fmt(s.total)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>Total gastado</span>
        <span className={styles.totalMonto}>{fmt(total)}</span>
      </div>
    </div>
  );
}
