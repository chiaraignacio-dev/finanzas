import { useState, useEffect, useCallback } from 'react';
import { Card }               from '../../components/ui';
import { PageHeader }         from '../../components/ui/PageHeader';
import { IngresosPendientes } from '../ingresos/IngresosPendientes';
import { GraficoEvolucion }   from './GraficoEvolucion';
import { ProyeccionMeta }     from './ProyeccionMeta';
import { sbGet }              from '../../lib/supabase';
import { usarSesion }         from '../../context/SesionContext';
import { fmtK, FLAB, DESDE_MES, num } from '../../lib/utils';
import type { Movimiento, Servicio, Meta, ResumenTarjeta, Ingreso } from '../../lib/types';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const sesion   = usarSesion();
  const user     = sesion.usuario;
  const allUsers = sesion.todosUsuarios;

  const [mode,      setMode]      = useState<'yo' | 'hogar'>('yo');
  const [gas,       setGas]       = useState(0);
  const [falta,     setFalta]     = useState(0);
  const [dis,       setDis]       = useState(0);
  const [enTarjeta, setEnTarjeta] = useState(0);
  const [metas,     setMetas]     = useState<Meta[]>([]);
  const [ahorros,   setAhorros]   = useState<Movimiento[]>([]);
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
        ingTotal = ingresosRecibidos.reduce((a, i) => a + num(i.monto), 0);

        const [mios, comp] = await Promise.all([
          sbGet<Movimiento>('movimientos', { user_id: `eq.${user.id}`, fecha: `gte.${DESDE_MES}` }),
          sbGet<Movimiento>('movimientos', {
            es_compartido: 'eq.true',
            estado       : 'eq.confirmado',
            user_id      : `neq.${user.id}`,
            fecha        : `gte.${DESDE_MES}`,
          }),
        ]);
        rows = [...mios, ...comp];
      } else {
        const todosIngresos = await sbGet<Ingreso>('ingresos', {
          recibido      : 'eq.true',
          fecha_recibido: `gte.${DESDE_MES}`,
        });
        ingTotal = todosIngresos.reduce((a, i) => a + num(i.monto), 0);

        const all = await sbGet<Movimiento>('movimientos', { fecha: `gte.${DESDE_MES}` });
        const seen = new Set<string>();
        rows = all.filter(r => {
          if (r.es_compartido) { if (seen.has(r.id)) return false; seen.add(r.id); }
          return true;
        });
      }

      // ── Gastos confirmados que SÍ impactan en Disponible ──────────────────
      // Excluye:
      //   - comprometidos (tarjeta sin resumen aún)
      //   - movimientos vinculados a un resumen de tarjeta (son los consumos del
      //     detalle; el impacto real ocurre cuando se registra el PAGO del resumen)
      const gasTotal = rows
        .filter(r =>
          r.tipo === 'gasto' &&
          !r.es_ahorro &&
          r.estado === 'confirmado' &&
          !r.resumen_id          // excluir consumos de resumen — solo el pago cuenta
        )
        .reduce((acc, r) => {
          if (mode === 'hogar') return acc + num(r.monto_total);
          const esMio = String(r.user_id) === String(user.id);
          const v = r.es_compartido && !esMio
            ? num(r.parte_contraparte || r.mi_parte)
            : num(r.mi_parte);
          return acc + v;
        }, 0);

      // ── Pagos de deudas (tarjetas, servicios, etc.) ───────────────────────
      // Estos SÍ impactan: cuando pagás el resumen, ese movimiento tipo 'deuda'
      // confirmado sin resumen_id representa la salida real de dinero
      const pagosDeuda = rows
        .filter(r => r.tipo === 'deuda' && r.estado === 'confirmado')
        .reduce((acc, r) => acc + num(r.mi_parte), 0);

      // ── Gastos comprometidos (tarjeta sin cerrar) ─────────────────────────
      const enTarjetaTotal = rows
        .filter(r =>
          r.tipo === 'gasto' &&
          !r.es_ahorro &&
          r.estado === 'comprometido'
        )
        .reduce((acc, r) => {
          if (mode === 'hogar') return acc + num(r.monto_total);
          const esMio = String(r.user_id) === String(user.id);
          const v = r.es_compartido && !esMio
            ? num(r.parte_contraparte || r.mi_parte)
            : num(r.mi_parte);
          return acc + v;
        }, 0);

      const [srv, resumenes, metasData, ahorrosData] = await Promise.all([
        sbGet<Servicio>('servicios',       { user_id: `eq.${user.id}`, estado: 'eq.pendiente' }),
        sbGet<ResumenTarjeta>('resumenes_tarjeta', {
          user_id   : `eq.${user.id}`,
          estado    : 'neq.pagado',
          es_vigente: 'eq.true',
        }),
        sbGet<Meta>('metas',     { user_id: `eq.${user.id}`, activa: 'eq.true' }, 30_000),
        sbGet<Movimiento>('movimientos', { user_id: `eq.${user.id}` }, 0),
      ]);

      const hoy    = new Date().toISOString().split('T')[0];
      const mesMes = DESDE_MES.substring(0, 7);

      // Falta pagar = servicios pendientes del mes + saldo de tarjetas vigentes
      const srvP  = srv
        .filter(s => s.fecha_vencimiento.substring(0, 7) === mesMes || s.fecha_vencimiento <= hoy)
        .reduce((a, s) => a + num(s.mi_parte), 0);
      const tarjP = resumenes.reduce((a, r) => a + num(r.monto_total) - num(r.monto_pagado), 0);

      const soloAhorros = ahorrosData.filter(m => m.es_ahorro || m.tipo === 'ahorro');

      const totalGas = gasTotal + pagosDeuda;
      setGas(totalGas);
      setFalta(srvP + tarjP);
      setDis(ingTotal - totalGas);
      setEnTarjeta(enTarjetaTotal);
      setMetas(metasData);
      setAhorros(soloAhorros);
    } finally {
      setLoading(false);
    }
  }, [mode, user, allUsers]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const pct = dis + gas > 0 ? gas / (dis + gas) : 0;
  const sem = pct < 0.65
    ? { icon: '🟢', title: 'Finanzas saludables',  sub: `Gastás el ${(pct * 100).toFixed(0)}%.` }
    : pct < 0.85
    ? { icon: '🟡', title: 'Atención',             sub: `Gastás el ${(pct * 100).toFixed(0)}%. Cuidado.` }
    : { icon: '🔴', title: 'Situación crítica',    sub: `Gastás el ${(pct * 100).toFixed(0)}%. Hay que ajustar.` };

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={FLAB} />

      <IngresosPendientes
        user   ={user}
        onToast={(_msg) => {}}
        onPaid ={() => setReloadKey(k => k + 1)}
      />

      {/* Toggle yo / hogar */}
      <div className={styles.toggle}>
        <button className={`${styles.tb} ${mode === 'yo'    ? styles.active : ''}`} onClick={() => setMode('yo')}>👤 Yo</button>
        <button className={`${styles.tb} ${mode === 'hogar' ? styles.active : ''}`} onClick={() => setMode('hogar')}>🏠 Hogar</button>
      </div>

      {/* Stats grid */}
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

        <div className={`${styles.statSmall} ${styles.tarjetaCard}`}>
          <div className={styles.statLabel}>En tarjeta</div>
          <div className={`${styles.statVal} ${styles.muted}`}>{loading ? '…' : fmtK(enTarjeta)}</div>
          <div className={styles.statSub}>sin cerrar</div>
        </div>

        <div className={`${styles.statSmall} ${styles.faltaCard}`}>
          <div className={styles.statLabel}>Falta pagar</div>
          <div className={`${styles.statVal} ${styles.muted}`}>{loading ? '…' : fmtK(falta)}</div>
          <div className={styles.statSub}>informativo</div>
        </div>
      </div>

      {/* Gráfico de evolución mensual */}
      <div className={styles.slab}>Evolución últimos 6 meses</div>
      <Card style={{ margin: '0 16px 12px', padding: '12px 16px' }}>
        {!loading && <GraficoEvolucion modo={mode} />}
        {loading   && <div className={styles.empty}>Cargando…</div>}
      </Card>

      {/* Metas con proyección */}
      <div className={styles.slab}>Metas de ahorro</div>
      <Card style={{ margin: '0 16px 12px', padding: '12px 16px' }}>
        {!loading
          ? <ProyeccionMeta metas={metas} ahorros={ahorros} modo={mode} />
          : <div className={styles.empty}>Cargando…</div>
        }
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
