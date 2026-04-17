import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { IngresosPendientes } from '../ingresos/IngresosPendientes';
import { sbGet } from '../../lib/supabase';
import { fmt, fmtK, FLAB, DESDE_MES } from '../../lib/utils';
import type { Usuario, Movimiento, Servicio, Meta, ResumenTarjeta, Ingreso } from '../../lib/types';
import styles from './Dashboard.module.css';

interface Props {
  user    : Usuario;
  allUsers: Record<string, Usuario>;
}

export function Dashboard({ user, allUsers }: Props) {
  const [mode,      setMode]      = useState<'yo' | 'hogar'>('yo');
  const [gas,       setGas]       = useState(0);
  const [falta,     setFalta]     = useState(0);
  const [dis,       setDis]       = useState(0);
  const [metas,     setMetas]     = useState<Meta[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let ingTotal = 0;
      let rows: Movimiento[] = [];

      if (mode === 'yo') {
        const ingresosRecibidos = await sbGet<Ingreso>('ingresos', {
          user_id       : `eq.${user.id}`,
          recibido      : 'eq.true',
          fecha_recibido: `gte.${DESDE_MES}`,
        });
        ingTotal = ingresosRecibidos.reduce((a, i) => a + parseFloat(i.monto), 0);

        const [mios, comp] = await Promise.all([
          sbGet<Movimiento>('movimientos', { user_id: `eq.${user.id}`, estado: 'eq.confirmado', fecha: `gte.${DESDE_MES}` }),
          sbGet<Movimiento>('movimientos', { es_compartido: 'eq.true', estado: 'eq.confirmado', user_id: `neq.${user.id}`, fecha: `gte.${DESDE_MES}` }),
        ]);
        rows = [...mios, ...comp];

      } else {
        const todosIngresos = await sbGet<Ingreso>('ingresos', {
          recibido      : 'eq.true',
          fecha_recibido: `gte.${DESDE_MES}`,
        });
        ingTotal = todosIngresos.reduce((a, i) => a + parseFloat(i.monto), 0);

        const all = await sbGet<Movimiento>('movimientos', { estado: 'eq.confirmado', fecha: `gte.${DESDE_MES}` });
        const seen = new Set<string>();
        rows = all.filter(r => {
          if (r.es_compartido) { if (seen.has(r.id)) return false; seen.add(r.id); }
          return true;
        });
      }

      // Gastado
      const gasTotal = rows
        .filter(r => r.tipo === 'gasto' && !r.es_ahorro)
        .reduce((acc, r) => {
          if (mode === 'hogar') return acc + parseFloat(r.monto_total);
          const esMio = String(r.user_id) === String(user.id);
          const v = r.es_compartido && !esMio
            ? parseFloat(r.parte_contraparte || r.mi_parte)
            : parseFloat(r.mi_parte);
          return acc + (v || 0);
        }, 0);

      const pagosDeuda = rows
        .filter(r => r.tipo === 'deuda' && r.estado === 'confirmado')
        .reduce((acc, r) => acc + parseFloat(r.mi_parte), 0);

      // Falta pagar
      const [srv, resumenes] = await Promise.all([
        sbGet<Servicio>('servicios', { user_id: `eq.${user.id}`, estado: 'eq.pendiente' }),
        sbGet<ResumenTarjeta>('resumenes_tarjeta', { user_id: `eq.${user.id}`, estado: 'neq.pagado', es_vigente: 'eq.true' }),
      ]);

      const hoy    = new Date().toISOString().split('T')[0];
      const mesMes = DESDE_MES.substring(0, 7);
      const srvP   = srv
        .filter(s => s.fecha_vencimiento.substring(0, 7) === mesMes || s.fecha_vencimiento <= hoy)
        .reduce((a, s) => a + parseFloat(s.mi_parte || '0'), 0);
      const tarjP  = resumenes.reduce((a, r) => a + parseFloat(r.monto_total) - parseFloat(r.monto_pagado), 0);

      const m = await sbGet<Meta>('metas', { user_id: `eq.${user.id}`, activa: 'eq.true' });

      const totalGas = gasTotal + pagosDeuda;
      setGas(totalGas);
      setFalta(srvP + tarjP);
      setDis(ingTotal - totalGas);
      setMetas(m);
    } finally { setLoading(false); }
  }, [mode, user, allUsers]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const pct = dis + gas > 0 ? gas / (dis + gas) : 0;
  const sem = pct < 0.65
    ? { icon: '🟢', title: 'Finanzas saludables',  sub: `Gastás el ${(pct*100).toFixed(0)}%.` }
    : pct < 0.85
    ? { icon: '🟡', title: 'Atención',             sub: `Gastás el ${(pct*100).toFixed(0)}%. Cuidado.` }
    : { icon: '🔴', title: 'Situación crítica',    sub: `Gastás el ${(pct*100).toFixed(0)}%. Hay que ajustar.` };

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={FLAB} />

      <IngresosPendientes
        user   ={user}
        onToast={(_msg) => {}}
        onPaid ={() => setReloadKey(k => k + 1)}
      />

      <div className={styles.toggle}>
        <button className={`${styles.tb} ${mode === 'yo'    ? styles.active : ''}`} onClick={() => setMode('yo')}>👤 Yo</button>
        <button className={`${styles.tb} ${mode === 'hogar' ? styles.active : ''}`} onClick={() => setMode('hogar')}>🏠 Hogar</button>
      </div>

      {/* 3 stats */}
      <div className={styles.grid3}>
        <div className={styles.statMain}>
          <div className={styles.statLabel}>Disponible</div>
          <div className={`${styles.statVal} ${dis >= 0 ? styles.green : styles.red}`}>
            {loading ? '…' : fmtK(dis)}
          </div>
          <div className={styles.statSub}>lo que podés gastar</div>
        </div>

        <div className={styles.statSmall}>
          <div className={styles.statLabel}>Gastado</div>
          <div className={`${styles.statVal} ${styles.amber}`}>{loading ? '…' : fmtK(gas)}</div>
        </div>

        <div className={`${styles.statSmall} ${styles.faltaCard}`}>
          <div className={styles.statLabel}>Falta pagar</div>
          <div className={`${styles.statVal} ${styles.muted}`}>{loading ? '…' : fmtK(falta)}</div>
          <div className={styles.statSub}>informativo</div>
        </div>
      </div>

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
