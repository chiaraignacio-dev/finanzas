import type { SuscripcionConHistorial } from '../../lib/types';
import { fmt } from '../../lib/utils';
import styles from './Suscripciones.module.css';

const DIV_LABEL: Record<string, string> = {
  personal: 'Solo mío',
  prop    : 'Proporcional',
  mitad   : '50/50',
};

interface Props {
  suscripcion : SuscripcionConHistorial;
  onEditar    : () => void;
  onDarDeBaja : () => void;
}

export function SuscripcionCard({ suscripcion: s, onEditar, onDarDeBaja }: Props) {
  const mesActual = new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' });

  // Últimos 3 pagos para mini historial
  const ultimos = s.pagos.slice(0, 3);

  return (
    <div className={`${styles.card} ${s.pagado_este_mes ? styles.cardPagada : ''}`}>
      <div className={styles.cardEmoji}>{s.emoji}</div>

      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.cardNombre}>{s.nombre}</span>
          <span className={styles.cardMonto}>{fmt(s.ultimo_monto)}</span>
        </div>

        <div className={styles.cardMeta}>
          <span className={styles.cardDiv}>{DIV_LABEL[s.division]}</span>
          {s.descripcion && <span className={styles.cardDesc}>{s.descripcion}</span>}
        </div>

        {/* Badge estado mes */}
        <div className={styles.cardFooter}>
          <span className={`${styles.badge} ${s.pagado_este_mes ? styles.badgeOk : styles.badgePend}`}>
            {s.pagado_este_mes ? `✓ ${mesActual}` : `⏳ ${mesActual}`}
          </span>

          {/* Mini historial de últimos pagos */}
          {ultimos.length > 0 && (
            <div className={styles.miniHistorial}>
              {ultimos.map((p) => (
                <span key={p.id} className={styles.miniPago} title={`${p.periodo}: ${fmt(p.monto)}`}>
                  {fmt(p.monto)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.cardAcciones}>
        <button className={styles.btnAccion} onClick={onEditar} title="Editar">✏️</button>
        <button className={styles.btnAccion} onClick={onDarDeBaja} title="Dar de baja">🗑</button>
      </div>
    </div>
  );
}
