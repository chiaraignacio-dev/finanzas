import { useState, useMemo }          from 'react';
import { fmt, num }                   from '../../lib/utils';
import type { Movimiento, Ingreso }   from '../../lib/types';
import styles                         from './GraficoEvolucion.module.css';

interface PuntoMes {
  label    : string;
  mesISO   : string;
  gastado  : number;
  ingresado: number;
  ahorro   : number;
  disponible: number;
}

/**
 * GraficoEvolucion — líneas de evolución de los últimos 6 meses.
 *
 * FUENTE DE DATOS: recibe movimientos e ingresos históricos ya cargados
 * desde Dashboard. No hace queries propias. Usa exactamente la misma
 * lógica de cálculo que las tarjetas del Dashboard:
 *
 * GASTADO (línea roja):
 *   movimientos donde:
 *   - estado = 'confirmado'
 *   - es_ahorro = false
 *   - (tipo = 'gasto' AND resumen_id IS NULL) OR tipo = 'deuda'
 *   Valor: mi_parte (modo 'yo') o monto_total (modo 'hogar')
 *
 * DISPONIBLE (línea verde):
 *   ingresos.recibido = true, agrupados por fecha_recibido
 *   menos Gastado del mismo mes
 *
 * AHORRADO (línea azul):
 *   movimientos donde es_ahorro = true OR tipo = 'ahorro'
 *   Valor: mi_parte
 */
interface Props {
  movimientos: Movimiento[];   // todos los movs del usuario desde hace 6 meses
  ingresos   : Ingreso[];      // todos los ingresos recibidos desde hace 6 meses
  modo       : 'yo' | 'hogar';
  meses      : { label: string; mesISO: string; desde: string; hasta: string }[];
}

type LineaActiva = 'gastado' | 'disponible' | 'ahorro';

const COLORES: Record<LineaActiva, string> = {
  gastado   : 'var(--rd)',
  disponible: 'var(--gn)',
  ahorro    : 'var(--ac)',
};
const LABELS: Record<LineaActiva, string> = {
  gastado   : 'Gastado',
  disponible: 'Disponible',
  ahorro    : 'Ahorrado',
};

export function GraficoEvolucion({ movimientos, ingresos, modo, meses }: Props) {
  const [lineas,  setLineas]  = useState<LineaActiva[]>(['gastado', 'disponible']);
  const [tooltip, setTooltip] = useState<{ x: number } | null>(null);

  const puntos: PuntoMes[] = useMemo(() => {
    return meses.map(({ label, mesISO, desde, hasta }) => {
      const movsDelMes = movimientos.filter(m => m.fecha >= desde && m.fecha <= hasta);
      const ingDelMes  = ingresos.filter(i =>
        i.fecha_recibido && i.fecha_recibido >= desde && i.fecha_recibido <= hasta
      );

      // Gastado — misma lógica que Dashboard
      const gastado = movsDelMes
        .filter(m =>
          m.estado === 'confirmado' &&
          !m.es_ahorro && (
            (m.tipo === 'gasto' && !m.resumen_id) ||
            m.tipo === 'deuda'
          )
        )
        .reduce((a, m) => {
          if (modo === 'hogar') return a + num(m.monto_total);
          return a + num(m.mi_parte);
        }, 0);

      // Ahorro — misma lógica que Dashboard
      const ahorro = movsDelMes
        .filter(m => m.es_ahorro || m.tipo === 'ahorro')
        .reduce((a, m) => a + num(m.mi_parte), 0);

      // Ingresado — misma lógica que Dashboard (por fecha_recibido)
      const ingresado = ingDelMes.reduce((a, i) => a + num(i.monto), 0);

      // Disponible = ingresado - gastado
      const disponible = ingresado - gastado;

      return { label, mesISO, gastado, ingresado, ahorro, disponible };
    });
  }, [movimientos, ingresos, modo, meses]);

  const sinDatos = puntos.every(p => p.gastado === 0 && p.ingresado === 0);
  if (sinDatos) return <div className={styles.vacio}>Sin datos suficientes para mostrar la evolución.</div>;

  const W = 300; const H = 120; const PAD = { top: 10, right: 8, bottom: 20, left: 8 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;
  const n      = puntos.length;

  const getAllVals = () => {
    const vals: number[] = [];
    puntos.forEach(p => {
      if (lineas.includes('gastado'))    vals.push(p.gastado);
      if (lineas.includes('disponible')) vals.push(Math.max(0, p.disponible));
      if (lineas.includes('ahorro'))     vals.push(p.ahorro);
    });
    return vals;
  };

  const maxVal = Math.max(...getAllVals(), 1);
  function xPos(i: number) { return PAD.left + (i / (n - 1)) * innerW; }
  function yPos(v: number) { return PAD.top + innerH - (Math.max(0, v) / maxVal) * innerH; }
  function toPath(vals: number[]): string {
    return vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`).join(' ');
  }
  function toggleLinea(l: LineaActiva) {
    setLineas(prev => prev.includes(l)
      ? prev.length > 1 ? prev.filter(x => x !== l) : prev
      : [...prev, l]
    );
  }

  const ultimo = puntos[puntos.length - 1];

  return (
    <div className={styles.wrap}>
      <div className={styles.tituloRow}>
        <span className={styles.titulo}>Evolución mensual</span>
        <div className={styles.leyenda}>
          {(['gastado', 'disponible', 'ahorro'] as LineaActiva[]).map(l => (
            <button
              key={l}
              className={`${styles.leyBtn} ${lineas.includes(l) ? styles.leyActivo : ''}`}
              style={lineas.includes(l) ? { borderColor: COLORES[l], color: COLORES[l] } : {}}
              onClick={() => toggleLinea(l)}
            >
              {LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.svgWrap}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} onMouseLeave={() => setTooltip(null)}>
          {[0.25, 0.5, 0.75, 1].map(f => (
            <line key={f}
              x1={PAD.left} y1={PAD.top + innerH * (1 - f)}
              x2={W - PAD.right} y2={PAD.top + innerH * (1 - f)}
              stroke="var(--bd)" strokeWidth={0.5}
            />
          ))}
          {lineas.includes('gastado') && (
            <path d={toPath(puntos.map(p => p.gastado))}
              fill="none" stroke="var(--rd)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {lineas.includes('disponible') && (
            <path d={toPath(puntos.map(p => Math.max(0, p.disponible)))}
              fill="none" stroke="var(--gn)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {lineas.includes('ahorro') && (
            <path d={toPath(puntos.map(p => p.ahorro))}
              fill="none" stroke="var(--ac)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {puntos.map((p, i) => (
            <g key={p.mesISO}>
              <rect x={xPos(i) - 12} y={PAD.top} width={24} height={innerH}
                fill="transparent" onMouseEnter={() => setTooltip({ x: i })} />
              {lineas.includes('gastado') && <circle cx={xPos(i)} cy={yPos(p.gastado)} r={2.5} fill="var(--rd)" />}
              {lineas.includes('disponible') && <circle cx={xPos(i)} cy={yPos(Math.max(0, p.disponible))} r={2.5} fill="var(--gn)" />}
              {lineas.includes('ahorro') && <circle cx={xPos(i)} cy={yPos(p.ahorro)} r={2.5} fill="var(--ac)" />}
              {tooltip?.x === i && (
                <line x1={xPos(i)} y1={PAD.top} x2={xPos(i)} y2={PAD.top + innerH}
                  stroke="var(--bd2)" strokeWidth={1} strokeDasharray="3 2" />
              )}
            </g>
          ))}
          {puntos.map((p, i) => (
            <text key={p.mesISO + 'l'}
              x={xPos(i)} y={H - 4} textAnchor="middle" fontSize={8}
              fill={i === n - 1 ? 'var(--ac)' : 'var(--tx3)'}
              fontWeight={i === n - 1 ? 700 : 400}
            >
              {p.label}
            </text>
          ))}
        </svg>

        {tooltip && (() => {
          const p = puntos[tooltip.x];
          return (
            <div className={styles.tooltip} style={{ left: `${(tooltip.x / (n - 1)) * 100}%` }}>
              <div className={styles.tooltipMes}>{p.label}</div>
              {lineas.includes('gastado')    && <div className={styles.tooltipRow} style={{ color: 'var(--rd)' }}>Gastado: {fmt(p.gastado)}</div>}
              {lineas.includes('disponible') && <div className={styles.tooltipRow} style={{ color: 'var(--gn)' }}>Disponible: {fmt(p.disponible)}</div>}
              {lineas.includes('ahorro')     && <div className={styles.tooltipRow} style={{ color: 'var(--ac)' }}>Ahorro: {fmt(p.ahorro)}</div>}
            </div>
          );
        })()}
      </div>

      <div className={styles.resumen}>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Este mes gastado</span>
          <span className={styles.resumenVal} style={{ color: 'var(--rd)' }}>{fmt(ultimo.gastado)}</span>
        </div>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Disponible</span>
          <span className={styles.resumenVal} style={{ color: ultimo.disponible >= 0 ? 'var(--gn)' : 'var(--rd)' }}>
            {fmt(ultimo.disponible)}
          </span>
        </div>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Ahorrado</span>
          <span className={styles.resumenVal} style={{ color: 'var(--ac)' }}>{fmt(ultimo.ahorro)}</span>
        </div>
      </div>
    </div>
  );
}
