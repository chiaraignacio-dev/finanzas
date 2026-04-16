import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { sbGet } from '../../lib/supabase';
import { fmt, fmtK, FLAB, DESDE_MES } from '../../lib/utils';
import type { Usuario, Movimiento, Servicio, Meta, ResumenTarjeta } from '../../lib/types';
import styles from './Dashboard.module.css';

interface Props {
  user    : Usuario;
  allUsers: Record<string, Usuario>;
}

export function Dashboard({ user, allUsers }: Props) {
  const [mode,    setMode]    = useState<'yo' | 'hogar'>('yo');
  const [ing,     setIng]     = useState(0);
  const [gas,     setGas]     = useState(0);
  const [falta,   setFalta]   = useState(0);
  const [metas,   setMetas]   = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const uData = allUsers[user.username];
      const abril = Object.values(allUsers).find(u => u.username !== user.username);
      const myIng    = (uData?.ingreso_fijo || 0) || ((uData?.ingreso_q1 || 0) + (uData?.ingreso_q2 || 0));
      const abrilIng = (abril?.ingreso_fijo || 0) || ((abril?.ingreso_q1 || 0) + (abril?.ingreso_q2 || 0));

      let rows: Movimiento[], ingTotal: number;

      if (mode === 'yo') {
        const [mios, comp] = await Promise.all([
          sbGet<Movimiento>('movimientos', { user_id: `eq.${user.id}`, estado: 'eq.confirmado', fecha: `gte.${DESDE_MES}` }),
          sbGet<Movimiento>('movimientos', { es_compartido: 'eq.true', estado: 'eq.confirmado', user_id: `neq.${user.id}`, fecha: `gte.${DESDE_MES}` }),
        ]);
        rows = [...mios, ...comp];
        ingTotal = myIng;
      } else {
        const all = await sbGet<Movimiento>('movimientos', { estado: 'eq.confirmado', fecha: `gte.${DESDE_MES}` });
        const seen = new Set<string>();
        rows = all.filter(r => { if (r.es_compartido) { if (seen.has(r.id)) return false; seen.add(r.id); } return true; });
        ingTotal = myIng + abrilIng;
      }

      // Gastado = movimientos pagados/confirmados (NO incluye deudas pendientes)
      const gasTotal = rows
        .filter(r => r.tipo === 'gasto' && !r.es_ahorro)
        .reduce((acc, r) => {
          const esMio = String(r.user_id) === String(user.id);
          const v = mode === 'yo' && r.es_compartido && !esMio
            ? parseFloat(r.parte_contraparte || r.mi_parte)
            : parseFloat(r.mi_parte);
          return acc + (v || 0);
        }, 0);

      // Pagos de deuda ya realizados (también descuentan del disponible)
      const pagosDeuda = rows
        .filter(r => r.tipo === 'deuda')
        .reduce((acc, r) => acc + parseFloat(r.mi_parte), 0);

      // Falta pagar = servicios pendientes + saldo de resumenes tarjeta (informativo)
      const [srv, resumenes] = await Promise.all([
        sbGet<Servicio>('servicios', { user_id: `eq.${user.id}`, estado: 'eq.pendiente' }),
        sbGet<ResumenTarjeta>('resumenes_tarjeta', { user_id: `eq.${user.id}`, estado: 'neq.pagado' }),
      ]);

      const hoy    = new Date().toISOString().split('T')[0];
      const mesMes = DESDE_MES.substring(0, 7);
      const srvPendiente = srv
        .filter(s => s.fecha_vencimiento.substring(0, 7) === mesMes || s.fecha_vencimiento <= hoy)
        .reduce((a, s) => a + parseFloat(s.mi_parte || '0'), 0);

      const deudaTarjeta = resumenes.reduce((a, r) =>
        a + parseFloat(r.monto_total) - parseFloat(r.monto_pagado), 0);

      const faltaTotal = srvPendiente + deudaTarjeta;

      // Disponible = Ingreso - Gastado - Pagos de deuda ya realizados
      // Falta pagar es informativo, NO resta del disponible hasta que se pague
      const m = await sbGet<Meta>('metas', { user_id: `eq.${user.id}`, activa: 'eq.true' });

      setIng(ingTotal);
      setGas(gasTotal + pagosDeuda);
      setFalta(faltaTotal);
      setMetas(m);
    } finally {
      setLoading(false);
    }
  }, [mode, user, allUsers]);

  useEffect(() => { load(); }, [load]);

  const dis = ing - gas;
  const pct = ing ? gas / ing : 0;
  const sem = pct < 0.65 ? { icon: '🟢', title: 'Finanzas saludables',  sub: `Gastás el ${(pct*100).toFixed(0)}% del ingreso.` }
            : pct < 0.85 ? { icon: '🟡', title: 'Atención',             sub: `Gastás el ${(pct*100).toFixed(0)}%. Reducí gastos variables.` }
            :               { icon: '🔴', title: 'Situación crítica',    sub: `Gastás el ${(pct*100).toFixed(0)}%. Hay que ajustar urgente.` };

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={FLAB} />

      <div className={styles.toggle}>
        <button className={`${styles.tb} ${mode === 'yo'    ? styles.active : ''}`} onClick={() => setMode('yo')}>👤 Yo</button>
        <button className={`${styles.tb} ${mode === 'hogar' ? styles.active : ''}`} onClick={() => setMode('hogar')}>🏠 Hogar</button>
      </div>

      <div className={styles.grid}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Ingreso</div>
          <div className={`${styles.statVal} ${styles.blue}`}>{loading ? '…' : fmtK(ing)}</div>
          <div className={styles.statSub}>{mode === 'yo' ? 'mi ingreso mensual' : 'ingreso hogar total'}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Gastado</div>
          <div className={`${styles.statVal} ${styles.red}`}>{loading ? '…' : fmtK(gas)}</div>
          <div className={styles.statSub}>{ing ? `${(pct*100).toFixed(0)}% del ingreso` : '—'}</div>
        </div>
        <div className={styles.stat} style={{ gridColumn: '1 / -1' }}>
          <div className={styles.statLabel}>Disponible</div>
          <div className={`${styles.statVal} ${dis >= 0 ? styles.green : styles.red}`} style={{ fontSize: 22 }}>
            {loading ? '…' : fmtK(dis)}
          </div>
          <div className={styles.statSub}>ingreso − gastado</div>
        </div>
      </div>

      {/* Falta pagar — solo informativo */}
      {!loading && falta > 0 && (
        <div className={styles.faltaBanner}>
          <div>
            <div className={styles.faltaLabel}>⚠️ Falta pagar (informativo)</div>
            <div className={styles.faltaSub}>No resta del disponible hasta que pagues</div>
          </div>
          <div className={styles.faltaAmt}>{fmtK(falta)}</div>
        </div>
      )}

      {/* Metas */}
      <div className={styles.slab}>Metas de ahorro</div>
      <Card style={{ margin: '0 16px 12px', padding: '12px 16px' }}>
        {metas.length === 0 && <div className={styles.empty}>Sin metas. Creá una en Config.</div>}
        {metas.map(m => {
          const p = parseFloat(m.monto_objetivo)
            ? Math.min(100, (parseFloat(m.monto_actual) / parseFloat(m.monto_objetivo)) * 100)
            : 0;
          return (
            <div key={m.id} className={styles.meta}>
              <div className={styles.metaTop}>
                <div className={styles.metaName}>{m.emoji || '🎯'} {m.nombre}</div>
                <div className={styles.metaAmts}>
                  <span style={{ color: 'var(--gn)' }}>{fmt(parseFloat(m.monto_actual))}</span>
                  <span style={{ color: 'var(--tx3)', fontSize: 11 }}>/ {fmt(parseFloat(m.monto_objetivo))}</span>
                </div>
              </div>
              <div className={styles.bar}><div className={styles.barFill} style={{ width: `${p.toFixed(0)}%` }} /></div>
              <div className={styles.barPct}>{p.toFixed(1)}%</div>
            </div>
          );
        })}
      </Card>

      {/* Semáforo */}
      <div className={styles.slab}>Semáforo</div>
      <Card style={{ margin: '0 16px 12px' }}>
        <div style={{ fontSize: 26, marginBottom: 8 }}>{loading ? '⏳' : sem.icon}</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{loading ? 'Cargando…' : sem.title}</div>
        <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 4 }}>{loading ? '' : sem.sub}</div>
      </Card>
      <div style={{ height: 16 }} />
    </div>
  );
}
