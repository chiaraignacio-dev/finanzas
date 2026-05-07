import { useState }              from 'react';
import { Badge, Button }         from '../../../components/ui';
import { fmt, fmtK, num }        from '../../../lib/utils';
import type { Movimiento, Usuario } from '../../../lib/types';
import styles                    from './MovimientoItem.module.css';

const ICONOS: Record<string, string> = {
  gasto: '🛒', deuda: '💳', ahorro: '🎯', ingreso: '💰', servicio: '🔌',
};

interface Props {
  movimiento     : Movimiento;
  usuarioActual  : Usuario;
  todosUsuarios  : Record<string, Usuario>;
  // Selección para pagos masivos
  seleccionado?  : boolean;
  onToggleSelect?: (id: string) => void;
  // Editar / Eliminar
  onEditar?      : (mov: Movimiento) => void;
  onEliminar?    : (id: string) => void;
  // Para mostrar quién fue el autor
  mostrarAutor?  : boolean;
}

export function MovimientoItem({
  movimiento: r,
  usuarioActual,
  todosUsuarios,
  seleccionado,
  onToggleSelect,
  onEditar,
  onEliminar,
  mostrarAutor = false,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  const esMio    = String(r.user_id) === String(usuarioActual.id);
  const mShow    = r.es_compartido && !esMio
    ? num(r.parte_contraparte || r.mi_parte)
    : num(r.mi_parte);
  const esPos    = r.tipo === 'ingreso';
  const esNeu    = r.tipo === 'ahorro';
  const esCompr  = r.estado === 'comprometido';
  const color    = esCompr ? 'var(--tx3)' : esPos ? 'var(--gn)' : esNeu ? 'var(--am)' : 'var(--rd)';
  const signo    = esPos ? '+' : '-';

  const autor    = !esMio
    ? Object.values(todosUsuarios).find(u => u.id === r.user_id)?.nombre || 'Otro'
    : null;

  // Puede editar/eliminar solo si es el creador
  const puedeModificar = esMio && (onEditar || onEliminar);

  // División legible
  const divLabel: Record<string, string> = {
    personal: 'Solo mío',
    prop    : 'Proporcional',
    mitad   : '50/50',
    novia   : 'De mi pareja',
  };

  return (
    <div className={`${styles.wrap} ${seleccionado ? styles.seleccionado : ''}`}>
      {/* Fila principal */}
      <div className={styles.fila} onClick={() => setExpandido(v => !v)}>
        {/* Checkbox para selección masiva (solo gastos/deudas propias) */}
        {onToggleSelect && (
          <span
            className={styles.checkbox}
            onClick={e => { e.stopPropagation(); onToggleSelect(r.id); }}
          >
            {seleccionado ? '☑' : '☐'}
          </span>
        )}

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
            {mostrarAutor && autor ? ` · de ${autor}` : ''}
          </div>
        </div>

        <div className={styles.derecha}>
          <div className={styles.monto} style={{ color }}>
            {signo}{fmtK(mShow)}
          </div>
          <div className={`${styles.chevron} ${expandido ? styles.chevronAbierto : ''}`}>▾</div>
        </div>
      </div>

      {/* Panel expandido */}
      {expandido && (
        <div className={styles.panel}>
          <div className={styles.panelGrid}>
            <div className={styles.panelItem}>
              <span className={styles.panelLabel}>Fecha</span>
              <span className={styles.panelVal}>{r.fecha}</span>
            </div>
            <div className={styles.panelItem}>
              <span className={styles.panelLabel}>Total</span>
              <span className={styles.panelVal}>{fmt(num(r.monto_total))}</span>
            </div>
            <div className={styles.panelItem}>
              <span className={styles.panelLabel}>Mi parte</span>
              <span className={styles.panelVal} style={{ color }}>{fmt(num(r.mi_parte))}</span>
            </div>
            {r.es_compartido && num(r.parte_contraparte) > 0 && (
              <div className={styles.panelItem}>
                <span className={styles.panelLabel}>Parte pareja</span>
                <span className={styles.panelVal}>{fmt(num(r.parte_contraparte))}</span>
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

          {/* Acciones */}
          {puedeModificar && (
            <div className={styles.acciones}>
              {onEditar && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={e => { e.stopPropagation(); onEditar(r); }}
                >
                  ✏️ Editar
                </Button>
              )}
              {onEliminar && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={e => { e.stopPropagation(); onEliminar(r.id); }}
                >
                  🗑 Eliminar
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
