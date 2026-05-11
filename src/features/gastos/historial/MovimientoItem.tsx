import { Badge }                 from '../../../components/ui';
import { fmtK, num }             from '../../../lib/utils';
import type { Movimiento, Usuario } from '../../../lib/types';
import styles                    from './MovimientoItem.module.css';

const ICONOS: Record<string, string> = {
  gasto: '🛒', deuda: '💳', ahorro: '🎯', ingreso: '💰', servicio: '🔌',
};

interface Props {
  mov              : Movimiento;
  allUsers         : Usuario[];
  userId           : string;
  mode             : 'yo' | 'hogar';
  esExpandida      : boolean;
  onToggleExpandir : () => void;
}

export function MovimientoItem({
  mov: r,
  allUsers,
  userId,
  mode,
  esExpandida,
  onToggleExpandir,
}: Props) {
  const esMio    = String(r.user_id) === String(userId);
  const mShow    = r.es_compartido && !esMio
    ? num(r.parte_contraparte || r.mi_parte)
    : num(r.mi_parte);
  const esPos    = r.tipo === 'ingreso';
  const esNeu    = r.tipo === 'ahorro';
  const esCompr  = r.estado === 'comprometido';
  const color    = esCompr ? 'var(--tx3)' : esPos ? 'var(--gn)' : esNeu ? 'var(--am)' : 'var(--rd)';
  const signo    = esPos ? '+' : '-';

  const autor    = !esMio
    ? allUsers.find(u => u.id === r.user_id)?.nombre || 'Otro'
    : null;

  // División legible
  const divLabel: Record<string, string> = {
    personal: 'Solo mío',
    prop    : 'Proporcional',
    mitad   : '50/50',
    novia   : 'De mi pareja',
  };

  return (
    <div className={styles.wrap}>
      {/* Fila principal */}
      <div className={styles.fila} onClick={onToggleExpandir}>
        <div className={styles.icono}>{ICONOS[r.tipo] || '•'}</div>

        <div className={styles.info}>
          <div className={styles.desc}>
            {r.descripcion}
            {r.es_compartido && (
              <Badge variant="info" style={{ marginLeft: 4 }}>compartido</Badge>
            )}
            {esCompr && (
              <Badge variant="default" style={{ marginLeft: 4 }}>Pendiente resumen</Badge>
            )}
          </div>
          <div className={styles.meta}>
            {r.fecha}
            {r.categoria ? ` · ${r.categoria}` : ''}
            {mode === 'hogar' && autor ? ` · de ${autor}` : ''}
          </div>
        </div>

        <div className={styles.derecha}>
          <div className={styles.monto} style={{ color }}>
            {signo}{fmtK(mShow)}
          </div>
          <div className={`${styles.chevron} ${esExpandida ? styles.chevronAbierto : ''}`}>▾</div>
        </div>
      </div>

      {/* Panel expandido */}
      {esExpandida && (
        <div className={styles.panel}>
          <div className={styles.panelGrid}>
            <div className={styles.panelItem}>
              <span className={styles.panelLabel}>Fecha</span>
              <span className={styles.panelVal}>{r.fecha}</span>
            </div>
            <div className={styles.panelItem}>
              <span className={styles.panelLabel}>Total</span>
              <span className={styles.panelVal}>${num(r.monto_total).toLocaleString('es-AR')}</span>
            </div>
            <div className={styles.panelItem}>
              <span className={styles.panelLabel}>Mi parte</span>
              <span className={styles.panelVal} style={{ color }}>${num(r.mi_parte).toLocaleString('es-AR')}</span>
            </div>
            {r.es_compartido && num(r.parte_contraparte) > 0 && (
              <div className={styles.panelItem}>
                <span className={styles.panelLabel}>Parte pareja</span>
                <span className={styles.panelVal}>${num(r.parte_contraparte).toLocaleString('es-AR')}</span>
              </div>
            )}
            <div className={styles.panelItem}>
              <span className={styles.panelLabel}>División</span>
              <span className={styles.panelVal}>{divLabel[r.division] || r.division}</span>
            </div>
            {r.medio_pago && (
              <div className={styles.panelItem}>
                <span className={styles.panelLabel}>Medio</span>
                <span className={styles.panelVal}>{r.medio_pago}</span>
              </div>
            )}
            {r.notas && (
              <div className={`${styles.panelItem} ${styles.panelFull}`}>
                <span className={styles.panelLabel}>Notas</span>
                <span className={styles.panelVal}>{r.notas}</span>
              </div>
            )}
            {r.en_cuotas && r.cant_cuotas && (
              <div className={styles.panelItem}>
                <span className={styles.panelLabel}>Cuotas</span>
                <span className={styles.panelVal}>{r.cant_cuotas} cuotas</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
