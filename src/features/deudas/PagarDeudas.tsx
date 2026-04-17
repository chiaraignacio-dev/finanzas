import { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button, Input } from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { sbGet, sbPatch, sbPost } from '../../lib/supabase';
import { registrarPagoDeuda } from '../../lib/deudas.service';
import { fmt, FISO } from '../../lib/utils';
import type { Usuario, Servicio, ResumenTarjeta, Movimiento, DeudaInterpersonal } from '../../lib/types';
import styles from './PagarDeudas.module.css';

interface Props {
  user    : Usuario;
  allUsers: Record<string, Usuario>;
  onToast : (msg: string, type?: 'ok' | 'err' | 'warn') => void;
  onBadge : (n: number) => void;
}

const ICONS_SRV: Record<string, string> = {
  luz: '⚡', agua: '💧', gas: '🔥', internet: '📡', expensas: '🏢',
};

export function PagarDeudas({ user, allUsers, onToast, onBadge }: Props) {
  const [resumenes,     setResumenes]     = useState<ResumenTarjeta[]>([]);
  const [servicios,     setServicios]     = useState<Servicio[]>([]);
  const [deudasProp,    setDeudasProp]    = useState<Movimiento[]>([]);
  // Deudas que YO le debo a mi pareja (soy el deudor)
  const [deudasQueDebp, setDeudasQueDebp] = useState<DeudaInterpersonal[]>([]);
  // Deudas que mi pareja me debe a mí (soy acreedor) — para confirmar cobros
  const [deudasAFavor,  setDeudasAFavor]  = useState<DeudaInterpersonal[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [pagando,       setPagando]       = useState<string | null>(null);
  const [montoPago,     setMontoPago]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, srv, dvs, interp_debo, interp_favor] = await Promise.all([
        sbGet<ResumenTarjeta>('resumenes_tarjeta', {
          user_id   : `eq.${user.id}`,
          estado    : 'neq.pagado',
          es_vigente: 'eq.true',
        }),
        sbGet<Servicio>('servicios', {
          user_id: `eq.${user.id}`,
          estado  : 'eq.pendiente',
        }),
        sbGet<Movimiento>('movimientos', {
          user_id : `eq.${user.id}`,
          tipo    : 'eq.deuda',
          estado  : 'eq.pendiente',
          es_deuda: 'eq.true',
        }),
        // Deudas interpersonales donde YO soy el deudor
        sbGet<DeudaInterpersonal>('deudas_interpersonales', {
          deudor_id: `eq.${user.id}`,
          estado   : 'neq.pagado',
        }),
        // Deudas interpersonales donde YO soy el acreedor (me deben)
        sbGet<DeudaInterpersonal>('deudas_interpersonales', {
          acreedor_id: `eq.${user.id}`,
          estado     : 'neq.pagado',
        }),
      ]);

      setResumenes(res);
      setServicios(srv);
      setDeudasProp(dvs);
      setDeudasQueDebp(interp_debo);
      setDeudasAFavor(interp_favor);
      onBadge(res.length + srv.length + dvs.length + interp_debo.length);
    } finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  // ── Pagar resumen de tarjeta ───────────────────────
  async function pagarResumen(resumen: ResumenTarjeta, monto: number) {
    const saldo   = parseFloat(resumen.monto_total) - parseFloat(resumen.monto_pagado);
    const efectivo = Math.min(monto, saldo);
    const nuevo    = parseFloat(resumen.monto_pagado) + efectivo;
    const estado   = parseFloat(resumen.monto_total) - nuevo <= 0 ? 'pagado' : 'parcial';
    try {
      await sbPatch('resumenes_tarjeta', resumen.id, { monto_pagado: nuevo, estado });
      await sbPost('movimientos', {
        fecha: FISO, tipo: 'deuda',
        descripcion: `Pago ${resumen.tarjeta} ${resumen.periodo}${estado === 'pagado' ? ' — total' : ' — parcial'}`,
        categoria: 'Deuda tarjeta', medio_pago: resumen.tarjeta,
        division: 'personal', tipo_division: 'personal',
        monto_total: efectivo, monto_pagado: efectivo, mi_parte: efectivo,
        parte_usuario: efectivo, parte_contraparte: 0,
        es_deuda: true, es_ahorro: false, en_cuotas: false,
        user_id: user.id, es_compartido: false, estado: 'confirmado',
      });
      onToast(estado === 'pagado' ? `${resumen.tarjeta} cancelado ✓` : 'Pago parcial registrado ✓');
      setPagando(null); setMontoPago(''); load();
    } catch { onToast('Error al registrar el pago', 'err'); }
  }

  // ── Pagar servicio ────────────────────────────────
  async function pagarServicio(srv: Servicio) {
    try {
      await sbPatch('servicios', srv.id, { estado: 'pagado', pagado_en: new Date().toISOString(), quien_pago: 'yo' });
      await sbPost('movimientos', {
        fecha: FISO, tipo: 'deuda',
        descripcion: `Pago ${srv.servicio} ${srv.mes} ${srv.anio}`,
        categoria: 'Servicios', medio_pago: 'contado',
        division: 'personal', tipo_division: 'personal',
        monto_total: parseFloat(srv.mi_parte), monto_pagado: parseFloat(srv.mi_parte),
        mi_parte: parseFloat(srv.mi_parte), parte_usuario: parseFloat(srv.mi_parte), parte_contraparte: 0,
        es_deuda: true, es_ahorro: false, en_cuotas: false,
        user_id: user.id, es_compartido: false, estado: 'confirmado',
      });
      onToast(`${srv.servicio} pagado ✓`); load();
    } catch { onToast('Error', 'err'); }
  }

  // ── Pagar deuda explícita propia ──────────────────
  async function pagarDeudaPropia(deuda: Movimiento, monto: number) {
    const saldo   = parseFloat(deuda.monto_total) - parseFloat(deuda.monto_pagado || '0');
    const efectivo = Math.min(monto, saldo);
    const nuevo    = parseFloat(deuda.monto_pagado || '0') + efectivo;
    const estado   = parseFloat(deuda.monto_total) - nuevo <= 0 ? 'confirmado' : 'parcial';
    try {
      await sbPatch('movimientos', deuda.id, { monto_pagado: nuevo, estado });
      if (efectivo < saldo) {
        await sbPost('movimientos', {
          fecha: FISO, tipo: 'deuda',
          descripcion: `Pago parcial: ${deuda.descripcion}`,
          categoria: 'Deuda', medio_pago: 'contado',
          division: 'personal', tipo_division: 'personal',
          monto_total: efectivo, monto_pagado: efectivo, mi_parte: efectivo,
          parte_usuario: efectivo, parte_contraparte: 0,
          es_deuda: true, es_ahorro: false, en_cuotas: false,
          user_id: user.id, es_compartido: false, estado: 'confirmado',
        });
      }
      onToast(estado === 'confirmado' ? 'Deuda cancelada ✓' : 'Pago parcial ✓');
      setPagando(null); setMontoPago(''); load();
    } catch { onToast('Error', 'err'); }
  }

  // ── Pagar deuda interpersonal (soy deudor) ────────
  async function pagarDeudaInterpersonal(deuda: DeudaInterpersonal, monto: number) {
    try {
      await registrarPagoDeuda({ deudaId: deuda.id, monto, notas: `Pago desde app ${FISO}` });
      onToast('Pago registrado — esperando confirmación de ' + (allUsers[deuda.acreedor_id]?.nombre || 'tu pareja'));
      setPagando(null); setMontoPago(''); load();
    } catch { onToast('Error', 'err'); }
  }

  // ── Confirmar cobro (soy acreedor) ────────────────
  async function confirmarCobro(deuda: DeudaInterpersonal, montoCobrado: number) {
    const saldo         = parseFloat(deuda.monto_total) - parseFloat(deuda.monto_pagado);
    const efectivo      = Math.min(montoCobrado, saldo);
    const nuevoMontoPag = parseFloat(deuda.monto_pagado) + efectivo;
    const nuevoSaldo    = parseFloat(deuda.monto_total) - nuevoMontoPag;
    const nuevoEstado   = nuevoSaldo <= 0 ? 'pagado' : 'parcial';
    try {
      await sbPost('ingresos', {
        user_id       : user.id,
        descripcion   : `Cobro: ${deuda.descripcion}`,
        monto         : efectivo,
        tipo          : 'extra',
        fecha_esperada: FISO,
        fecha_recibido: FISO,
        recibido      : true,
        recurrente    : false,
      });
      await sbPatch('deudas_interpersonales', deuda.id, {
        monto_pagado: nuevoMontoPag,
        estado      : nuevoEstado,
      });
      onToast(nuevoEstado === 'pagado' ? 'Cobro total confirmado ✓' : `Cobro parcial de ${fmt(efectivo)} confirmado ✓`);
      setPagando(null); setMontoPago('');
      load();
    } catch { onToast('Error', 'err'); }
  }

  const totalPendiente =
    resumenes.reduce((a, r) => a + parseFloat(r.monto_total) - parseFloat(r.monto_pagado), 0) +
    servicios.reduce((a, s) => a + parseFloat(s.mi_parte || '0'), 0) +
    deudasProp.reduce((a, d) => a + parseFloat(d.monto_total) - parseFloat(d.monto_pagado || '0'), 0) +
    deudasQueDebp.reduce((a, d) => a + parseFloat(d.monto_total) - parseFloat(d.monto_pagado), 0);

  function PagoInline({ id, saldo, onConfirm }: { id: string; saldo: number; onConfirm: (m: number) => void }) {
    return (
      <div className={styles.pagoInline}>
        <Input
          type="number" placeholder={`Máx ${fmt(saldo)}`}
          value={pagando === id ? montoPago : ''}
          onChange={e => setMontoPago(e.target.value)}
          fullWidth autoFocus
        />
        <div className={styles.pagoActions}>
          <Button variant="success" size="sm" style={{ flex: 1 }}
            onClick={() => { const m = parseFloat(montoPago); if (m > 0) onConfirm(m); }}>
            Confirmar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setPagando(null); setMontoPago(''); }}>
            Cancelar
          </Button>
        </div>
        <button className={styles.totalBtn} onClick={() => onConfirm(saldo)}>
          Pagar total ({fmt(saldo)})
        </button>
      </div>
    );
  }


  return (
    <div>
      <PageHeader title="Deudas" subtitle="Todo lo pendiente de pago" />

      {!loading && totalPendiente > 0 && (
        <div className={styles.totalBanner}>
          <div className={styles.totalLabel}>Total que debo</div>
          <div className={styles.totalAmt}>{fmt(totalPendiente)}</div>
        </div>
      )}

      {/* Deudas a mi favor — cobros pendientes */}
      {deudasAFavor.length > 0 && (
        <>
          <div className={styles.slab} style={{ color: 'var(--gn)' }}>💚 Me deben</div>
          {deudasAFavor.map(d => {
            const saldo   = parseFloat(d.monto_total) - parseFloat(d.monto_pagado);
            const deudor  = Object.values(allUsers).find(u => u.id === d.deudor_id);
            return (
              <Card key={d.id} className={styles.deudaCard} style={{ borderColor: 'rgba(16,185,129,0.35)' }}>
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.cardTitle}>💚 {deudor?.nombre || 'Tu pareja'} te debe</div>
                    <div className={styles.cardMeta}>{d.descripcion}</div>
                  </div>
                  <Badge variant={d.estado === 'parcial' ? 'warning' : 'success'}>
                    {d.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                  </Badge>
                </div>
                <div className={styles.montoWrap}>
                  <div className={styles.montoLabel}>A cobrar</div>
                  <div className={styles.montoVal} style={{ color: 'var(--gn)' }}>{fmt(saldo)}</div>
                </div>
                {pagando === d.id
                  ? <PagoInline id={d.id} saldo={saldo} onConfirm={m => confirmarCobro(d, m)} />
                  : <Button variant="success" fullWidth onClick={() => setPagando(d.id)}>Registrar cobro</Button>
                }
              </Card>
            );
          })}
        </>
      )}

      {loading && <div className={styles.loading}><div className={styles.spin} /></div>}

      {!loading && resumenes.length === 0 && servicios.length === 0 &&
        deudasProp.length === 0 && deudasQueDebp.length === 0 && deudasAFavor.length === 0 && (
        <div className={styles.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div>Todo al día. Sin deudas pendientes.</div>
        </div>
      )}

      {/* Deudas interpersonales — lo que yo debo */}
      {deudasQueDebp.length > 0 && (
        <>
          <div className={styles.slab}>🤝 Deudas con tu pareja</div>
          {deudasQueDebp.map(d => {
            const saldo    = parseFloat(d.monto_total) - parseFloat(d.monto_pagado);
            const pagado   = parseFloat(d.monto_pagado);
            const total    = parseFloat(d.monto_total);
            const acreedor = Object.values(allUsers).find(u => u.id === d.acreedor_id);
            const isPagando = pagando === d.id;

            return (
              <Card key={d.id} variant="pending" className={styles.deudaCard}>
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.cardTitle}>Le debés a {acreedor?.nombre || 'tu pareja'}</div>
                    <div className={styles.cardMeta}>{d.descripcion}</div>
                  </div>
                  <Badge variant={d.estado === 'parcial' ? 'warning' : 'danger'}>
                    {d.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                  </Badge>
                </div>
                {d.estado === 'parcial' && (
                  <div className={styles.progressWrap}>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${total > 0 ? (pagado/total*100).toFixed(0) : 0}%` }} />
                    </div>
                    <div className={styles.progressLabels}>
                      <span style={{ color: 'var(--gn)' }}>Pagado {fmt(pagado)}</span>
                      <span style={{ color: 'var(--rd)' }}>Saldo {fmt(saldo)}</span>
                    </div>
                  </div>
                )}
                <div className={styles.montoWrap}>
                  <div className={styles.montoLabel}>Saldo pendiente</div>
                  <div className={styles.montoVal}>{fmt(saldo)}</div>
                </div>
                {isPagando
                  ? <PagoInline id={d.id} saldo={saldo} onConfirm={m => pagarDeudaInterpersonal(d, m)} />
                  : <Button variant="primary" fullWidth onClick={() => setPagando(d.id)}>Registrar pago</Button>
                }
              </Card>
            );
          })}
        </>
      )}

      {/* Tarjetas */}
      {resumenes.length > 0 && (
        <>
          <div className={styles.slab}>💳 Tarjetas de crédito</div>
          {resumenes.map(r => {
            const saldo    = parseFloat(r.monto_total) - parseFloat(r.monto_pagado);
            const pagado   = parseFloat(r.monto_pagado);
            const total    = parseFloat(r.monto_total);
            const isPagando = pagando === r.id;

            return (
              <Card key={r.id} variant="pending" className={styles.deudaCard}>
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.cardTitle}>💳 {r.tarjeta}</div>
                    <div className={styles.cardMeta}>
                      {r.periodo} · Vence {new Date(r.fecha_vencimiento).toLocaleDateString('es-AR')}
                      {parseFloat(r.monto_arrastrado) > 0 && (
                        <span className={styles.arrastre}> · arrastre {fmt(parseFloat(r.monto_arrastrado))}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant={r.estado === 'parcial' ? 'warning' : 'danger'}>
                    {r.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                  </Badge>
                </div>
                {r.estado === 'parcial' && (
                  <div className={styles.progressWrap}>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${total > 0 ? (pagado/total*100).toFixed(0) : 0}%` }} />
                    </div>
                    <div className={styles.progressLabels}>
                      <span style={{ color: 'var(--gn)' }}>Pagado {fmt(pagado)}</span>
                      <span style={{ color: 'var(--rd)' }}>Saldo {fmt(saldo)}</span>
                    </div>
                  </div>
                )}
                <div className={styles.montoWrap}>
                  <div className={styles.montoLabel}>Saldo pendiente</div>
                  <div className={styles.montoVal}>{fmt(saldo)}</div>
                </div>
                {isPagando
                  ? <PagoInline id={r.id} saldo={saldo} onConfirm={m => pagarResumen(r, m)} />
                  : <Button variant="primary" fullWidth onClick={() => setPagando(r.id)}>Registrar pago</Button>
                }
              </Card>
            );
          })}
        </>
      )}

      {/* Servicios */}
      {servicios.length > 0 && (
        <>
          <div className={styles.slab}>🔌 Servicios</div>
          <Card className={styles.servicioCard}>
            {servicios.map(s => (
              <div key={s.id} className={styles.servicioItem}>
                <div className={styles.servicioIcon}>{ICONS_SRV[s.servicio] || '🔌'}</div>
                <div className={styles.servicioInfo}>
                  <div className={styles.servicioName}>
                    {s.servicio.charAt(0).toUpperCase() + s.servicio.slice(1)}
                  </div>
                  <div className={styles.servicioMeta}>
                    Vence: {new Date(s.fecha_vencimiento).toLocaleDateString('es-AR')}
                    {s.es_compartido ? ' · Compartido' : ''}
                  </div>
                </div>
                <div className={styles.servicioRight}>
                  <div className={styles.servicioMonto}>{fmt(parseFloat(s.mi_parte))}</div>
                  <Button variant="success" size="sm" onClick={() => pagarServicio(s)} style={{ marginTop: 4 }}>
                    Pagar ✓
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Deudas propias explícitas */}
      {deudasProp.length > 0 && (
        <>
          <div className={styles.slab}>📌 Otras deudas</div>
          {deudasProp.map(d => {
            const saldo    = parseFloat(d.monto_total) - parseFloat(d.monto_pagado || '0');
            const pagado   = parseFloat(d.monto_pagado || '0');
            const total    = parseFloat(d.monto_total);
            const isPagando = pagando === d.id;

            return (
              <Card key={d.id} variant="pending" className={styles.deudaCard}>
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.cardTitle}>{d.descripcion}</div>
                    <div className={styles.cardMeta}>{d.fecha}</div>
                  </div>
                  <Badge variant={pagado > 0 ? 'warning' : 'danger'}>
                    {pagado > 0 ? 'Parcial' : 'Pendiente'}
                  </Badge>
                </div>
                {pagado > 0 && (
                  <div className={styles.progressWrap}>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${total > 0 ? (pagado/total*100).toFixed(0) : 0}%` }} />
                    </div>
                    <div className={styles.progressLabels}>
                      <span style={{ color: 'var(--gn)' }}>Pagado {fmt(pagado)}</span>
                      <span style={{ color: 'var(--rd)' }}>Saldo {fmt(saldo)}</span>
                    </div>
                  </div>
                )}
                <div className={styles.montoWrap}>
                  <div className={styles.montoLabel}>Saldo pendiente</div>
                  <div className={styles.montoVal}>{fmt(saldo)}</div>
                </div>
                {isPagando
                  ? <PagoInline id={d.id} saldo={saldo} onConfirm={m => pagarDeudaPropia(d, m)} />
                  : <Button variant="primary" fullWidth onClick={() => setPagando(d.id)}>Registrar pago</Button>
                }
              </Card>
            );
          })}
        </>
      )}

      <div style={{ height: 16 }} />
    </div>
  );
}
