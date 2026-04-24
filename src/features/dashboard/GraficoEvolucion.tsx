import { useEffect, useState, useCallback } from 'react';
import { sbGet }                            from '../../lib/supabase';
import { usarSesion }                       from '../../context/SesionContext';
import { fmt, num }                         from '../../lib/utils';
import type { Movimiento, Ingreso }         from '../../lib/types';
import styles from './GraficoEvolucion.module.css';

interface PuntoMes {
  label    : string;  // "Mar"
  mesISO   : string;  // "2025-03"
  gastado  : number;
  ingresado: number;
  ahorro   : number;
  disponible: number;
}

interface Props {
  modo: 'yo' | 'hogar';
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

function generarMeses(n = 6): { label: string; mesISO: string; desde: string; hasta: string }[] {
  const hoy = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (n - 1 - i), 1);
    const anio = d.getFullYear();
    const mes  = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleString('es-AR', { month: 'short' });
    const mesISO = `${anio}-${mes}`;
    const desde  = `${anio}-${mes}-01`;
    // último día del mes
    const hasta = new Date(anio, d.getMonth() + 1, 0).toISOString().split('T')[0];
    return { label, mesISO, desde, hasta };
  });
}

export function GraficoEvolucion({ modo }: Props) {
  const { usuario }                     = usarSesion();
  const [puntos,  setPuntos]            = useState<PuntoMes[]>([]);
  const [cargando,setCargando]          = useState(true);
  const [lineas,  setLineas]            = useState<LineaActiva[]>(['gastado', 'disponible']);
  const [tooltip, setTooltip]           = useState<{ mes: string; x: number; y: number } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const meses = generarMeses(6);
      const primero = meses[0].desde;

      const [movs, ingresos] = await Promise.all([
        sbGet<Movimiento>('movimientos', {
          user_id: `eq.${usuario.id}`,
          estado : 'eq.confirmado',
          fecha  : `gte.${primero}`,
        }, 0),
        sbGet<Ingreso>('ingresos', {
          user_id      : `eq.${usuario.id}`,
          recibido     : 'eq.true',
          fecha_recibido: `gte.${primero}`,
        }, 0),
      ]);

      const resultado: PuntoMes[] = meses.map(({ label, mesISO, desde, hasta }) => {
        const movsDelMes = movs.filter(m => m.fecha >= desde && m.fecha <= hasta);
        const ingDelMes  = ingresos.filter(i =>
          i.fecha_recibido && i.fecha_recibido >= desde && i.fecha_recibido <= hasta
        );

        const gastado  = movsDelMes
          .filter(m => m.tipo === 'gasto' && !m.es_ahorro)
          .reduce((a, m) => a + num(m.mi_parte), 0);

        const ahorro   = movsDelMes
          .filter(m => m.es_ahorro || m.tipo === 'ahorro')
          .reduce((a, m) => a + num(m.mi_parte), 0);

        const ingresado = ingDelMes.reduce((a, i) => a + num(i.monto), 0);
        const disponible = ingresado - gastado;

        return { label, mesISO, gastado, ingresado, ahorro, disponible };
      });

      setPuntos(resultado);
    } finally {
      setCargando(false);
    }
  }, [usuario.id, modo]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) {
    return <div className={styles.cargando}>Cargando evolución…</div>;
  }

  if (puntos.every(p => p.gastado === 0 && p.ingresado === 0)) {
    return <div className={styles.vacio}>Sin datos suficientes para mostrar la evolución.</div>;
  }

  // ── Cálculo del SVG ─────────────────────────────────
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

  const allVals = getAllVals();
  const maxVal  = Math.max(...allVals, 1);

  function xPos(i: number) { return PAD.left + (i / (n - 1)) * innerW; }
  function yPos(v: number) { return PAD.top + innerH - (Math.max(0, v) / maxVal) * innerH; }

  function toPath(vals: number[]): string {
    return vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`)
      .join(' ');
  }

  function toggleLinea(l: LineaActiva) {
    setLineas(prev =>
      prev.includes(l)
        ? prev.length > 1 ? prev.filter(x => x !== l) : prev
        : [...prev, l]
    );
  }

  // Mes actual stats (último punto)
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

      {/* SVG chart */}
      <div className={styles.svgWrap}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.svg}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map(f => (
            <line
              key={f}
              x1={PAD.left} y1={PAD.top + innerH * (1 - f)}
              x2={W - PAD.right} y2={PAD.top + innerH * (1 - f)}
              stroke="var(--bd)" strokeWidth={0.5}
            />
          ))}

          {/* Líneas de datos */}
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

          {/* Puntos interactivos */}
          {puntos.map((p, i) => (
            <g key={p.mesISO}>
              {/* Área invisible para hover */}
              <rect
                x={xPos(i) - 12} y={PAD.top}
                width={24} height={innerH}
                fill="transparent"
                onMouseEnter={_ => {
                  
                  setTooltip({ mes: p.label, x: i, y: 0 });
                }}
              />
              {lineas.includes('gastado') && (
                <circle cx={xPos(i)} cy={yPos(p.gastado)} r={2.5} fill="var(--rd)" />
              )}
              {lineas.includes('disponible') && (
                <circle cx={xPos(i)} cy={yPos(Math.max(0, p.disponible))} r={2.5} fill="var(--gn)" />
              )}
              {lineas.includes('ahorro') && (
                <circle cx={xPos(i)} cy={yPos(p.ahorro)} r={2.5} fill="var(--ac)" />
              )}
              {/* Línea vertical hover */}
              {tooltip?.x === i && (
                <line
                  x1={xPos(i)} y1={PAD.top}
                  x2={xPos(i)} y2={PAD.top + innerH}
                  stroke="var(--bd2)" strokeWidth={1} strokeDasharray="3 2"
                />
              )}
            </g>
          ))}

          {/* Labels eje X */}
          {puntos.map((p, i) => (
            <text key={p.mesISO + 'l'}
              x={xPos(i)} y={H - 4}
              textAnchor="middle" fontSize={8}
              fill={i === n - 1 ? 'var(--ac)' : 'var(--tx3)'}
              fontWeight={i === n - 1 ? 700 : 400}
            >
              {p.label}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
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

      {/* Resumen último mes */}
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
