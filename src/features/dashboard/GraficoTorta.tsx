import { useEffect, useState, useCallback } from 'react';
import { sbGet }                            from '../../lib/supabase';
import { usarSesion }                       from '../../context/SesionContext';
import { fmt, obtenerDesdeMes, num }        from '../../lib/utils';
import type { Movimiento }                  from '../../lib/types';
import styles                               from './GraficoTorta.module.css';

interface CategoriaData {
  categoria: string;
  total    : number;
  pct      : number;
}

interface Props {
  modo: 'yo' | 'hogar';
}

// Paleta coherente con el design system (verdes, rojos, ambar, azules, morados)
const COLORES = [
  '#2a9d5c', // --gn  verde principal
  '#dc3545', // --rd  rojo
  '#d97706', // --am  ambar
  '#7c3aed', // --pu  morado
  '#0891b2', // cyan
  '#be185d', // rosa
  '#059669', // esmeralda
  '#b45309', // naranja oscuro
  '#4f46e5', // índigo
  '#0f766e', // teal
  '#9333ea', // violeta
  '#c2410c', // naranja tostado
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const gap    = 1.5; // grados de separación entre slices
  const s      = polarToCartesian(cx, cy, r, startAngle + gap / 2);
  const e      = polarToCartesian(cx, cy, r, endAngle   - gap / 2);
  const large  = endAngle - startAngle - gap > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

export function GraficoTorta({ modo }: Props) {
  const { usuario }                   = usarSesion();
  const [datos,    setDatos]          = useState<CategoriaData[]>([]);
  const [total,    setTotal]          = useState(0);
  const [cargando, setCargando]       = useState(true);
  const [activo,   setActivo]         = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const desdeMes = obtenerDesdeMes();

      const movs = await sbGet<Movimiento>('movimientos', {
        user_id: `eq.${usuario.id}`,
        tipo   : 'eq.gasto',
        estado : 'eq.confirmado',
        fecha  : `gte.${desdeMes}`,
      }, 0);

      // Misma lógica que Dashboard: excluir resumen_id y es_ahorro
      const filtrados = movs.filter(m => !m.es_ahorro && !m.resumen_id);

      // Si no hay datos este mes, intentar con el mes anterior
      const fuente = filtrados.length > 0 ? filtrados : await (async () => {
        const hoy      = new Date();
        const mesAnt   = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const desdeAnt = mesAnt.toISOString().split('T')[0];
        const hastaAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0).toISOString().split('T')[0];
        const ant      = await sbGet<Movimiento>('movimientos', {
          user_id: `eq.${usuario.id}`,
          tipo   : 'eq.gasto',
          estado : 'eq.confirmado',
          fecha  : `gte.${desdeAnt}`,
        }, 0);
        return ant.filter(m => !m.es_ahorro && !m.resumen_id && m.fecha <= hastaAnt);
      })();

      // Agrupar por categoría
      const mapa: Record<string, number> = {};
      fuente.forEach(m => {
        const cat = m.categoria || 'Sin categoría';
        mapa[cat]  = (mapa[cat] || 0) + (modo === 'hogar' ? num(m.monto_total) : num(m.mi_parte));
      });

      const totalCalc = Object.values(mapa).reduce((a, v) => a + v, 0);

      const ordenado: CategoriaData[] = Object.entries(mapa)
        .map(([categoria, t]) => ({ categoria, total: t, pct: totalCalc > 0 ? (t / totalCalc) * 100 : 0 }))
        .sort((a, b) => b.total - a.total);

      setDatos(ordenado);
      setTotal(totalCalc);
    } finally {
      setCargando(false);
    }
  }, [usuario.id, modo]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return <div className={styles.cargando}>Cargando…</div>;
  if (datos.length === 0) return <div className={styles.vacio}>Sin gastos registrados para mostrar.</div>;

  // SVG torta
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
        {/* SVG torta con donut */}
        <div className={styles.tortaWrap}>
          <svg viewBox="0 0 160 160" className={styles.svg}>
            {slices.map((s, i) => (
              <path
                key={i}
                d={arcPath(CX, CY, R, s.startAngle, s.endAngle)}
                fill={s.color}
                opacity={activo && activo !== s.categoria ? 0.3 : 1}
                className={styles.slice}
                onMouseEnter={() => { setActivo(s.categoria);}}
                onMouseLeave={() => { setActivo(null);}}
                onClick    ={() => setActivo(prev => prev === s.categoria ? null : s.categoria)}
              />
            ))}
            {/* Hueco central */}
            <circle cx={CX} cy={CY} r={R_INNER} fill="var(--sf)" />
            {/* Texto central */}
            <text x={CX} y={CY - 8} textAnchor="middle" fontSize={9} fill="var(--tx3)" fontFamily="var(--font-sans)">
              {activoData ? activoData.pct.toFixed(1) + '%' : ''}
            </text>
            <text x={CX} y={CY + 6} textAnchor="middle" fontSize={7} fill="var(--tx3)" fontFamily="var(--font-sans)">
              {activoData ? fmt(activoData.total) : ''}
            </text>
          </svg>
        </div>

        {/* Leyenda */}
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

      {/* Total */}
      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>Total gastado</span>
        <span className={styles.totalMonto}>{fmt(total)}</span>
      </div>
    </div>
  );
}
