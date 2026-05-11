import { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button, Input }  from '../../components/ui';
import { PageHeader }                   from '../../components/ui/PageHeader';
import { usarSesion, usarToast }        from '../../context/SesionContext';
import { sbGet }                        from '../../lib/supabase';
import { fmt, num }                     from '../../lib/utils';
import {
  aceptarDeuda,
  rechazarDeuda,
  declararPagoDeuda,
  confirmarPagoRecibido,
} from '../../lib/deudas.service';
import type { DeudaInterpersonal, PagoDeudaInterpersonal } from '../../lib/types';
import styles from './Balance.module.css';

export function Balance() {
  const { usuario, pareja }           = usarSesion();
  const { mostrar: mostrarToast }     = usarToast();

  const [deudasMeDebenAMi,  setDeudasMeDebenAMi]  = useState<DeudaInterpersonal[]>([]);
  const [deudasLeDebYo,     setDeudasLeDebYo]      = useState<DeudaInterpersonal[]>([]);
  const [cargando,          setCargando]            = useState(true);

  // Estado local para flujo de pago del deudor
  const [pagandoId,  setPagandoId]  = useState<string | null>(null);
  const [montoPago,  setMontoPago]  = useState('');

  // ✅ Selección masiva para PAGO de deudas (yo soy deudor)
  const [seleccionPago,     setSeleccionPago]     = useState<Set<string>>(new Set());
  const [pagandoMasivo,     setPagandoMasivo]     = useState(false);
  const [montoPagoMasivo,   setMontoPagoMasivo]   = useState('');

  // ✅ Selección masiva para COBRO de deudas (yo soy acreedor)
  const [seleccionCobro,    setSeleccionCobro]    = useState<Set<string>>(new Set());

  // Expandible para ver detalles de cada deuda
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    if (!pareja) { setCargando(false); return; }
    setCargando(true);
    try {
      const [aMiFavor, queDebemos] = await Promise.all([
        sbGet<DeudaInterpersonal>('deudas_interpersonales', {
          acreedor_id: `eq.${usuario.id}`,
          estado     : 'neq.pagado',
        }, 0),
        sbGet<DeudaInterpersonal>('deudas_interpersonales', {
          deudor_id: `eq.${usuario.id}`,
          estado   : 'neq.pagado',
        }, 0),
      ]);
      setDeudasMeDebenAMi(aMiFavor);
      setDeudasLeDebYo(queDebemos);
    } catch {
      mostrarToast('Error al cargar el balance', 'err');
    } finally { setCargando(false); }
  }, [usuario.id, pareja, mostrarToast]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Cálculo del neto (excluye por_aceptar — no aceptadas aún) ──
  const totalAMiFavor = deudasMeDebenAMi
    .filter(d => d.estado !== 'por_aceptar')
    .reduce((a, d) => a + num(d.monto_total) - num(d.monto_pagado), 0);

  const totalQueDebYo = deudasLeDebYo
    .filter(d => d.estado !== 'por_aceptar')
    .reduce((a, d) => a + num(d.monto_total) - num(d.monto_pagado), 0);

  const neto         = totalAMiFavor - totalQueDebYo;
  const yoSoyAcreedor = neto > 0;
  const estaIgual     = neto === 0;

  // ── Grupos por estado ──────────────────────────────────────
  const porAceptar   = deudasLeDebYo.filter(d => d.estado === 'por_aceptar');
  const pendientes   = deudasLeDebYo.filter(d => d.estado === 'pendiente' || d.estado === 'parcial');
  const porConfirmar = deudasLeDebYo.filter(d => d.estado === 'por_confirmar');

  // Las que me deben y están esperando que yo confirme el pago
  const cobrosAPorConfirmar = deudasMeDebenAMi.filter(d => d.estado === 'por_confirmar');
  const cobrosActivos       = deudasMeDebenAMi.filter(d =>
    d.estado === 'pendiente' || d.estado === 'parcial'
  );
  const cobrosPoAceptar     = deudasMeDebenAMi.filter(d => d.estado === 'por_aceptar');

  if (!pareja) {
    return (
      <div>
        <PageHeader title="Balance" subtitle="Estado financiero entre ustedes" />
        <div className={styles.vacio}>Sin pareja configurada en el sistema.</div>
      </div>
    );
  }

  async function handleAceptar(deuda: DeudaInterpersonal) {
    try {
      await aceptarDeuda(deuda.id);
      mostrarToast('Deuda aceptada ✓');
      cargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  async function handleRechazar(deuda: DeudaInterpersonal) {
    try {
      await rechazarDeuda(deuda.id);
      mostrarToast('Deuda rechazada');
      cargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  async function handleDeclararPago(deuda: DeudaInterpersonal) {
    const monto = num(montoPago) || (num(deuda.monto_total) - num(deuda.monto_pagado));
    if (monto <= 0) return;
    try {
      // ✅ FIX: declararPagoDeuda NO acepta deudorId
      await declararPagoDeuda({
        deudaId : deuda.id,
        monto   : monto,
      });
      mostrarToast('Pago declarado ✓');
      setPagandoId(null);
      setMontoPago('');
      cargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  async function handleConfirmarCobro(pago: PagoDeudaInterpersonal, deudaId: string) {
    try {
      await confirmarPagoRecibido({
        deudaId   : deudaId,
        pagoId    : pago.id,
        monto     : num(pago.monto),
        acreedorId: usuario.id,
      });
      mostrarToast('Cobro confirmado ✓');
      cargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  function etiquetaOrigen(origen: string) {
    if (origen === 'gasto')   return 'Gasto compartido';
    if (origen === 'resumen') return 'Resumen de tarjeta';
    if (origen === 'manual')  return 'Deuda explícita';
    return origen;
  }

  // ✅ Selección masiva de PAGOS (yo deudor)
  function toggleSeleccionPago(id: string) {
    setSeleccionPago(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (next.size === 0) setPagandoMasivo(false);
      return next;
    });
  }

  const deudasSeleccionadasPago = pendientes.filter(d => seleccionPago.has(d.id));
  const totalSeleccionadoPago = deudasSeleccionadasPago.reduce((a, d) => 
    a + num(d.monto_total) - num(d.monto_pagado), 0
  );

  async function pagarMasivo() {
    const montoPago = num(montoPagoMasivo) || totalSeleccionadoPago;
    if (!montoPago || seleccionPago.size === 0) return;

    try {
      let restante = montoPago;
      for (const deuda of deudasSeleccionadasPago) {
        if (restante <= 0) break;
        const saldo = num(deuda.monto_total) - num(deuda.monto_pagado);
        const pagar = Math.min(restante, saldo);
        
        // ✅ FIX: declararPagoDeuda NO acepta deudorId
        await declararPagoDeuda({
          deudaId : deuda.id,
          monto   : pagar,
        });
        
        restante -= pagar;
      }
      
      mostrarToast(`Pago masivo registrado ✓ — ${fmt(montoPago)}`);
      setPagandoMasivo(false);
      setMontoPagoMasivo('');
      setSeleccionPago(new Set());
      cargar();
    } catch {
      mostrarToast('Error en pago masivo', 'err');
    }
  }

  // ✅ Selección masiva de COBROS (yo acreedor)
  function toggleSeleccionCobro(id: string) {
    setSeleccionCobro(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const cobrosSeleccionados = cobrosAPorConfirmar.filter(d => seleccionCobro.has(d.id));
  const totalCobrosSeleccionados = cobrosSeleccionados.reduce((a, d) => 
    a + num(d.monto_total) - num(d.monto_pagado), 0
  );

  async function cobrarMasivo() {
    if (seleccionCobro.size === 0) return;

    try {
      // Para cada deuda seleccionada, confirmar sus pagos pendientes
      for (const deuda of cobrosSeleccionados) {
        const pagos = await sbGet<PagoDeudaInterpersonal>('pagos_deuda_interpersonal', {
          deuda_id  : `eq.${deuda.id}`,
          confirmado: 'eq.false',
        }, 0);

        for (const pago of pagos) {
          await confirmarPagoRecibido({
            deudaId   : deuda.id,
            pagoId    : pago.id,
            monto     : num(pago.monto),
            acreedorId: usuario.id,
          });
        }
      }
      
      mostrarToast(`Cobro masivo confirmado ✓ — ${seleccionCobro.size} deudas`);
      setSeleccionCobro(new Set());
      cargar();
    } catch {
      mostrarToast('Error en cobro masivo', 'err');
    }
  }

  // Toggle expandir/contraer
  function toggleExpandir(id: string) {
    setExpandidas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (cargando) {
    return (
      <div>
        <PageHeader title="Balance" subtitle="Estado financiero entre ustedes" />
        <div className={styles.cargando}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Balance" subtitle={`Entre ${usuario.nombre} y ${pareja.nombre}`} />

      {/* Tarjeta de neto */}
      <Card className={styles.cardNeto}>
        <div className={styles.netoIcono}>
          {estaIgual ? '🤝' : yoSoyAcreedor ? '💰' : '💸'}
        </div>
        <div className={styles.netoTitulo}>
          {estaIgual ? 'Están al día' : yoSoyAcreedor ? `${pareja.nombre} te debe` : `Le debés a ${pareja.nombre}`}
        </div>
        <div className={`${styles.netoMonto} ${estaIgual ? '' : yoSoyAcreedor ? styles.aFavor : styles.enContra}`}>
          {fmt(Math.abs(neto))}
        </div>
        <div className={styles.netoSub}>
          {estaIgual 
            ? 'No hay deudas pendientes entre ustedes'
            : `Neto del balance interpersonal`
          }
        </div>
      </Card>

      <div>
        {/* ── SECCIÓN: Deudas que YO debo ─────────────────── */}

        {/* 1. Por aceptar */}
        {porAceptar.length > 0 && (
          <>
            <div className={styles.seccion} style={{ color: 'var(--am)' }}>
              ⏳ Por aceptar — {pareja.nombre} cargó estos gastos
            </div>
            <Card className={styles.cardLista}>
              {porAceptar.map(d => (
                <div key={d.id} className={styles.filaDeuda}>
                  <div className={styles.filaContenido}>
                    <div className={styles.filaInfo}>
                      <div className={styles.filaDesc}>{d.descripcion}</div>
                      <div className={styles.filaMeta}>
                        {new Date(d.created_at).toLocaleDateString('es-AR')}
                        {' · '}<span className={styles.origen}>{etiquetaOrigen(d.origen)}</span>
                      </div>
                    </div>
                    <div className={styles.filaDerecha}>
                      <div className={styles.filaMonto} style={{ color: 'var(--am)' }}>
                        {fmt(num(d.monto_total))}
                      </div>
                      <Badge variant="warning">Pendiente</Badge>
                    </div>
                  </div>
                  <div className={styles.accionesDeuda}>
                    <Button variant="success" size="sm" fullWidth onClick={() => handleAceptar(d)}>
                      ✓ Aceptar
                    </Button>
                    <Button variant="danger" size="sm" fullWidth onClick={() => handleRechazar(d)}>
                      ✕ Rechazar
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        {/* 2. Pendientes — aceptadas, aún sin pagar */}
        {pendientes.length > 0 && (
          <>
            <div className={styles.seccion} style={{ color: 'var(--rd)' }}>
              🔴 Le debés a {pareja.nombre} — {fmt(totalQueDebYo)}
              {seleccionPago.size > 0 && ` · ${seleccionPago.size} seleccionadas`}
            </div>
            <Card className={styles.cardLista}>
              {pendientes.map(d => {
                const saldo = num(d.monto_total) - num(d.monto_pagado);
                const esExpandida = expandidas.has(d.id);
                
                return (
                  <div key={d.id} className={styles.filaDeuda}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={seleccionPago.has(d.id)}
                      onChange={() => toggleSeleccionPago(d.id)}
                    />
                    
                    <div className={styles.filaContenido}>
                      <div className={styles.filaInfo} onClick={() => toggleExpandir(d.id)}>
                        <div className={styles.filaDesc}>
                          <span className={styles.expandIcon}>{esExpandida ? '▼' : '▶'}</span>
                          {d.descripcion}
                        </div>
                        <div className={styles.filaMeta}>
                          {new Date(d.created_at).toLocaleDateString('es-AR')}
                          {' · '}<span className={styles.origen}>{etiquetaOrigen(d.origen)}</span>
                        </div>
                      </div>
                      <div className={styles.filaDerecha}>
                        <div className={styles.filaMonto} style={{ color: 'var(--rd)' }}>{fmt(saldo)}</div>
                        {d.estado === 'parcial' && <Badge variant="warning">Parcial</Badge>}
                      </div>
                    </div>

                    {esExpandida && (
                      <div className={styles.expandido}>
                        <div className={styles.expandidoRow}>
                          <span className={styles.expandidoLabel}>Monto total:</span>
                          <span className={styles.expandidoValor}>{fmt(num(d.monto_total))}</span>
                        </div>
                        <div className={styles.expandidoRow}>
                          <span className={styles.expandidoLabel}>Pagado:</span>
                          <span className={styles.expandidoValor}>{fmt(num(d.monto_pagado))}</span>
                        </div>
                        <div className={styles.expandidoRow}>
                          <span className={styles.expandidoLabel}>Saldo:</span>
                          <span className={`${styles.expandidoValor} ${styles.expandidoDestacado}`}>
                            {fmt(saldo)}
                          </span>
                        </div>
                        {d.origen && (
                          <div className={styles.expandidoRow}>
                            <span className={styles.expandidoLabel}>Origen:</span>
                            <span className={styles.expandidoValor}>{etiquetaOrigen(d.origen)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {pagandoId === d.id ? (
                      <div className={styles.pagoInline}>
                        <Input
                          type="number"
                          placeholder={`Máx ${fmt(saldo)}`}
                          value={montoPago}
                          onChange={e => setMontoPago(e.target.value)}
                          fullWidth
                          autoFocus
                        />
                        <div className={styles.accionesDeuda}>
                          <Button variant="success" size="sm" fullWidth onClick={() => handleDeclararPago(d)}>
                            Declarar pago
                          </Button>
                          <Button variant="secondary" size="sm" fullWidth onClick={() => { setPagandoId(null); setMontoPago(''); }}>
                            Cancelar
                          </Button>
                        </div>
                        <button
                          className={styles.botonTotal}
                          onClick={() => { setMontoPago(String(saldo)); }}
                        >
                          Pagar total ({fmt(saldo)})
                        </button>
                      </div>
                    ) : (
                      <Button variant="primary" fullWidth onClick={() => { setPagandoId(d.id); setMontoPago(''); }}>
                        Registrar pago
                      </Button>
                    )}
                  </div>
                );
              })}
            </Card>
          </>
        )}

        {/* 3. Por confirmar */}
        {porConfirmar.length > 0 && (
          <>
            <div className={styles.seccion} style={{ color: 'var(--ac)' }}>
              🕐 Esperando confirmación de {pareja.nombre}
            </div>
            <Card className={styles.cardLista}>
              {porConfirmar.map(d => (
                <div key={d.id} className={styles.filaDeuda}>
                  <div className={styles.filaContenido}>
                    <div className={styles.filaInfo}>
                      <div className={styles.filaDesc}>{d.descripcion}</div>
                      <div className={styles.filaMeta}>Declaraste que pagaste — aguardando confirmación</div>
                    </div>
                    <div className={styles.filaDerecha}>
                      <div className={styles.filaMonto} style={{ color: 'var(--ac)' }}>
                        {fmt(num(d.monto_total) - num(d.monto_pagado))}
                      </div>
                      <Badge variant="info">En revisión</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        {/* ── SECCIÓN: Lo que me deben A MÍ ──────────────── */}

        {/* 1. Gastos enviados por aceptar */}
        {cobrosPoAceptar.length > 0 && (
          <>
            <div className={styles.seccion} style={{ color: 'var(--tx3)' }}>
              ⏳ Enviados — esperando que {pareja.nombre} acepte
            </div>
            <Card className={styles.cardLista}>
              {cobrosPoAceptar.map(d => (
                <div key={d.id} className={styles.filaDeuda}>
                  <div className={styles.filaContenido}>
                    <div className={styles.filaInfo}>
                      <div className={styles.filaDesc}>{d.descripcion}</div>
                      <div className={styles.filaMeta}>
                        {new Date(d.created_at).toLocaleDateString('es-AR')}
                        {' · '}<span className={styles.origen}>{etiquetaOrigen(d.origen)}</span>
                      </div>
                    </div>
                    <div className={styles.filaDerecha}>
                      <div className={styles.filaMonto}>{fmt(num(d.monto_total))}</div>
                      <Badge variant="info">Sin aceptar</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        {/* 2. Activos — aceptados esperando pago */}
        {cobrosActivos.length > 0 && (
          <>
            <div className={styles.seccion} style={{ color: 'var(--gn)' }}>
              🟢 {pareja.nombre} te debe — {fmt(totalAMiFavor)}
            </div>
            <Card className={styles.cardLista}>
              {cobrosActivos.map(d => {
                const saldo = num(d.monto_total) - num(d.monto_pagado);
                const esExpandida = expandidas.has(d.id);

                return (
                  <div key={d.id} className={styles.filaDeuda}>
                    <div className={styles.filaContenido}>
                      <div className={styles.filaInfo} onClick={() => toggleExpandir(d.id)}>
                        <div className={styles.filaDesc}>
                          <span className={styles.expandIcon}>{esExpandida ? '▼' : '▶'}</span>
                          {d.descripcion}
                        </div>
                        <div className={styles.filaMeta}>
                          {new Date(d.created_at).toLocaleDateString('es-AR')}
                          {' · '}<span className={styles.origen}>{etiquetaOrigen(d.origen)}</span>
                        </div>
                      </div>
                      <div className={styles.filaDerecha}>
                        <div className={styles.filaMonto} style={{ color: 'var(--gn)' }}>{fmt(saldo)}</div>
                        {d.estado === 'parcial' && <Badge variant="warning">Parcial</Badge>}
                      </div>
                    </div>

                    {esExpandida && (
                      <div className={styles.expandido}>
                        <div className={styles.expandidoRow}>
                          <span className={styles.expandidoLabel}>Monto total:</span>
                          <span className={styles.expandidoValor}>{fmt(num(d.monto_total))}</span>
                        </div>
                        <div className={styles.expandidoRow}>
                          <span className={styles.expandidoLabel}>Pagado:</span>
                          <span className={styles.expandidoValor}>{fmt(num(d.monto_pagado))}</span>
                        </div>
                        <div className={styles.expandidoRow}>
                          <span className={styles.expandidoLabel}>Saldo:</span>
                          <span className={`${styles.expandidoValor} ${styles.expandidoDestacado}`}>
                            {fmt(saldo)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </>
        )}

        {/* 3. ✅ Por confirmar — checkbox para cobro masivo */}
        {cobrosAPorConfirmar.length > 0 && (
          <>
            <div className={styles.seccion} style={{ color: 'var(--am)' }}>
              ⏰ Por confirmar — {pareja.nombre} declaró que pagó
              {seleccionCobro.size > 0 && ` · ${seleccionCobro.size} seleccionadas`}
            </div>
            <Card className={styles.cardLista}>
              {cobrosAPorConfirmar.map(d => {
                // ✅ FIX: Usar componente separado para evitar hooks en map
                return <CobroItem key={d.id} deuda={d} 
                  expandidas={expandidas}
                  seleccionCobro={seleccionCobro}
                  toggleExpandir={toggleExpandir}
                  toggleSeleccionCobro={toggleSeleccionCobro}
                  handleConfirmarCobro={handleConfirmarCobro}
                />;
              })}
            </Card>
          </>
        )}
      </div>

      {/* ✅ Footer flotante para PAGO masivo */}
      {seleccionPago.size > 0 && (
        <div className={styles.footerFlotante}>
          <div className={styles.footerContenido}>
            <div className={styles.footerInfo}>
              <div className={styles.footerCantidad}>{seleccionPago.size} deudas seleccionadas</div>
              <div className={styles.footerTotal}>Total: {fmt(totalSeleccionadoPago)}</div>
            </div>
            
            {pagandoMasivo ? (
              <div className={styles.footerAcciones}>
                <Input
                  type="number"
                  placeholder={fmt(totalSeleccionadoPago)}
                  value={montoPagoMasivo}
                  onChange={e => setMontoPagoMasivo(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button variant="success" size="sm" onClick={pagarMasivo}>
                  Pagar
                </Button>
                <Button variant="secondary" size="sm" onClick={() => {
                  setPagandoMasivo(false);
                  setMontoPagoMasivo('');
                }}>
                  ✕
                </Button>
              </div>
            ) : (
              <div className={styles.footerAcciones}>
                <Button variant="primary" size="sm" onClick={() => setPagandoMasivo(true)}>
                  Pagar seleccionadas
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSeleccionPago(new Set())}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ✅ Footer flotante para COBRO masivo */}
      {seleccionCobro.size > 0 && (
        <div className={styles.footerFlotante}>
          <div className={styles.footerContenido}>
            <div className={styles.footerInfo}>
              <div className={styles.footerCantidad}>{seleccionCobro.size} cobros seleccionados</div>
              <div className={styles.footerTotal}>Total: {fmt(totalCobrosSeleccionados)}</div>
            </div>
            
            <div className={styles.footerAcciones}>
              <Button variant="success" size="sm" onClick={cobrarMasivo}>
                ✓ Confirmar {seleccionCobro.size} cobro{seleccionCobro.size > 1 ? 's' : ''}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSeleccionCobro(new Set())}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ✅ Componente separado para evitar hooks en map
function CobroItem({ 
  deuda, 
  expandidas, 
  seleccionCobro, 
  toggleExpandir, 
  toggleSeleccionCobro,
  handleConfirmarCobro 
}: {
  deuda: DeudaInterpersonal;
  expandidas: Set<string>;
  seleccionCobro: Set<string>;
  toggleExpandir: (id: string) => void;
  toggleSeleccionCobro: (id: string) => void;
  handleConfirmarCobro: (pago: PagoDeudaInterpersonal, deudaId: string) => Promise<void>;
}) {
  const [pagos, setPagos] = useState<PagoDeudaInterpersonal[]>([]);

  useEffect(() => {
    sbGet<PagoDeudaInterpersonal>('pagos_deuda_interpersonal', {
      deuda_id  : `eq.${deuda.id}`,
      confirmado: 'eq.false',
    }, 0).then(setPagos);
  }, [deuda.id]);

  const esExpandida = expandidas.has(deuda.id);

  return (
    <div className={styles.filaDeuda}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={seleccionCobro.has(deuda.id)}
        onChange={() => toggleSeleccionCobro(deuda.id)}
      />

      <div className={styles.filaContenido}>
        <div className={styles.filaInfo} onClick={() => toggleExpandir(deuda.id)}>
          <div className={styles.filaDesc}>
            <span className={styles.expandIcon}>{esExpandida ? '▼' : '▶'}</span>
            {deuda.descripcion}
          </div>
          <div className={styles.filaMeta}>
            {pagos.length > 0
              ? `Declaró ${fmt(pagos.reduce((s, p) => s + num(p.monto), 0))} — ¿confirmar?`
              : 'Cargando pagos...'
            }
          </div>
        </div>
        <div className={styles.filaDerecha}>
          <div className={styles.filaMonto} style={{ color: 'var(--am)' }}>
            {fmt(num(deuda.monto_total) - num(deuda.monto_pagado))}
          </div>
          <Badge variant="warning">A confirmar</Badge>
        </div>
      </div>

      {esExpandida && (
        <div className={styles.expandido}>
          <div className={styles.expandidoRow}>
            <span className={styles.expandidoLabel}>Monto total:</span>
            <span className={styles.expandidoValor}>{fmt(num(deuda.monto_total))}</span>
          </div>
          <div className={styles.expandidoRow}>
            <span className={styles.expandidoLabel}>Pagado:</span>
            <span className={styles.expandidoValor}>{fmt(num(deuda.monto_pagado))}</span>
          </div>
          <div className={styles.expandidoRow}>
            <span className={styles.expandidoLabel}>Saldo:</span>
            <span className={`${styles.expandidoValor} ${styles.expandidoDestacado}`}>
              {fmt(num(deuda.monto_total) - num(deuda.monto_pagado))}
            </span>
          </div>
          {pagos.length > 0 && (
            <div className={styles.expandidoRow}>
              <span className={styles.expandidoLabel}>Pagos pendientes:</span>
              <span className={styles.expandidoValor}>{pagos.length}</span>
            </div>
          )}
        </div>
      )}

      {pagos.length > 0 && (
        <div className={styles.accionesDeuda}>
          {pagos.map(p => (
            <Button
              key={p.id}
              variant="success"
              size="sm"
              fullWidth
              onClick={() => handleConfirmarCobro(p, deuda.id)}
            >
              ✓ Confirmar {fmt(num(p.monto))}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
