import { useEffect, useCallback }         from 'react';
import { useState }                       from 'react';
import { Card, Badge, Button, Input }     from '../../components/ui';
import { PageHeader }                     from '../../components/ui/PageHeader';
import { usarSesion, usarToast }          from '../../context/SesionContext';
import { usarPago }                       from '../../hooks/usarPago';
import { sbGet, sbPatch, sbPost }         from '../../lib/supabase';
import { registrarPagoDeuda }             from '../../lib/deudas.service';
import { fmt, obtenerFechaISO, num }      from '../../lib/utils';
import type { Servicio, ResumenTarjeta, Movimiento, DeudaInterpersonal } from '../../lib/types';
import styles                             from './PagarDeudas.module.css';

interface Props { onBadge: (n: number) => void; }

const ICONOS_SERVICIO: Record<string, string> = {
  luz: '⚡', agua: '💧', gas: '🔥', internet: '📡', expensas: '🏢',
};

export function PagarDeudas({ onBadge }: Props) {
  const { usuario, todosUsuarios }     = usarSesion();
  const { mostrar: mostrarToast }      = usarToast();
  const pago                           = usarPago();

  const [resumenes,      setResumenes]      = useState<ResumenTarjeta[]>([]);
  const [servicios,      setServicios]      = useState<Servicio[]>([]);
  const [deudasPropias,  setDeudasPropias]  = useState<Movimiento[]>([]);
  const [deudasQueDebemos, setDeudasQueDebemos] = useState<DeudaInterpersonal[]>([]);
  const [deudasANuestroFavor, setDeudasANuestroFavor] = useState<DeudaInterpersonal[]>([]);
  const [cargando,       setCargando]       = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [resumenesBD, serviciosBD, deudasBD, queDebemos, aFavor] = await Promise.all([
        sbGet<ResumenTarjeta>('resumenes_tarjeta', { user_id: `eq.${usuario.id}`, estado: 'neq.pagado', es_vigente: 'eq.true' }),
        sbGet<Servicio>('servicios',               { user_id: `eq.${usuario.id}`, estado: 'eq.pendiente' }),
        sbGet<Movimiento>('movimientos',           { user_id: `eq.${usuario.id}`, tipo: 'eq.deuda', estado: 'eq.pendiente' }),
        sbGet<DeudaInterpersonal>('deudas_interpersonales', { deudor_id:    `eq.${usuario.id}`, estado: 'neq.pagado' }),
        sbGet<DeudaInterpersonal>('deudas_interpersonales', { acreedor_id:  `eq.${usuario.id}`, estado: 'neq.pagado' }),
      ]);
      setResumenes(resumenesBD);
      setServicios(serviciosBD);
      setDeudasPropias(deudasBD);
      setDeudasQueDebemos(queDebemos);
      setDeudasANuestroFavor(aFavor);
      onBadge(resumenesBD.length + serviciosBD.length + deudasBD.length + queDebemos.length);
    } finally { setCargando(false); }
  }, [usuario.id]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Calcular saldo de un ítem ────────────────────────
  function calcularSaldo(total: string, pagado: string | undefined) {
    return num(total) - num(pagado);
  }

  // ── Pagar resumen de tarjeta ─────────────────────────
  async function pagarResumen(resumen: ResumenTarjeta, montoPagado: number) {
    const saldo    = calcularSaldo(resumen.monto_total, resumen.monto_pagado);
    const efectivo = Math.min(montoPagado, saldo);
    const nuevoPag = num(resumen.monto_pagado) + efectivo;
    const estado   = num(resumen.monto_total) - nuevoPag <= 0 ? 'pagado' : 'parcial';
    try {
      await sbPatch('resumenes_tarjeta', resumen.id, { monto_pagado: nuevoPag, estado });
      await sbPost('movimientos', {
        fecha: obtenerFechaISO(), tipo: 'deuda',
        descripcion: `Pago ${resumen.tarjeta} ${resumen.periodo}${estado === 'pagado' ? ' — total' : ' — parcial'}`,
        categoria: 'Deuda tarjeta', medio_pago: resumen.tarjeta,
        division: 'personal', monto_total: efectivo, monto_pagado: efectivo,
        mi_parte: efectivo, parte_usuario: efectivo, parte_contraparte: 0,
        en_cuotas: false, user_id: usuario.id, es_compartido: false, estado: 'confirmado',
      });
      mostrarToast(estado === 'pagado' ? `${resumen.tarjeta} cancelado ✓` : 'Pago parcial registrado ✓');
      pago.cancelarPago(); cargar();
    } catch { mostrarToast('Error al registrar el pago', 'err'); }
  }

  // ── Pagar servicio ───────────────────────────────────
  async function pagarServicio(srv: Servicio) {
    try {
      await sbPatch('servicios', srv.id, { estado: 'pagado', pagado_en: new Date().toISOString(), quien_pago: 'yo' });
      await sbPost('movimientos', {
        fecha: obtenerFechaISO(), tipo: 'deuda',
        descripcion: `Pago ${srv.servicio}`,
        categoria: 'Servicios', medio_pago: 'contado', division: 'personal',
        monto_total: num(srv.mi_parte), monto_pagado: num(srv.mi_parte),
        mi_parte: num(srv.mi_parte), parte_usuario: num(srv.mi_parte), parte_contraparte: 0,
        en_cuotas: false, user_id: usuario.id, es_compartido: false, estado: 'confirmado',
      });
      mostrarToast(`${srv.servicio} pagado ✓`); cargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  // ── Pagar deuda propia ───────────────────────────────
  async function pagarDeudaPropia(deuda: Movimiento, montoPagado: number) {
    const saldo    = calcularSaldo(deuda.monto_total, deuda.monto_pagado);
    const efectivo = Math.min(montoPagado, saldo);
    const nuevoPag = num(deuda.monto_pagado) + efectivo;
    const estado   = num(deuda.monto_total) - nuevoPag <= 0 ? 'confirmado' : 'parcial';
    try {
      await sbPatch('movimientos', deuda.id, { monto_pagado: nuevoPag, estado });
      if (efectivo < saldo) {
        await sbPost('movimientos', {
          fecha: obtenerFechaISO(), tipo: 'deuda',
          descripcion: `Pago parcial: ${deuda.descripcion}`,
          categoria: 'Deuda', medio_pago: 'contado', division: 'personal',
          monto_total: efectivo, monto_pagado: efectivo, mi_parte: efectivo,
          parte_usuario: efectivo, parte_contraparte: 0,
          en_cuotas: false, user_id: usuario.id, es_compartido: false, estado: 'confirmado',
        });
      }
      mostrarToast(estado === 'confirmado' ? 'Deuda cancelada ✓' : 'Pago parcial ✓');
      pago.cancelarPago(); cargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  // ── Pagar deuda interpersonal (soy deudor) ───────────
  async function pagarDeudaInterpersonal(deuda: DeudaInterpersonal, montoPagado: number) {
    try {
      await registrarPagoDeuda({ deudaId: deuda.id, monto: montoPagado });
      const acreedor = Object.values(todosUsuarios).find(u => u.id === deuda.acreedor_id);
      mostrarToast(`Pago registrado — esperando confirmación de ${acreedor?.nombre || 'tu pareja'}`);
      pago.cancelarPago(); cargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  // ── Confirmar cobro (soy acreedor) ───────────────────
  async function confirmarCobro(deuda: DeudaInterpersonal, montoCobrado: number) {
    const saldo    = calcularSaldo(deuda.monto_total, deuda.monto_pagado);
    const efectivo = Math.min(montoCobrado, saldo);
    const nuevoPag = num(deuda.monto_pagado) + efectivo;
    const estado   = num(deuda.monto_total) - nuevoPag <= 0 ? 'pagado' : 'parcial';
    try {
      await sbPost('ingresos', {
        user_id: usuario.id, descripcion: `Cobro: ${deuda.descripcion}`,
        monto: efectivo, tipo: 'extra',
        fecha_esperada: obtenerFechaISO(), fecha_recibido: obtenerFechaISO(),
        recibido: true, recurrente: false,
      });
      await sbPatch('deudas_interpersonales', deuda.id, { monto_pagado: nuevoPag, estado });
      mostrarToast(estado === 'pagado' ? 'Cobro total confirmado ✓' : `Cobro parcial de ${fmt(efectivo)} confirmado ✓`);
      pago.cancelarPago(); cargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  // ── Componente inline de pago ────────────────────────
  function PagoInline({ id, saldo, alConfirmar }: { id: string; saldo: number; alConfirmar: (m: number) => void }) {
    return (
      <div className={styles.pagoInline}>
        <Input
          type="number" placeholder={`Máx ${fmt(saldo)}`}
          value={pago.estaPagando(id) ? pago.montoPago : ''}
          onChange={e => pago.setMontoPago(e.target.value)}
          fullWidth autoFocus
        />
        <div className={styles.accionesPago}>
          <Button variant="success" size="sm" style={{ flex: 1 }}
            onClick={() => { const m = num(pago.montoPago); if (m > 0) alConfirmar(m); }}>
            Confirmar
          </Button>
          <Button variant="secondary" size="sm" onClick={pago.cancelarPago}>Cancelar</Button>
        </div>
        <button className={styles.botonTotal} onClick={() => alConfirmar(saldo)}>
          Pagar total ({fmt(saldo)})
        </button>
      </div>
    );
  }

  // ── Barra de progreso ────────────────────────────────
  function BarraProgreso({ pagado, total }: { pagado: number; total: number }) {
    const pct = total > 0 ? (pagado / total) * 100 : 0;
    return (
      <div className={styles.progresoWrap}>
        <div className={styles.progresoBarra}>
          <div className={styles.progresoRelleno} style={{ width: `${pct.toFixed(0)}%` }} />
        </div>
        <div className={styles.progresoEtiquetas}>
          <span style={{ color: 'var(--gn)' }}>Pagado {fmt(pagado)}</span>
          <span style={{ color: 'var(--rd)' }}>Saldo {fmt(total - pagado)}</span>
        </div>
      </div>
    );
  }

  const totalPendiente =
    resumenes.reduce((a, r) => a + calcularSaldo(r.monto_total, r.monto_pagado), 0) +
    servicios.reduce((a, s) => a + num(s.mi_parte), 0) +
    deudasPropias.reduce((a, d) => a + calcularSaldo(d.monto_total, d.monto_pagado), 0) +
    deudasQueDebemos.reduce((a, d) => a + calcularSaldo(d.monto_total, d.monto_pagado), 0);

  return (
    <div>
      <PageHeader title="Deudas" subtitle="Todo lo pendiente de pago" />

      {!cargando && totalPendiente > 0 && (
        <div className={styles.bannerTotal}>
          <div className={styles.bannerEtiqueta}>Total que debo</div>
          <div className={styles.bannerMonto}>{fmt(totalPendiente)}</div>
        </div>
      )}

      {cargando && <div className={styles.cargando}><div className={styles.spinner} /></div>}

      {/* Me deben */}
      {deudasANuestroFavor.length > 0 && (
        <>
          <div className={styles.seccion} style={{ color: 'var(--gn)' }}>💚 Me deben</div>
          {deudasANuestroFavor.map(d => {
            const saldo   = calcularSaldo(d.monto_total, d.monto_pagado);
            const deudor  = Object.values(todosUsuarios).find(u => u.id === d.deudor_id);
            return (
              <Card key={d.id} className={styles.cardDeuda} style={{ borderColor: 'rgba(32,219,144,0.35)' }}>
                <div className={styles.cardEncabezado}>
                  <div>
                    <div className={styles.cardTitulo}>💚 {deudor?.nombre || 'Tu pareja'} te debe</div>
                    <div className={styles.cardSubtitulo}>{d.descripcion}</div>
                  </div>
                  <Badge variant={d.estado === 'parcial' ? 'warning' : 'success'}>
                    {d.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                  </Badge>
                </div>
                {d.estado === 'parcial' && <BarraProgreso pagado={num(d.monto_pagado)} total={num(d.monto_total)} />}
                <div className={styles.montoWrap}>
                  <div className={styles.montoEtiqueta}>A cobrar</div>
                  <div className={styles.montoValor} style={{ color: 'var(--gn)' }}>{fmt(saldo)}</div>
                </div>
                {pago.estaPagando(d.id)
                  ? <PagoInline id={d.id} saldo={saldo} alConfirmar={m => confirmarCobro(d, m)} />
                  : <Button variant="success" fullWidth onClick={() => pago.iniciarPago(d.id)}>Registrar cobro</Button>
                }
              </Card>
            );
          })}
        </>
      )}

      {!cargando && totalPendiente === 0 && deudasANuestroFavor.length === 0 && (
        <div className={styles.vacio}><div style={{ fontSize: 32, marginBottom: 8 }}>✅</div><div>Todo al día.</div></div>
      )}

      {/* Lo que debo a mi pareja */}
      {deudasQueDebemos.length > 0 && (
        <>
          <div className={styles.seccion}>🤝 Deudas con tu pareja</div>
          {deudasQueDebemos.map(d => {
            const saldo    = calcularSaldo(d.monto_total, d.monto_pagado);
            const acreedor = Object.values(todosUsuarios).find(u => u.id === d.acreedor_id);
            return (
              <Card key={d.id} variant="pending" className={styles.cardDeuda}>
                <div className={styles.cardEncabezado}>
                  <div>
                    <div className={styles.cardTitulo}>Le debés a {acreedor?.nombre || 'tu pareja'}</div>
                    <div className={styles.cardSubtitulo}>{d.descripcion}</div>
                  </div>
                  <Badge variant={d.estado === 'parcial' ? 'warning' : 'danger'}>
                    {d.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                  </Badge>
                </div>
                {d.estado === 'parcial' && <BarraProgreso pagado={num(d.monto_pagado)} total={num(d.monto_total)} />}
                <div className={styles.montoWrap}>
                  <div className={styles.montoEtiqueta}>Saldo pendiente</div>
                  <div className={styles.montoValor}>{fmt(saldo)}</div>
                </div>
                {pago.estaPagando(d.id)
                  ? <PagoInline id={d.id} saldo={saldo} alConfirmar={m => pagarDeudaInterpersonal(d, m)} />
                  : <Button variant="primary" fullWidth onClick={() => pago.iniciarPago(d.id)}>Registrar pago</Button>
                }
              </Card>
            );
          })}
        </>
      )}

      {/* Tarjetas */}
      {resumenes.length > 0 && (
        <>
          <div className={styles.seccion}>💳 Tarjetas de crédito</div>
          {resumenes.map(r => {
            const saldo = calcularSaldo(r.monto_total, r.monto_pagado);
            return (
              <Card key={r.id} variant="pending" className={styles.cardDeuda}>
                <div className={styles.cardEncabezado}>
                  <div>
                    <div className={styles.cardTitulo}>💳 {r.tarjeta}</div>
                    <div className={styles.cardSubtitulo}>
                      {r.periodo} · Vence {new Date(r.fecha_vencimiento).toLocaleDateString('es-AR')}
                      {num(r.monto_arrastrado) > 0 && ` · arrastre ${fmt(num(r.monto_arrastrado))}`}
                    </div>
                  </div>
                  <Badge variant={r.estado === 'parcial' ? 'warning' : 'danger'}>
                    {r.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                  </Badge>
                </div>
                {r.estado === 'parcial' && <BarraProgreso pagado={num(r.monto_pagado)} total={num(r.monto_total)} />}
                <div className={styles.montoWrap}>
                  <div className={styles.montoEtiqueta}>Saldo pendiente</div>
                  <div className={styles.montoValor}>{fmt(saldo)}</div>
                </div>
                {pago.estaPagando(r.id)
                  ? <PagoInline id={r.id} saldo={saldo} alConfirmar={m => pagarResumen(r, m)} />
                  : <Button variant="primary" fullWidth onClick={() => pago.iniciarPago(r.id)}>Registrar pago</Button>
                }
              </Card>
            );
          })}
        </>
      )}

      {/* Servicios */}
      {servicios.length > 0 && (
        <>
          <div className={styles.seccion}>🔌 Servicios</div>
          <Card className={styles.cardServicios}>
            {servicios.map(s => (
              <div key={s.id} className={styles.filaServicio}>
                <div className={styles.iconoServicio}>{ICONOS_SERVICIO[s.servicio] || '🔌'}</div>
                <div className={styles.infoServicio}>
                  <div className={styles.nombreServicio}>{s.servicio.charAt(0).toUpperCase() + s.servicio.slice(1)}</div>
                  <div className={styles.metaServicio}>
                    Vence: {new Date(s.fecha_vencimiento).toLocaleDateString('es-AR')}
                    {s.es_compartido ? ' · Compartido' : ''}
                  </div>
                </div>
                <div className={styles.derechaServicio}>
                  <div className={styles.montoServicio}>{fmt(num(s.mi_parte))}</div>
                  <Button variant="success" size="sm" onClick={() => pagarServicio(s)} style={{ marginTop: 4 }}>Pagar ✓</Button>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Otras deudas */}
      {deudasPropias.length > 0 && (
        <>
          <div className={styles.seccion}>📌 Otras deudas</div>
          {deudasPropias.map(d => {
            const saldo = calcularSaldo(d.monto_total, d.monto_pagado);
            return (
              <Card key={d.id} variant="pending" className={styles.cardDeuda}>
                <div className={styles.cardEncabezado}>
                  <div>
                    <div className={styles.cardTitulo}>{d.descripcion}</div>
                    <div className={styles.cardSubtitulo}>{d.fecha}</div>
                  </div>
                  <Badge variant={num(d.monto_pagado) > 0 ? 'warning' : 'danger'}>
                    {num(d.monto_pagado) > 0 ? 'Parcial' : 'Pendiente'}
                  </Badge>
                </div>
                {num(d.monto_pagado) > 0 && <BarraProgreso pagado={num(d.monto_pagado)} total={num(d.monto_total)} />}
                <div className={styles.montoWrap}>
                  <div className={styles.montoEtiqueta}>Saldo pendiente</div>
                  <div className={styles.montoValor}>{fmt(saldo)}</div>
                </div>
                {pago.estaPagando(d.id)
                  ? <PagoInline id={d.id} saldo={saldo} alConfirmar={m => pagarDeudaPropia(d, m)} />
                  : <Button variant="primary" fullWidth onClick={() => pago.iniciarPago(d.id)}>Registrar pago</Button>
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
