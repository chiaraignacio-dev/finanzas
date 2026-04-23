import type { SuscripcionConHistorial } from '../../lib/types';
import { fmt } from '../../lib/utils';
import styles from './Suscripciones.module.css';

interface Props {
  suscripciones: SuscripcionConHistorial[];
}

export function GraficoSuscripciones({ suscripciones }: Props) {
  // Últimos 6 meses
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return d.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  });

  const totales = meses.map((mes) =>
    suscripciones.reduce((acc, s) => {
      const pago = s.pagos.find((p) => p.periodo === mes);
      return acc + (pago?.monto ?? 0);
    }, 0)
  );

  const max = Math.max(...totales, 1);

  return (
    <div className={styles.grafico}>
      <div className={styles.graficoTitulo}>Gasto mensual en suscripciones</div>
      <div className={styles.barras}>
        {meses.map((mes, i) => {
          const pct      = totales[i] > 0 ? (totales[i] / max) * 100 : 2;
          const mesCorto = mes.split(' ')[0].slice(0, 3);
          const esMesActual = i === 5;
          return (
            <div key={mes} className={styles.barraCol}>
              {totales[i] > 0 && (
                <span className={styles.barraMonto}>{fmt(totales[i])}</span>
              )}
              <div className={styles.barraWrap}>
                <div
                  className={`${styles.barra} ${esMesActual ? styles.barraActual : ''}`}
                  style={{ height: `${pct}%` }}
                  title={`${mes}: ${fmt(totales[i])}`}
                />
              </div>
              <span className={`${styles.barraLabel} ${esMesActual ? styles.barraLabelActual : ''}`}>
                {mesCorto}
              </span>
            </div>
          );
        })}
      </div>

      {/* Desglose por suscripción del mes actual */}
      <div className={styles.desglose}>
        {suscripciones.map((s) => {
          const mesActual = meses[5];
          const pago = s.pagos.find((p) => p.periodo === mesActual);
          const monto = pago?.monto ?? s.ultimo_monto;
          const pct = Math.round((monto / Math.max(totales[5], 1)) * 100);
          return (
            <div key={s.id} className={styles.desgloseItem}>
              <span>{s.emoji} {s.nombre}</span>
              <div className={styles.desgloseBarra}>
                <div className={styles.desgloseRelleno} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.desgloseMonto}>{fmt(monto)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
