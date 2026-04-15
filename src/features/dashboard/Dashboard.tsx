import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui';
import { PageHeader } from '../../components/ui';
import { sbGet } from '../../lib/supabase';
import { fmt, fmtK, FLAB, DESDE_MES } from '../../lib/utils';
import type { Usuario, Movimiento, Servicio, Meta } from '../../lib/types';
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
      const abril    = Object.values(allUsers).find(u => u.username !== user.username);
      const uData    = allUsers[user.username];
      const myIng    = (uData?.ingreso_fijo || 0) || ((uData?.ingreso_q1 || 0) + (uData?.ingreso_q2 || 0));
      const abrilIng = (abril?.ingreso_fijo || 0) || ((abril?.ingreso_q1 || 0) + (abril?.ingreso_q2 || 0));

      let rows: Movimiento[], srv: Servicio[], ingTotal: number;

      if (mode === 'yo') {
        const [mios, comp, s] = await Promise.all([
          sbGet<Movimiento>('movimientos', { user_id: `eq.${user.id}`, estado: 'eq.confirmado', fecha: `gte.${DESDE_MES}` }),
          sbGet<Movimiento>('movimientos', { es_compartido: 'eq.true', estado: 'eq.confirmado', user_id: `neq.${user.id}`, fecha: `gte.${DESDE_MES}` }),
          sbGet<Servicio>('servicios', { user_id: `eq.${user.id}`, estado: 'eq.pendiente' }),
        ]);
        rows = [...mios, ...comp];
        srv  = s;
        ingTotal = myIng;
      } else {
        const [all, s] = await Promise.all([
          sbGet<Movimiento>('movimientos', { estado: 'eq.confirmado', fecha: `gte.${DESDE_MES}` }),
          sbGet<Servicio>('servicios', { estado: 'eq.pendiente' }),
        ]);
        const seen = new Set<string>();
        rows = all.filter(r => { if (r.es_compartido) { if (seen.has(r.id)) return false; seen.add(r.id); } return true; });
        srv  = s;
        ingTotal = myIng + abrilIng;
      }

      // Gastos
      const gasTotal = rows
        .filter(r => r.tipo === 'gasto' && !r.es_ahorro)
        .reduce((acc, r) => {
          const esMio = String(r.user_id) === String(user.id);
          const v = mode === 'yo' && r.es_compartido && !esMio
            ? parseFloat(r.parte_contraparte || r.mi_parte)
            : parseFloat(r.mi_parte);
          return acc + (v || 0);
        }, 0);

      // Servicios del mes
      const hoy    = new Date().toISOString().split('T')[0];
      const mesMes = DESDE_MES.substring(0, 7);
      const srvMes = srv.filter(s => {
        if (!s.fecha_vencimiento) return false;
        return s.fecha_vencimiento.substring(0, 7) === mesMes || s.fecha_vencimiento <= hoy;
      });
      const faltaTotal = srvMes.reduce((a, s) => a + parseFloat(s.mi_parte || '0'), 0);

      // Metas
      const m = await sbGet<Meta>('metas', { user_id: `eq.${user.id}`, activa: 'eq.true' });

      setIng(ingTotal);
      setGas(gasTotal);
      setFalta(faltaTotal);
      setMetas(m);
    } finally {
      setLoading(false);
    }
  }, [mode, user, allUsers]);

  useEffect(() => { load(); }, [load]);

  const dis = ing - gas - falta;
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

      {/* Stats */}
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
        <div className={styles.stat}>
          <div className={styles.statLabel}>Falta pagar</div>
          <div className={`${styles.statVal} ${styles.amber}`}>{loading ? '…' : fmtK(falta)}</div>
          <div className={styles.statSub}>servicios pendientes</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Disponible</div>
          <div className={`${styles.statVal} ${dis >= 0 ? styles.green : styles.red}`}>{loading ? '…' : fmtK(dis)}</div>
          <div className={styles.statSub}>estimado</div>
        </div>
      </div>

      {/* Metas */}
      <div className={styles.slab}>Metas de ahorro</div>
      <Card style={{ margin: '0 16px 12px', padding: '12px 16px' }}>
        {metas.length === 0 && <div className={styles.empty}>Sin metas. Creá una en Config.</div>}
        {metas.map(m => {
          const p = parseFloat(m.monto_objetivo) ? Math.min(100, (parseFloat(m.monto_actual) / parseFloat(m.monto_objetivo)) * 100) : 0;
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
