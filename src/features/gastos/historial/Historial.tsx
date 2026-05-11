import { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button }           from '../../../components/ui';
import { PageHeader }                    from '../../../components/ui/PageHeader';
import { MovimientoItem }                from './MovimientoItem';
import { sbGet, sbPatch }               from '../../../lib/supabase';
import { usarSesion, usarToast }         from '../../../context/SesionContext';
import { fmt, num }                      from '../../../lib/utils';
import type { Movimiento, Servicio }     from '../../../lib/types';
import styles                            from './Historial.module.css';

interface Props { onBadge: (n: number) => void; }

const ICONS_SRV: Record<string, string> = {
  luz: '⚡', agua: '💧', gas: '🔥', internet: '📡', expensas: '🏢',
};

export function Historial({ onBadge }: Props) {
  const sesion   = usarSesion();
  const user     = sesion.usuario;
  const allUsers = sesion.todosUsuarios;
  const { mostrar: onToast } = usarToast();

  const [mode,       setMode]       = useState<'yo' | 'hogar'>('yo');
  const [movs,       setMovs]       = useState<Movimiento[]>([]);
  const [pendientes, setPendientes] = useState<Movimiento[]>([]);
  const [servicios,  setServicios]  = useState<Servicio[]>([]);
  const [loading,    setLoading]    = useState(true);

  // ✅ Expandible para ver detalles
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pend = await sbGet<Movimiento>('movimientos', {
        es_compartido: 'eq.true',
        estado       : 'eq.pendiente',
        user_id      : `neq.${user.id}`,
      }, 0);

      const hoy = new Date().toISOString().split('T')[0];
      const srv = await sbGet<Servicio>('servicios', {
        user_id          : `eq.${user.id}`,
        estado           : 'eq.pendiente',
        fecha_vencimiento: `lte.${hoy}`,
      }, 0);

      setPendientes(pend);
      setServicios(srv);
      onBadge(pend.length + srv.length);

      let all: Movimiento[];
      if (mode === 'yo') {
        const [mios, comp] = await Promise.all([
          sbGet<Movimiento>('movimientos', { user_id: `eq.${user.id}`, estado: 'neq.rechazado' }, 0),
          sbGet<Movimiento>('movimientos', { es_compartido: 'eq.true', estado: 'eq.confirmado', user_id: `neq.${user.id}` }, 0),
        ]);
        all = [...mios.filter(m => m.estado !== 'rechazado'), ...comp]
          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
          .slice(0, 50);
      } else {
        const rows = await sbGet<Movimiento>('movimientos', { es_compartido: 'eq.true', estado: 'eq.confirmado' }, 0);
        const seen = new Set<string>();
        all = rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
      }
      setMovs(all);
    } finally {
      setLoading(false);
    }
  }, [mode, user.id, onBadge]);

  useEffect(() => { load(); }, [load]);

  async function confirmar(id: string) {
    try {
      await sbPatch('movimientos', id, { estado: 'confirmado', confirmado_por: user.id });
      onToast('Gasto confirmado ✓');
      load();
    } catch { onToast('Error', 'err'); }
  }

  async function rechazar(id: string) {
    try {
      await sbPatch('movimientos', id, { estado: 'rechazado' });
      onToast('Rechazado');
      load();
    } catch { onToast('Error', 'err'); }
  }

  async function pagarServicio(id: string) {
    try {
      await sbPatch('servicios', id, { estado: 'pagado', pagado_en: new Date().toISOString(), quien_pago: 'yo' });
      onToast('Servicio pagado ✓');
      load();
    } catch { onToast('Error', 'err'); }
  }

  // ✅ Toggle expandir/contraer
  function toggleExpandir(id: string) {
    setExpandidas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ✅ Convertir Record a Array para pasar a MovimientoItem
  const allUsersArray = Object.values(allUsers);

  return (
    <div>
      <PageHeader title="Historial" subtitle="Movimientos recientes" />

      {/* ── Pendientes compartidos de confirmación ───── */}
      {pendientes.length > 0 && (
        <>
          <div className={styles.slab}>⏳ Pendientes de confirmar</div>
          <Card style={{ margin: '0 16px 12px' }}>
            {pendientes.map(m => {
              const otro = allUsersArray.find(u => u.id === m.user_id);
              return (
                <div key={m.id} className={styles.row}>
                  <div className={styles.rowInfo}>
                    <div className={styles.rowDesc}>{m.descripcion}</div>
                    <div className={styles.rowMeta}>
                      {new Date(m.fecha).toLocaleDateString('es-AR')}
                      {otro && ` • ${otro.nombre} lo cargó`}
                    </div>
                  </div>
                  <div className={styles.rowDer}>
                    <div className={styles.rowMonto}>{fmt(num(m.mi_parte))}</div>
                    <Badge variant="warning">Compartido</Badge>
                  </div>
                  <div className={styles.rowAcciones}>
                    <Button variant="success" size="sm" onClick={() => confirmar(m.id)}>✓ Confirmar</Button>
                    <Button variant="danger" size="sm" onClick={() => rechazar(m.id)}>✕ Rechazar</Button>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {/* ── Servicios vencidos pendientes ─────────── */}
      {servicios.length > 0 && (
        <>
          <div className={styles.slab}>🔴 Servicios vencidos</div>
          <Card style={{ margin: '0 16px 12px' }}>
            {servicios.map(s => (
              <div key={s.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowDesc}>{ICONS_SRV[s.servicio] || '📄'} {s.servicio}</div>
                  <div className={styles.rowMeta}>Vence: {new Date(s.fecha_vencimiento).toLocaleDateString('es-AR')}</div>
                </div>
                <div className={styles.rowDer}>
                  <div className={styles.rowMonto}>{fmt(num(s.mi_parte))}</div>
                  <Badge variant="danger">Vencido</Badge>
                </div>
                <Button variant="primary" fullWidth onClick={() => pagarServicio(s.id)}>Pagar</Button>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* ── Toggle yo / hogar ─────────────────────── */}
      <div className={styles.toggle}>
        <button className={`${styles.tb} ${mode === 'yo'    ? styles.active : ''}`} onClick={() => setMode('yo')}>👤 Yo</button>
        <button className={`${styles.tb} ${mode === 'hogar' ? styles.active : ''}`} onClick={() => setMode('hogar')}>🏠 Hogar</button>
      </div>

      {/* ── Historial de movimientos ──────────────── */}
      {loading && <div className={styles.empty}>Cargando...</div>}
      {!loading && movs.length === 0 && <div className={styles.empty}>Sin movimientos registrados</div>}
      {!loading && movs.length > 0 && (
        <Card style={{ margin: '0 16px 80px', padding: '0' }}>
          {movs.map(m => (
            <MovimientoItem
              key={m.id}
              mov={m}
              allUsers={allUsersArray}
              userId={user.id}
              mode={mode}
              esExpandida={expandidas.has(m.id)}
              onToggleExpandir={() => toggleExpandir(m.id)}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
