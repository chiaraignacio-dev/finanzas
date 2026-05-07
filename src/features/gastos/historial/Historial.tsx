import { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button, Input }    from '../../../components/ui';
import { PageHeader }                    from '../../../components/ui/PageHeader';
import { ConfirmDialog }                 from '../../../components/ui/ConfirmDialog';
import { MovimientoItem }                from './MovimientoItem';
import { EditarMovimientoModal }         from './EditarMovimientoModal';
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

  // Selección masiva
  const [seleccion,     setSeleccion]     = useState<Set<string>>(new Set());
  const [pagandoMasivo, setPagandoMasivo] = useState(false);
  const [montoMasivo,   setMontoMasivo]   = useState('');

  // Editar / eliminar
  const [editando,     setEditando]     = useState<Movimiento | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

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
      setSeleccion(new Set());
    } finally {
      setLoading(false);
    }
  }, [mode, user.id]);

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

  // ── Selección masiva ─────────────────────────────────
  function toggleSeleccion(id: string) {
    setSeleccion(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (next.size === 0) setPagandoMasivo(false);
      return next;
    });
  }

  const movimientosSeleccionados = movs.filter(m => seleccion.has(m.id));
  const totalSeleccionado = movimientosSeleccionados.reduce((a, m) => a + num(m.mi_parte), 0);

  async function pagarMasivo() {
    const montoPago = num(montoMasivo) || totalSeleccionado;
    if (!montoPago || seleccion.size === 0) return;

    let restante = montoPago;
    for (const mov of movimientosSeleccionados) {
      const saldo = num(mov.monto_total) - num(mov.monto_pagado);
      const pagar = Math.min(restante, saldo);
      if (pagar <= 0) continue;
      const nuevoPagado  = num(mov.monto_pagado) + pagar;
      const estadoNuevo  = nuevoPagado >= num(mov.monto_total) ? 'confirmado' : 'parcial';
      await sbPatch('movimientos', mov.id, { monto_pagado: nuevoPagado, estado: estadoNuevo });
      restante -= pagar;
    }
    onToast(`Pago masivo registrado ✓ — ${fmt(montoPago)}`);
    setPagandoMasivo(false);
    setMontoMasivo('');
    setSeleccion(new Set());
    load();
  }

  function handleGuardado() {
    setEditando(null);
    onToast('Movimiento actualizado ✓');
    load();
  }

  async function confirmarEliminacion() {
    if (!eliminandoId) return;
    try {
      await sbPatch('movimientos', eliminandoId, { estado: 'rechazado' });
      onToast('Movimiento eliminado');
    } catch { onToast('Error', 'err'); }
    setEliminandoId(null);
    load();
  }

  const esSeleccionable = (m: Movimiento) =>
    m.user_id === user.id &&
    (m.tipo === 'gasto' || m.tipo === 'deuda') &&
    m.estado !== 'comprometido';

  return (
    <div>
      <EditarMovimientoModal
        movimiento={editando}
        onCerrar={() => setEditando(null)}
        onGuardado={handleGuardado}
      />
      <ConfirmDialog
        abierto={!!eliminandoId}
        mensaje="¿Eliminás este movimiento? Se marcará como rechazado."
        peligroso
        labelConfirmar="Sí, eliminar"
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setEliminandoId(null)}
      />

      <PageHeader title="Historial" subtitle={`${movs.length} movimientos`} />

      <div className={styles.toggle}>
        <button className={`${styles.tb} ${mode === 'yo'    ? styles.active : ''}`} onClick={() => setMode('yo')}>👤 Yo</button>
        <button className={`${styles.tb} ${mode === 'hogar' ? styles.active : ''}`} onClick={() => setMode('hogar')}>🏠 Hogar</button>
      </div>

      {/* Pendientes compartidos */}
      {pendientes.length > 0 && (
        <div>
          <div className={styles.slab} style={{ color: 'var(--am)' }}>⏳ Gastos compartidos pendientes</div>
          {pendientes.map(r => {
            const quien = Object.values(allUsers).find((u: any) => u.id === r.user_id)?.nombre || 'Otro';
            return (
              <Card key={r.id} variant="pending" className={styles.pendCard}>
                <div className={styles.pendTop}>
                  <div>
                    <div className={styles.pendDesc}>{r.descripcion}</div>
                    <div className={styles.pendMeta}>{r.fecha} · de {quien}</div>
                  </div>
                  <Badge variant="warning">Pendiente</Badge>
                </div>
                <div className={styles.pendParts}>
                  <div className={styles.part}><div className={styles.partLabel}>Total</div><div className={styles.partVal}>{fmt(parseFloat(r.monto_total))}</div></div>
                  <div className={styles.part}><div className={styles.partLabel}>Tu parte</div><div className={styles.partVal} style={{ color: 'var(--ac2)' }}>{fmt(parseFloat(r.parte_contraparte || r.mi_parte))}</div></div>
                </div>
                <div className={styles.pendActions}>
                  <Button variant="success" onClick={() => confirmar(r.id)} style={{ flex: 1 }}>✓ Confirmar</Button>
                  <Button variant="danger"  onClick={() => rechazar(r.id)}  style={{ flex: 1 }}>✕ Rechazar</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Servicios pendientes */}
      {servicios.length > 0 && (
        <div>
          <div className={styles.slab} style={{ color: 'var(--pu)' }}>🔌 Servicios pendientes de pago</div>
          <Card>
            {servicios.map(s => (
              <div key={s.id} className={styles.srvItem}>
                <div className={styles.srvIcon}>{ICONS_SRV[s.servicio] || '🔌'}</div>
                <div className={styles.srvInfo}>
                  <div className={styles.srvName}>{s.servicio.charAt(0).toUpperCase() + s.servicio.slice(1)}</div>
                  <div className={styles.srvMeta}>Vcto: {new Date(s.fecha_vencimiento).toLocaleDateString('es-AR')}{s.es_compartido ? ' · Compartido' : ''}</div>
                </div>
                <div className={styles.srvRight}>
                  <div className={styles.srvAmt}>{fmt(parseFloat(s.mi_parte))}</div>
                  <Button variant="ghost" size="sm" onClick={() => pagarServicio(s.id)} style={{ color: 'var(--gn)', border: '1px solid rgba(16,185,129,0.4)', marginTop: 4 }}>
                    Pagar ✓
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Lista de movimientos */}
      <div className={styles.slab}>{mode === 'yo' ? 'Mis movimientos' : 'Movimientos del hogar'}</div>
      <Card>
        {loading && <div className={styles.loading}><div className={styles.spin} /></div>}
        {!loading && movs.length === 0 && <div className={styles.empty}>Sin movimientos aún</div>}
        {!loading && movs.map(r => (
          <MovimientoItem
            key           ={r.id}
            movimiento    ={r}
            usuarioActual ={user}
            todosUsuarios ={allUsers}
            seleccionado  ={seleccion.has(r.id)}
            onToggleSelect={esSeleccionable(r) ? toggleSeleccion : undefined}
            onEditar      ={r.user_id === user.id ? setEditando : undefined}
            onEliminar    ={r.user_id === user.id ? setEliminandoId : undefined}
            mostrarAutor  ={mode === 'hogar'}
          />
        ))}
      </Card>

      {/* Footer pago masivo */}
      {seleccion.size > 0 && (
        <div className={styles.footerMasivo}>
          <div className={styles.footerInfo}>
            <span className={styles.footerCant}>{seleccion.size} seleccionado{seleccion.size > 1 ? 's' : ''}</span>
            <span className={styles.footerTotal}>{fmt(totalSeleccionado)}</span>
          </div>
          {!pagandoMasivo ? (
            <div className={styles.footerAcciones}>
              <Button variant="primary" fullWidth onClick={() => setPagandoMasivo(true)}>
                Pagar seleccionados
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSeleccion(new Set())}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className={styles.footerPago}>
              <Input
                type="number"
                placeholder={`Total: ${fmt(totalSeleccionado)}`}
                value={montoMasivo}
                onChange={e => setMontoMasivo(e.target.value)}
                hint="Dejá vacío para pagar el total completo"
                fullWidth
              />
              <div className={styles.footerAcciones}>
                <Button variant="success" fullWidth onClick={pagarMasivo}>
                  Confirmar {montoMasivo ? fmt(num(montoMasivo)) : fmt(totalSeleccionado)}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => { setPagandoMasivo(false); setMontoMasivo(''); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ height: seleccion.size > 0 ? 220 : 16 }} />
    </div>
  );
}
