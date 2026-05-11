import { useState, useEffect, useCallback } from 'react';
import { Card }               from '../../components/ui';
import { PageHeader }         from '../../components/ui/PageHeader';
import { IngresosPendientes } from '../ingresos/IngresosPendientes';
import { GraficoEvolucion }   from './GraficoEvolucion';
import { ProyeccionMeta }     from './ProyeccionMeta';
import { sbGet }              from '../../lib/supabase';
import { usarSesion }         from '../../context/SesionContext';
import { fmtK, obtenerFechaLab, obtenerDesdeMes, num } from '../../lib/utils';
import type { Movimiento, Servicio, Meta, ResumenTarjeta, Ingreso } from '../../lib/types';
import styles from './Dashboard.module.css';
import { GraficoTorta } from './GraficoTorta';

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
  
  // ✅ Estados para gráficos
  const [movGastosMes,       setMovGastosMes]       = useState<Movimiento[]>([]);
  const [movsHistoricos,     setMovsHistoricos]     = useState<Movimiento[]>([]);
  const [ingresosHistoricos, setIngresosHistoricos] = useState<Ingreso[]>([]);
  const [mesesGrafico,       setMesesGrafico]       = useState<{
    label: string; mesISO: string; desde: string; hasta: string;
  }[]>([]);

  const load = useCallback(async () => {
    // Calcular fechas frescas en cada ejecución (evita stale values)
    const desdeMes = obtenerDesdeMes();
    setLoading(true);
    try {
      let ingTotal = 0;
      let rows: Movimiento[] = [];

      if (mode === 'yo') {
        // ✅ Solo ingresos patrimoniales reales (excluye reintegros internos)
        const ingresosRecibidos = await sbGet<Ingreso>('ingresos', {
          user_id       : `eq.${user.id}`,
          recibido      : 'eq.true',
          fecha_recibido: `gte.${desdeMes}`,
          es_reintegro  : 'not.eq.true',  // Excluye donde es_reintegro = true
        }, 0);
        ingTotal = ingresosRecibidos.reduce((a, i) => a + num(i.monto), 0);

        const [mios, comp] = await Promise.all([
          // Traer todos los movimientos del mes del usuario (confirmados + comprometidos)
          sbGet<Movimiento>('movimientos', { user_id: `eq.${user.id}`, fecha: `gte.${desdeMes}` }, 0),
          // Compartidos confirmados de la pareja del mes (excluye consumos de tarjeta)
          sbGet<Movimiento>('movimientos', {
            es_compartido: 'eq.true',
            estado       : 'eq.confirmado',
            user_id      : `neq.${user.id}`,
            fecha        : `gte.${desdeMes}`,
            resumen_id   : 'is.null',
          }, 0),
        ]);
        rows = [...mios, ...comp];
      } else {
        // ✅ Solo ingresos patrimoniales reales (excluye reintegros internos)
        const todosIngresos = await sbGet<Ingreso>('ingresos', {
          recibido      : 'eq.true',
          fecha_recibido: `gte.${desdeMes}`,
          es_reintegro  : 'not.eq.true',  // Excluye donde es_reintegro = true
        }, 0);
        ingTotal = todosIngresos.reduce((a, i) => a + num(i.monto), 0);

        const all = await sbGet<Movimiento>('movimientos', { fecha: `gte.${desdeMes}` }, 0);
        const seen = new Set<string>();
        rows = all.filter(r => {
          if (r.es_compartido) { if (seen.has(r.id)) return false; seen.add(r.id); }
          return true;
        });
      }

      // ── Gastos confirmados que SÍ impactan en Disponible ──────────────────
      // Excluye comprometidos y movimientos vinculados a resumen de tarjeta
      const gasTotal = rows
        .filter(r =>
          r.tipo === 'gasto' &&
          !r.es_ahorro &&
          r.estado === 'confirmado' &&
          !r.resumen_id
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
      const pagosDeuda = rows
        .filter(r => r.tipo === 'deuda' && r.estado === 'confirmado')
        .reduce((acc, r) => acc + num(r.mi_parte), 0);

      // ── Gastos comprometidos en tarjeta SIN CERRAR ────────────────────────
      // IMPORTANTE: los comprometidos pueden tener fecha futura (próximo vencimiento
      // del resumen). Se consultan por separado SIN filtro de fecha para capturar
      // todos los gastos pendientes de la tarjeta actual, sin importar su fecha asignada.
      const comprometidosQuery = mode === 'yo'
        ? sbGet<Movimiento>('movimientos', {
            user_id: `eq.${user.id}`,
            tipo   : 'eq.gasto',
            estado : 'eq.comprometido',
          }, 0)
        : sbGet<Movimiento>('movimientos', {
            tipo  : 'eq.gasto',
            estado: 'eq.comprometido',
          }, 0);

      const comprometidos = await comprometidosQuery;
      const seenComp = new Set<string>();
      const comprometidosFiltrados = mode === 'hogar'
        ? comprometidos.filter(r => { if (seenComp.has(r.id)) return false; seenComp.add(r.id); return true; })
        : comprometidos;

      const enTarjetaTotal = comprometidosFiltrados
        .filter(r => !r.es_ahorro)
        .reduce((acc, r) => {
          if (mode === 'hogar') return acc + num(r.monto_total);
          const esMio = String(r.user_id) === String(user.id);
          const v = r.es_compartido && !esMio
            ? num(r.parte_contraparte || r.mi_parte)
            : num(r.mi_parte);
          return acc + v;
        }, 0);

      const [srv, resumenes, metasData, ahorrosData] = await Promise.all([
        sbGet<Servicio>('servicios',       { user_id: `eq.${user.id}`, estado: 'eq.pendiente' }, 0),
        sbGet<ResumenTarjeta>('resumenes_tarjeta', {
          user_id   : `eq.${user.id}`,
          estado    : 'neq.pagado',
          es_vigente: 'eq.true',
        }, 0),
        sbGet<Meta>('metas',     { user_id: `eq.${user.id}`, activa: 'eq.true' }, 30_000),
        sbGet<Movimiento>('movimientos', { user_id: `eq.${user.id}` }, 0),
      ]);

      const hoy    = new Date().toISOString().split('T')[0];
      const mesMes = desdeMes.substring(0, 7);

      // Falta pagar = servicios pendientes del mes + saldo de tarjetas vigentes
      const srvP  = srv
        .filter(s => s.fecha_vencimiento.substring(0, 7) === mesMes || s.fecha_vencimiento <= hoy)
        .reduce((a, s) => a + num(s.mi_parte), 0);
      const tarjP = resumenes.reduce((a, r) => a + num(r.monto_total) - num(r.monto_pagado), 0);

      const soloAhorros = ahorrosData.filter(m => m.es_ahorro || m.tipo === 'ahorro');

      // ── Datos para los gráficos ────────────────────────────────────────────
      // ✅ Movimientos del mes filtrados (gastoBase) para GraficoTorta
      const movGastosMesData = rows.filter(r =>
        r.tipo === 'gasto' &&
        !r.es_ahorro &&
        r.estado === 'confirmado' &&
        !r.resumen_id
      );

      // ✅ Datos históricos de 6 meses para GraficoEvolucion
      const hace6Meses = new Date();
      hace6Meses.setMonth(hace6Meses.getMonth() - 6);
      const desde6Meses = hace6Meses.toISOString().split('T')[0];

      // Generar array de meses para el gráfico
      const mesesArray = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const mesISO = d.toISOString().substring(0, 7);  // "2026-05"
        const primerDia = new Date(d.getFullYear(), d.getMonth(), 1);
        const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        mesesArray.push({
          label : d.toLocaleString('es-AR', { month: 'short' }),
          mesISO: mesISO,
          desde : primerDia.toISOString().split('T')[0],
          hasta : ultimoDia.toISOString().split('T')[0],
        });
      }

      const [movsHist, ingrHist] = await Promise.all([
        // Movimientos históricos del usuario (o todos en modo hogar)
        mode === 'yo'
          ? sbGet<Movimiento>('movimientos', {
              user_id: `eq.${user.id}`,
              fecha  : `gte.${desde6Meses}`,
            }, 0)
          : sbGet<Movimiento>('movimientos', {
              fecha: `gte.${desde6Meses}`,
            }, 0),
        // Ingresos históricos (excluye reintegros)
        mode === 'yo'
          ? sbGet<Ingreso>('ingresos', {
              user_id       : `eq.${user.id}`,
              recibido      : 'eq.true',
              fecha_recibido: `gte.${desde6Meses}`,
              es_reintegro  : 'not.eq.true',
            }, 0)
          : sbGet<Ingreso>('ingresos', {
              recibido      : 'eq.true',
              fecha_recibido: `gte.${desde6Meses}`,
              es_reintegro  : 'not.eq.true',
            }, 0),
      ]);

      const totalGas = gasTotal + pagosDeuda;
      setGas(totalGas);
      setFalta(srvP + tarjP);
      setDis(ingTotal - totalGas);
      setEnTarjeta(enTarjetaTotal);
      setMetas(metasData);
      setAhorros(soloAhorros);
      setMovGastosMes(movGastosMesData);
      setMovsHistoricos(movsHist);
      setIngresosHistoricos(ingrHist);
      setMesesGrafico(mesesArray);
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
      <PageHeader title="Dashboard" subtitle={obtenerFechaLab()} />

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
        {!loading && (
          <GraficoEvolucion 
            modo={mode} 
            movimientos={movsHistoricos}
            ingresos={ingresosHistoricos}
            meses={mesesGrafico}
          />
        )}
        {loading   && <div className={styles.empty}>Cargando…</div>}
      </Card>

      <div className={styles.slab}>Gasto por categoría</div>
      <Card style={{ margin: '0 16px 12px', padding: '12px 16px' }}>
        {!loading && (
          <GraficoTorta 
            modo={mode}
            movimientos={movGastosMes}
          />
        )}
        {loading && <div className={styles.empty}>Cargando…</div>}
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
