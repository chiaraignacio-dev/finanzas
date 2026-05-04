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
  }, [usuario.id, pareja]);

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

  // ── Grupos por estado ──────────────────────────────
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
    const monto = num(montoPago);
    if (!monto) { mostrarToast('Ingresá un monto', 'err'); return; }
    try {
      await declararPagoDeuda({ deudaId: deuda.id, monto });
      mostrarToast(`Pago declarado ✓ — esperando confirmación de ${pareja.nombre}`);
      setPagandoId(null);
      setMontoPago('');
      cargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  async function handleConfirmarCobro(deuda: DeudaInterpersonal) {
    try {
      // Buscar el pago pendiente de confirmación
      const pagos = await sbGet<PagoDeudaInterpersonal>('pagos_deuda_interpersonal', {
        deuda_id  : `eq.${deuda.id}`,
        confirmado: 'eq.false',
      }, 0);
      if (!pagos.length) { mostrarToast('No hay pago pendiente de confirmación', 'err'); return; }
      const pago = pagos[pagos.length - 1]; // el más reciente
      await confirmarPagoRecibido({
        deudaId   : deuda.id,
        pagoId    : pago.id,
        monto     : num(pago.monto),
        acreedorId: usuario.id,
      });
      mostrarToast('Pago confirmado ✓');
      cargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  return (
    <div>
      <PageHeader title="Balance" subtitle={`${usuario.nombre} y ${pareja.nombre}`} />

      {cargando && <div className={styles.cargando}><div className={styles.spinner} /></div>}

      {!cargando && (
        <>
          {/* ── Neto principal ──────────────────────── */}
          <Card className={styles.cardNeto}>
            {estaIgual ? (
              <>
                <div className={styles.netoIcono}>⚖️</div>
                <div className={styles.netoTitulo}>¡Están al día!</div>
                <div className={styles.netoSub}>No hay deudas pendientes entre ustedes.</div>
              </>
            ) : (
              <>
                <div className={styles.netoIcono}>{yoSoyAcreedor ? '💚' : '🔴'}</div>
                <div className={styles.netoTitulo}>
                  {yoSoyAcreedor
                    ? `${pareja.nombre} te debe`
                    : `Le debés a ${pareja.nombre}`}
                </div>
                <div className={`${styles.netoMonto} ${yoSoyAcreedor ? styles.aFavor : styles.enContra}`}>
                  {fmt(Math.abs(neto))}
                </div>
                <div className={styles.netoSub}>saldo neto entre todas las deudas aceptadas</div>
              </>
            )}
          </Card>

          {/* ── SECCIÓN: Deudas que YO debo ─────────── */}

          {/* 1. Por aceptar — Ignacio me mandó algo, tengo que aceptar */}
          {porAceptar.length > 0 && (
            <>
              <div className={styles.seccion} style={{ color: 'var(--am)' }}>
                ⏳ Por aceptar — {pareja.nombre} cargó estos gastos
              </div>
              <Card className={styles.cardLista}>
                {porAceptar.map(d => (
                  <div key={d.id} className={styles.filaDeuda}>
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
                    {/* Botones aceptar / rechazar */}
                    <div className={styles.accionesDeuda}>
                      <Button variant="success" size="sm" onClick={() => handleAceptar(d)}>
                        ✓ Aceptar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleRechazar(d)}>
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
              </div>
              <Card className={styles.cardLista}>
                {pendientes.map(d => {
                  const saldo = num(d.monto_total) - num(d.monto_pagado);
                  return (
                    <div key={d.id} className={styles.filaDeuda}>
                      <div className={styles.filaInfo}>
                        <div className={styles.filaDesc}>{d.descripcion}</div>
                        <div className={styles.filaMeta}>
                          {new Date(d.created_at).toLocaleDateString('es-AR')}
                          {' · '}<span className={styles.origen}>{etiquetaOrigen(d.origen)}</span>
                        </div>
                      </div>
                      <div className={styles.filaDerecha}>
                        <div className={styles.filaMonto} style={{ color: 'var(--rd)' }}>{fmt(saldo)}</div>
                        {d.estado === 'parcial' && <Badge variant="warning">Parcial</Badge>}
                      </div>
                      {/* Flujo de pago */}
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
                            <Button variant="success" size="sm" onClick={() => handleDeclararPago(d)}>
                              Declarar pago
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => { setPagandoId(null); setMontoPago(''); }}>
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

          {/* 3. Por confirmar — declaré que pagué, esperando que Ignacio confirme */}
          {porConfirmar.length > 0 && (
            <>
              <div className={styles.seccion} style={{ color: 'var(--ac)' }}>
                🕐 Esperando confirmación de {pareja.nombre}
              </div>
              <Card className={styles.cardLista}>
                {porConfirmar.map(d => (
                  <div key={d.id} className={styles.filaDeuda}>
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
                ))}
              </Card>
            </>
          )}

          {/* ── SECCIÓN: Lo que me deben A MÍ ────────── */}

          {/* 1. Gastos que mandé y están por aceptar */}
          {cobrosPoAceptar.length > 0 && (
            <>
              <div className={styles.seccion} style={{ color: 'var(--tx3)' }}>
                ⏳ Enviados — esperando que {pareja.nombre} acepte
              </div>
              <Card className={styles.cardLista}>
                {cobrosPoAceptar.map(d => (
                  <div key={d.id} className={styles.filaDeuda}>
                    <div className={styles.filaInfo}>
                      <div className={styles.filaDesc}>{d.descripcion}</div>
                      <div className={styles.filaMeta}>
                        {new Date(d.created_at).toLocaleDateString('es-AR')}
                        {' · '}<span className={styles.origen}>{etiquetaOrigen(d.origen)}</span>
                      </div>
                    </div>
                    <div className={styles.filaDerecha}>
                      <div className={styles.filaMonto} style={{ color: 'var(--tx3)' }}>
                        {fmt(num(d.monto_total))}
                      </div>
                      <Badge variant="default">Por aceptar</Badge>
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}

          {/* 2. Cobros activos — aceptadas, pendientes de cobro */}
          {cobrosActivos.length > 0 && (
            <>
              <div className={styles.seccion} style={{ color: 'var(--gn)' }}>
                💚 {pareja.nombre} te debe — {fmt(totalAMiFavor)}
              </div>
              <Card className={styles.cardLista}>
                {cobrosActivos.map(d => {
                  const saldo = num(d.monto_total) - num(d.monto_pagado);
                  return (
                    <div key={d.id} className={styles.filaDeuda}>
                      <div className={styles.filaInfo}>
                        <div className={styles.filaDesc}>{d.descripcion}</div>
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
                  );
                })}
                <div className={styles.filaTotalizadora}>
                  <span>Total a tu favor</span>
                  <span style={{ color: 'var(--gn)', fontFamily: 'var(--font-mono)' }}>{fmt(totalAMiFavor)}</span>
                </div>
              </Card>
            </>
          )}

          {/* 3. Por confirmar — Abril dice que pagó, tengo que confirmar */}
          {cobrosAPorConfirmar.length > 0 && (
            <>
              <div className={styles.seccion} style={{ color: 'var(--ac)' }}>
                ✅ {pareja.nombre} dice que pagó — confirmá vos
              </div>
              <Card className={styles.cardLista}>
                {cobrosAPorConfirmar.map(d => (
                  <div key={d.id} className={styles.filaDeuda}>
                    <div className={styles.filaInfo}>
                      <div className={styles.filaDesc}>{d.descripcion}</div>
                      <div className={styles.filaMeta}>
                        {pareja.nombre} declaró que transfirió su parte
                      </div>
                    </div>
                    <div className={styles.filaDerecha}>
                      <div className={styles.filaMonto} style={{ color: 'var(--ac)' }}>
                        {fmt(num(d.monto_total) - num(d.monto_pagado))}
                      </div>
                      <Badge variant="info">Por confirmar</Badge>
                    </div>
                    <div className={styles.accionesDeuda}>
                      <Button variant="success" fullWidth onClick={() => handleConfirmarCobro(d)}>
                        ✓ Confirmar cobro
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}

          {/* Estado vacío */}
          {deudasMeDebenAMi.length === 0 && deudasLeDebYo.length === 0 && (
            <div className={styles.vacio}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div>No hay deudas pendientes entre ustedes.</div>
            </div>
          )}
        </>
      )}
      <div style={{ height: 16 }} />
    </div>
  );
}

function etiquetaOrigen(origen: string): string {
  if (origen === 'gasto')   return 'Gasto compartido';
  if (origen === 'resumen') return 'Resumen tarjeta';
  return 'Manual';
}
