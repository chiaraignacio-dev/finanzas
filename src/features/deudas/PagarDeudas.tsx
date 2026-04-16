import { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button, Input } from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { sbGet, sbPatch, sbPost } from '../../lib/supabase';
import { fmt } from '../../lib/utils';
import type { Usuario, Servicio, ResumenTarjeta } from '../../lib/types';
import styles from './PagarDeudas.module.css';

interface Props {
  user   : Usuario;
  onToast: (msg: string, type?: 'ok' | 'err' | 'warn') => void;
  onBadge: (n: number) => void;
}

const ICONS_SRV: Record<string, string> = {
  luz: '⚡', agua: '💧', gas: '🔥', internet: '📡', expensas: '🏢', bbva: '💳',
};

export function PagarDeudas({ user, onToast, onBadge }: Props) {
  const [resumenes,  setResumenes]  = useState<ResumenTarjeta[]>([]);
  const [servicios,  setServicios]  = useState<Servicio[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Estado para pago parcial de cada resumen
  const [pagando,    setPagando]    = useState<string | null>(null);
  const [montoPago,  setMontoPago]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, srv] = await Promise.all([
        sbGet<ResumenTarjeta>('resumenes_tarjeta', {
          user_id: `eq.${user.id}`,
          estado : 'neq.pagado',
        }),
        sbGet<Servicio>('servicios', {
          user_id: `eq.${user.id}`,
          estado : 'eq.pendiente',
        }),
      ]);
      setResumenes(res);
      setServicios(srv);
      onBadge(res.length + srv.length);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  // Pagar resumen de tarjeta (parcial o total)
  async function pagarResumen(resumen: ResumenTarjeta, montoPagado: number) {
    const saldoActual    = parseFloat(resumen.monto_total) - parseFloat(resumen.monto_pagado);
    const montoEfectivo  = Math.min(montoPagado, saldoActual);
    const nuevoMontoPagado = parseFloat(resumen.monto_pagado) + montoEfectivo;
    const nuevoSaldo       = parseFloat(resumen.monto_total) - nuevoMontoPagado;
    const nuevoEstado      = nuevoSaldo <= 0 ? 'pagado' : 'parcial';

    try {
      // Actualizar resumen
      await sbPatch('resumenes_tarjeta', resumen.id, {
        monto_pagado: nuevoMontoPagado,
        estado      : nuevoEstado,
      });

      // Registrar el pago como movimiento (descuenta del disponible)
      await sbPost('movimientos', {
        fecha            : new Date().toISOString().split('T')[0],
        tipo             : 'deuda',
        descripcion      : `Pago ${resumen.tarjeta} ${resumen.periodo}${nuevoEstado === 'pagado' ? ' (cancelado)' : ' (parcial)'}`,
        categoria        : 'Deuda',
        medio_pago       : resumen.tarjeta,
        division         : 'personal',
        tipo_division    : 'personal',
        monto_total      : montoEfectivo,
        mi_parte         : montoEfectivo,
        parte_usuario    : montoEfectivo,
        parte_contraparte: 0,
        es_deuda         : true,
        es_ahorro        : false,
        en_cuotas        : false,
        notas            : `Pago resumen ${resumen.tarjeta} ${resumen.periodo}`,
        user_id          : user.id,
        es_compartido    : false,
        estado           : 'confirmado',
      });

      onToast(nuevoEstado === 'pagado' ? `${resumen.tarjeta} cancelado ✓` : `Pago parcial registrado ✓`);
      setPagando(null);
      setMontoPago('');
      load();
    } catch {
      onToast('Error al registrar el pago', 'err');
    }
  }

  // Pagar servicio
  async function pagarServicio(srv: Servicio) {
    try {
      await sbPatch('servicios', srv.id, {
        estado    : 'pagado',
        pagado_en : new Date().toISOString(),
        quien_pago: 'yo',
      });

      // Registrar como movimiento (descuenta del disponible)
      await sbPost('movimientos', {
        fecha            : new Date().toISOString().split('T')[0],
        tipo             : 'deuda',
        descripcion      : `Pago ${srv.servicio} ${srv.mes} ${srv.anio}`,
        categoria        : 'Servicios',
        medio_pago       : 'contado',
        division         : 'personal',
        tipo_division    : 'personal',
        monto_total      : parseFloat(srv.mi_parte),
        mi_parte         : parseFloat(srv.mi_parte),
        parte_usuario    : parseFloat(srv.mi_parte),
        parte_contraparte: 0,
        es_deuda         : true,
        es_ahorro        : false,
        en_cuotas        : false,
        notas            : `Servicio: ${srv.servicio}`,
        user_id          : user.id,
        es_compartido    : false,
        estado           : 'confirmado',
      });

      onToast(`${srv.servicio} pagado ✓`);
      load();
    } catch {
      onToast('Error', 'err');
    }
  }

  const totalDeuda = resumenes.reduce((a, r) => a + parseFloat(r.monto_total) - parseFloat(r.monto_pagado), 0)
    + servicios.reduce((a, s) => a + parseFloat(s.mi_parte || '0'), 0);

  return (
    <div>
      <PageHeader title="Pagar deudas" subtitle="Todo lo pendiente de pago" />

      {/* Resumen total */}
      {!loading && (resumenes.length > 0 || servicios.length > 0) && (
        <div className={styles.totalBanner}>
          <div className={styles.totalLabel}>Total pendiente</div>
          <div className={styles.totalAmt}>{fmt(totalDeuda)}</div>
        </div>
      )}

      {loading && <div className={styles.loading}><div className={styles.spin} /></div>}

      {!loading && resumenes.length === 0 && servicios.length === 0 && (
        <div className={styles.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div>Todo al día. Sin deudas pendientes.</div>
        </div>
      )}

      {/* Tarjetas de crédito */}
      {resumenes.length > 0 && (
        <>
          <div className={styles.slab}>💳 Tarjetas de crédito</div>
          {resumenes.map(r => {
            const saldo   = parseFloat(r.monto_total) - parseFloat(r.monto_pagado);
            const pct     = (parseFloat(r.monto_pagado) / parseFloat(r.monto_total)) * 100;
            const isPagando = pagando === r.id;

            return (
              <Card key={r.id} variant="pending" className={styles.deudaCard}>
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.cardTitle}>💳 {r.tarjeta}</div>
                    <div className={styles.cardMeta}>{r.periodo} · Vence {new Date(r.fecha_vencimiento).toLocaleDateString('es-AR')}</div>
                  </div>
                  <Badge variant={r.estado === 'parcial' ? 'warning' : 'danger'}>
                    {r.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                  </Badge>
                </div>

                {/* Barra de progreso si es parcial */}
                {r.estado === 'parcial' && (
                  <div className={styles.progressWrap}>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${pct.toFixed(0)}%` }} />
                    </div>
                    <div className={styles.progressLabels}>
                      <span style={{ color: 'var(--gn)' }}>Pagado {fmt(parseFloat(r.monto_pagado))}</span>
                      <span style={{ color: 'var(--rd)' }}>Saldo {fmt(saldo)}</span>
                    </div>
                  </div>
                )}

                <div className={styles.montoWrap}>
                  <div className={styles.montoLabel}>Saldo pendiente</div>
                  <div className={styles.montoVal}>{fmt(saldo)}</div>
                </div>

                {/* Pago parcial inline */}
                {isPagando ? (
                  <div className={styles.pagoInline}>
                    <Input
                      type       ="number"
                      placeholder={`Máx ${fmt(saldo)}`}
                      value      ={montoPago}
                      onChange   ={e => setMontoPago(e.target.value)}
                      fullWidth
                      autoFocus
                    />
                    <div className={styles.pagoActions}>
                      <Button
                        variant ="success"
                        size    ="sm"
                        style   ={{ flex: 1 }}
                        onClick ={() => {
                          const m = parseFloat(montoPago);
                          if (!m || m <= 0) return;
                          pagarResumen(r, m);
                        }}
                      >
                        Confirmar pago
                      </Button>
                      <Button
                        variant ="secondary"
                        size    ="sm"
                        onClick ={() => { setPagando(null); setMontoPago(''); }}
                      >
                        Cancelar
                      </Button>
                    </div>
                    <button
                      className={styles.totalBtn}
                      onClick={() => pagarResumen(r, saldo)}
                    >
                      Pagar total ({fmt(saldo)})
                    </button>
                  </div>
                ) : (
                  <Button
                    variant ="primary"
                    fullWidth
                    onClick ={() => { setPagando(r.id); setMontoPago(''); }}
                  >
                    Registrar pago
                  </Button>
                )}
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
                <div className={styles.servicioIcon}>
                  {ICONS_SRV[s.servicio] || '🔌'}
                </div>
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
                  <Button
                    variant ="success"
                    size    ="sm"
                    onClick ={() => pagarServicio(s)}
                    style   ={{ marginTop: 4 }}
                  >
                    Pagar ✓
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      <div style={{ height: 16 }} />
    </div>
  );
}
