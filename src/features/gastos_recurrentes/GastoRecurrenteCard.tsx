import { TIPOS_GASTO_RECURRENTE }    from '../../lib/types';
import type { GastoRecurrenteConHistorial, GastoRecurrentePago } from '../../lib/types';
import { fmt }                       from '../../lib/utils';
import styles                        from './GastosRecurrentes.module.css';

const DIV_LABEL: Record<string, string> = {
  personal: 'Solo mío',
  prop    : 'Proporcional',
  mitad   : '50/50',
};

interface Props {
  gasto      : GastoRecurrenteConHistorial;
  onEditar   : () => void;
  onDarDeBaja: () => void;
}

export function GastoRecurrenteCard({ gasto: g, onEditar, onDarDeBaja }: Props) {
  const mesActual = new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  const ultimos   = g.pagos.slice(0, 3);
  const tipoInfo  = TIPOS_GASTO_RECURRENTE.find(t => t.value === g.tipo);

  return (
    <div className={`${styles.card} ${g.pagado_este_mes ? styles.cardPagada : ''}`}>
      <div className={styles.cardEmoji}>{g.emoji}</div>

      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.cardNombre}>{g.nombre}</span>
          <span className={styles.cardMonto}>{fmt(g.ultimo_monto)}</span>
        </div>

        <div className={styles.cardMeta}>
          <span className={styles.cardTipo}>{tipoInfo?.emoji} {tipoInfo?.label}</span>
          <span className={styles.cardDiv}>{DIV_LABEL[g.division]}</span>
          {g.descripcion && <span className={styles.cardDesc}>{g.descripcion}</span>}
        </div>

        <div className={styles.cardFooter}>
          <span className={`${styles.badge} ${g.pagado_este_mes ? styles.badgeOk : styles.badgePend}`}>
            {g.pagado_este_mes ? `✓ ${mesActual}` : `⏳ ${mesActual}`}
          </span>
          {ultimos.length > 0 && (
            <div className={styles.miniHistorial}>
              {ultimos.map((p: GastoRecurrentePago) => (
                <span key={p.id} className={styles.miniPago} title={`${p.periodo}: ${fmt(p.monto)}`}>
                  {fmt(p.monto)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.cardAcciones}>
        <button className={styles.btnAccion} onClick={onEditar}    title="Editar">✏️</button>
        <button className={styles.btnAccion} onClick={onDarDeBaja} title="Dar de baja">🗑</button>
      </div>
    </div>
  );
}
