import { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button } from '../../../components/ui';
import { PageHeader } from '../../../components/ui/PageHeader';
import { sbGet, sbPatch } from '../../../lib/supabase';
import { usarSesion, usarToast } from '../../../context/SesionContext';
import { fmt, fmtK } from '../../../lib/utils';
import type { Movimiento, Servicio } from '../../../lib/types';
import styles from './Historial.module.css';

interface Props { onBadge: (n: number) => void; }

const ICONS: Record<string, string> = {
  gasto: '🛒', deuda: '💳', ahorro: '🎯', ingreso: '💰', servicio: '🔌',
};

const ICONS_SRV: Record<string, string> = {
  luz: '⚡', agua: '💧', gas: '🔥', internet: '📡', expensas: '🏢',
};

export function Historial({ onBadge }: Props) {
  const sesion   = usarSesion();
  const user     = sesion.usuario;
  const allUsers = sesion.todosUsuarios;
  const { mostrar: onToast } = usarToast();
  const [mode,      setMode]      = useState<'yo' | 'hogar'>('yo');
  const [movs,      setMovs]      = useState<Movimiento[]>([]);
  const [pendientes,setPendientes]= useState<Movimiento[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Pendientes compartidos
      const pend = await sbGet<Movimiento>('movimientos', {
        es_compartido: 'eq.true',
        estado       : 'eq.pendiente',
        user_id      : `neq.${user.id}`,
      });

      // Servicios vencidos/por vencer
      const hoy = new Date().toISOString().split('T')[0];
      const srv  = await sbGet<Servicio>('servicios', {
        user_id          : `eq.${user.id}`,
        estado           : 'eq.pendiente',
        fecha_vencimiento: `lte.${hoy}`,
      });

      setPendientes(pend);
      setServicios(srv);
      onBadge(pend.length + srv.length);

      // Movimientos según modo — incluimos comprometidos para mostrarlos en historial
      let all: Movimiento[];
      if (mode === 'yo') {
        const [mios, comp] = await Promise.all([
          sbGet<Movimiento>('movimientos', { user_id: `eq.${user.id}`, estado: 'neq.rechazado' }),
          sbGet<Movimiento>('movimientos', { es_compartido: 'eq.true', estado: 'eq.confirmado', user_id: `neq.${user.id}` }),
        ]);
        // Excluimos rechazados; incluimos confirmados y comprometidos del usuario
        const miosFiltrados = mios.filter(m => m.estado !== 'rechazado');
        all = [...miosFiltrados, ...comp].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 40);
      } else {
        const rows = await sbGet<Movimiento>('movimientos', { es_compartido: 'eq.true', estado: 'eq.confirmado' });
        const seen = new Set<string>();
        all = rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
      }
      setMovs(all);
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
    if (!confirm('¿Rechazás este gasto?')) return;
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

  return (
    <div>
      <PageHeader title="Historial" subtitle={`${movs.length} movimientos`} />

      {/* Toggle */}
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
        {!loading && movs.map(r => {
          const isMine    = r.user_id === user.id;
          const mShow     = r.es_compartido && !isMine ? parseFloat(r.parte_contraparte || r.mi_parte) : parseFloat(r.mi_parte);
          const esPos     = r.tipo === 'ingreso';
          const esNeu     = r.tipo === 'ahorro';
          const esCompr   = r.estado === 'comprometido';
          const color     = esCompr ? 'var(--tx3)' : esPos ? 'var(--gn)' : esNeu ? 'var(--am)' : 'var(--rd)';
          const signo     = esPos ? '+' : '-';
          const quien     = !isMine ? ` · de ${Object.values(allUsers).find((u: any) => u.id === r.user_id)?.nombre || 'Otro'}` : '';

          return (
            <div key={r.id} className={styles.movItem} style={{ opacity: esCompr ? 0.7 : 1 }}>
              <div className={styles.movIcon}>{ICONS[r.tipo] || '•'}</div>
              <div className={styles.movInfo}>
                <div className={styles.movDesc}>
                  {r.descripcion}
                  {r.es_compartido && <Badge variant="info" style={{ marginLeft: 4 }}>compartido</Badge>}
                  {esCompr && <Badge variant="default" style={{ marginLeft: 4 }}>Pendiente de resumen</Badge>}
                </div>
                <div className={styles.movMeta}>{r.fecha} · {r.categoria || r.tipo}{quien}</div>
              </div>
              <div className={styles.movAmt} style={{ color }}>{signo}{fmtK(mShow)}</div>
            </div>
          );
        })}
      </Card>
      <div style={{ height: 16 }} />
    </div>
  );
}
