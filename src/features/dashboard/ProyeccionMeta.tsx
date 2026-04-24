import { useMemo }   from 'react';
import { fmt }       from '../../lib/utils';
import type { Meta, Movimiento } from '../../lib/types';
import styles from './ProyeccionMeta.module.css';

interface Props {
  metas    : Meta[];
  ahorros  : Movimiento[];   // todos los movimientos tipo ahorro del usuario
  modo     : 'yo' | 'hogar';
}

interface MetaConProyeccion extends Meta {
  pct          : number;
  faltaMonto   : number;
  ritmoMensual : number;    // promedio últimos 3 meses
  mesesRestantes: number | null;
  fechaEstimada: string | null;
  necesitaPorMes: number | null; // si tiene fecha objetivo
  enTiempo     : boolean | null;
}

function mesKey(fecha: string): string {
  return fecha.substring(0, 7); // "2025-03"
}

function calcularRitmo(ahorros: Movimiento[]): number {
  const hoy    = new Date();
  const meses: Record<string, number> = {};

  for (let i = 0; i < 3; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
  }

  ahorros.forEach(m => {
    const k = mesKey(m.fecha);
    if (k in meses) meses[k] += parseFloat(m.mi_parte || '0');
  });

  const vals  = Object.values(meses);
  const total = vals.reduce((a, v) => a + v, 0);
  return vals.length > 0 ? total / vals.length : 0;
}

export function ProyeccionMeta({ metas, ahorros, modo }: Props) {
  const ritmoGlobal = useMemo(() => calcularRitmo(ahorros), [ahorros]);

  const metasConProyeccion: MetaConProyeccion[] = useMemo(() => {
    const filtradas = modo === 'yo'
      ? metas.filter(m => !m.es_compartida)
      : metas.filter(m =>  m.es_compartida);

    return filtradas.map(m => {
      const objetivo = parseFloat(m.monto_objetivo);
      const actual   = parseFloat(m.monto_actual);
      const pct      = objetivo > 0 ? Math.min(100, (actual / objetivo) * 100) : 0;
      const falta    = Math.max(0, objetivo - actual);

      // Ritmo mensual de los últimos 3 meses
      const ritmo = ritmoGlobal;

      // Proyección sin fecha objetivo
      let mesesRestantes : number | null = null;
      let fechaEstimada  : string | null = null;
      if (ritmo > 0 && falta > 0) {
        mesesRestantes = Math.ceil(falta / ritmo);
        const fechaObj = new Date();
        fechaObj.setMonth(fechaObj.getMonth() + mesesRestantes);
        fechaEstimada = fechaObj.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
      }

      // Si tiene fecha objetivo: ¿cuánto necesita por mes?
      let necesitaPorMes: number | null = null;
      let enTiempo      : boolean | null = null;
      if (m.fecha_objetivo && falta > 0) {
        const hoy    = new Date();
        const target = new Date(m.fecha_objetivo);
        const mesesDisp = Math.max(1,
          (target.getFullYear() - hoy.getFullYear()) * 12 +
          (target.getMonth() - hoy.getMonth())
        );
        necesitaPorMes = falta / mesesDisp;
        enTiempo       = ritmo >= necesitaPorMes;
      }

      return {
        ...m, pct, faltaMonto: falta,
        ritmoMensual: ritmo, mesesRestantes,
        fechaEstimada, necesitaPorMes, enTiempo,
      };
    });
  }, [metas, ahorros, modo, ritmoGlobal]);

  if (metasConProyeccion.length === 0) {
    return (
      <div className={styles.empty}>
        {modo === 'yo' ? 'Sin metas personales. Creá una en Config.' : 'Sin metas compartidas aún.'}
      </div>
    );
  }

  return (
    <div className={styles.lista}>
      {metasConProyeccion.map(m => (
        <div key={m.id} className={styles.meta}>
          {/* Nombre y montos */}
          <div className={styles.metaTop}>
            <div className={styles.metaNombre}>{m.emoji || '🎯'} {m.nombre}</div>
            <div className={styles.metaMontos}>
              <span className={styles.actual}>{fmt(parseFloat(m.monto_actual))}</span>
              <span className={styles.objetivo}>/ {fmt(parseFloat(m.monto_objetivo))}</span>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className={styles.barraWrap}>
            <div className={styles.barra}>
              <div
                className={styles.barraFill}
                style={{ width: `${m.pct.toFixed(0)}%` }}
              />
            </div>
            <span className={styles.barraPct}>{m.pct.toFixed(1)}%</span>
          </div>

          {/* Proyección */}
          {m.pct < 100 && (
            <div className={styles.proyeccion}>
              {/* Ritmo actual */}
              {m.ritmoMensual > 0 ? (
                <div className={styles.proyRow}>
                  <span className={styles.proyLabel}>Ritmo actual</span>
                  <span className={styles.proyVal}>{fmt(m.ritmoMensual)}/mes</span>
                </div>
              ) : (
                <div className={styles.proyRow}>
                  <span className={styles.proyLabel}>Sin ahorros registrados aún</span>
                </div>
              )}

              {/* Tiempo estimado (sin fecha objetivo) */}
              {!m.fecha_objetivo && m.fechaEstimada && m.mesesRestantes !== null && (
                <div className={styles.proyRow}>
                  <span className={styles.proyLabel}>Llegás a tu meta</span>
                  <span className={`${styles.proyVal} ${styles.highlight}`}>
                    en {m.mesesRestantes} {m.mesesRestantes === 1 ? 'mes' : 'meses'}
                    {' '}({m.fechaEstimada})
                  </span>
                </div>
              )}

              {/* Con fecha objetivo */}
              {m.fecha_objetivo && m.necesitaPorMes !== null && (
                <>
                  <div className={styles.proyRow}>
                    <span className={styles.proyLabel}>Fecha objetivo</span>
                    <span className={styles.proyVal}>
                      {new Date(m.fecha_objetivo + 'T00:00:00').toLocaleString('es-AR', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <div className={styles.proyRow}>
                    <span className={styles.proyLabel}>Necesitás ahorrar</span>
                    <span className={`${styles.proyVal} ${m.enTiempo ? styles.ok : styles.alerta}`}>
                      {fmt(m.necesitaPorMes)}/mes
                    </span>
                  </div>
                  <div className={`${styles.badge} ${m.enTiempo ? styles.badgeOk : styles.badgeAlerta}`}>
                    {m.enTiempo
                      ? `✓ Vas bien — ahorrás ${fmt(m.ritmoMensual - m.necesitaPorMes)} de más por mes`
                      : `Necesitás ${fmt(m.necesitaPorMes - m.ritmoMensual)} más por mes para llegar a tiempo`
                    }
                  </div>
                </>
              )}

              {/* Sin ritmo */}
              {m.ritmoMensual === 0 && !m.fechaEstimada && (
                <div className={styles.sinRitmo}>
                  Registrá ahorros para ver la proyección
                </div>
              )}
            </div>
          )}

          {m.pct >= 100 && (
            <div className={`${styles.badge} ${styles.badgeOk}`}>
              🎉 ¡Meta alcanzada!
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
