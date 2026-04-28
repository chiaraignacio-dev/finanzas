import { usarSesion, usarToast } from '../../context/SesionContext';
import { useState, useEffect } from 'react';
import { Input, Select, Button, Card, Badge } from '../../components/ui';
import { sbGet, sbPost, sbPatch } from '../../lib/supabase';
import { crearDeudaInterpersonal } from '../../lib/deudas.service';
import { getGastosRecurrentes, registrarPagoGastoRecurrente, crearGastoRecurrente } from '../../lib/gastos_recurrentes.service';
import { fmt, FISO, partePorDiv, num } from '../../lib/utils';
import { CATEGORIAS } from '../../lib/types';
import type { ResumenTarjeta, ConsumoResumen, GastoRecurrenteConHistorial, Movimiento } from '../../lib/types';
import styles from './ResumenForm.module.css';
import subStyles from '../gastos_recurrentes/GastosRecurrentes.module.css';

interface Props { onDone: () => void; }

const CAT_OPTIONS = CATEGORIAS.map(c => ({ value: c, label: c }));

export function ResumenForm({ onDone }: Props) {
  const sesion = usarSesion();
  const user = sesion.usuario;
  const medios: import('../../lib/types').MedioPago[] = sesion.medios;
  const allUsers: Record<string, import('../../lib/types').Usuario> = sesion.todosUsuarios;
  const prop = sesion.proporcion;
  const { mostrar: onToast } = usarToast();

  const [tarjeta,    setTarjeta]    = useState('');
  const [periodo,    setPeriodo]    = useState('');
  const [vcto,       setVcto]       = useState('');
  const [extrasDesc, setExtrasDesc] = useState('Impuestos y otros');
  const [extrasMonto,setExtrasMonto]= useState('');
  const [consumos,   setConsumos]   = useState<ConsumoResumen[]>([]);

  // Gastos comprometidos de esta tarjeta (cargados durante el mes)
  const [gastosComprometidos,    setGastosComprometidos]    = useState<Movimiento[]>([]);
  const [seleccionComprometidos, setSeleccionComprometidos] = useState<Set<string>>(new Set());

  // Form de nuevo consumo manual
  const [cDesc,  setCDesc]  = useState('');
  const [cMonto, setCMonto] = useState('');
  const [cCat,   setCCat]   = useState('Otro');
  const [cFecha, setCFecha] = useState(FISO);
  const [cComp,  setCComp]  = useState(false);
  const [cDiv,   setCDiv]   = useState<'mitad' | 'prop' | 'personal'>('mitad');

  // Toggle gasto recurrente
  const [cEsSub,    setCEsSub]    = useState(false);
  const [cSubId,    setCSubId]    = useState('');
  const [cSubNuevo, setCSubNuevo] = useState('');

  const [gastosRecurrentes, setGastosRecurrentes] = useState<GastoRecurrenteConHistorial[]>([]);
  const [montoArrastrado, setMontoArrastrado] = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const pareja = Object.values(allUsers).find((u: import('../../lib/types').Usuario) => u.id !== user.id);

  const medioOptions = medios
    .filter(m => m.tipo === 'credito')
    .map(m => ({ value: m.nombre, label: m.nombre }));

  // Cargar gastos recurrentes al montar
  useEffect(() => {
    getGastosRecurrentes(user.id).then(setGastosRecurrentes).catch(() => {});
  }, [user.id]);

  // Cargar gastos comprometidos cuando cambia la tarjeta seleccionada
  useEffect(() => {
    if (!tarjeta) {
      setGastosComprometidos([]);
      setSeleccionComprometidos(new Set());
      return;
    }
    sbGet<Movimiento>('movimientos', {
      user_id   : `eq.${user.id}`,
      estado    : 'eq.comprometido',
      medio_pago: `eq.${tarjeta}`,
    }, 0).then(rows => {
      setGastosComprometidos(rows);
      // Seleccionar todos por defecto
      setSeleccionComprometidos(new Set(rows.map(r => r.id)));
    }).catch(() => {});
  }, [tarjeta, user.id]);

  // Auto-activar toggle si la categoría es Suscripciones
  useEffect(() => {
    if (cCat === 'Suscripciones') setCEsSub(true);
  }, [cCat]);

  function toggleSeleccionComprometido(id: string) {
    setSeleccionComprometidos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Cálculos
  const montoComprometidoSeleccionado = gastosComprometidos
    .filter(m => seleccionComprometidos.has(m.id))
    .reduce((a, m) => a + num(m.mi_parte), 0);

  const sumaConsumos    = consumos.reduce((a, c) => a + (parseFloat(c.monto) || 0), 0) + montoComprometidoSeleccionado;
  const extrasNum       = parseFloat(extrasMonto) || 0;
  const totalResumen    = sumaConsumos + extrasNum;

  const compartidos     = consumos.filter(c => c.compartido);
  const montoCompartidoManual = compartidos.reduce((a, c) => {
    const m     = parseFloat(c.monto) || 0;
    const parte = Math.round(partePorDiv(m, c.division, prop));
    return a + (m - parte);
  }, 0);

  // Monto compartido de los comprometidos seleccionados
  const montoCompartidoComprometidos = gastosComprometidos
    .filter(m => seleccionComprometidos.has(m.id) && m.es_compartido)
    .reduce((a, m) => a + num(m.parte_contraparte), 0);

  const montoCompartido = montoCompartidoManual + montoCompartidoComprometidos;

  function resetConsumoForm() {
    setCDesc(''); setCMonto(''); setCCat('Otro'); setCFecha(FISO);
    setCComp(false); setCDiv('mitad');
    setCEsSub(false); setCSubId(''); setCSubNuevo('');
  }

  function addConsumo() {
    if (!cDesc || !cMonto) return;
    setConsumos(prev => [...prev, {
      descripcion   : cDesc,
      monto         : cMonto,
      categoria     : cCat,
      fecha         : cFecha,
      compartido    : cComp,
      division      : cComp ? cDiv : 'personal',
      esSuscripcion : cEsSub,
      suscripcionId : cEsSub ? (cSubId || undefined) : undefined,
    }]);
    resetConsumoForm();
  }

  function removeConsumo(i: number) {
    setConsumos(prev => prev.filter((_, idx) => idx !== i));
  }

  function toggleComp(i: number) {
    setConsumos(prev => prev.map((c, idx) =>
      idx === i ? { ...c, compartido: !c.compartido, division: !c.compartido ? 'mitad' : 'personal' } : c
    ));
  }

  function setDivision(i: number, div: 'mitad' | 'prop' | 'personal') {
    setConsumos(prev => prev.map((c, idx) => idx === i ? { ...c, division: div } : c));
  }

  async function handleSubmit() {
    if (!tarjeta || !periodo || !vcto) {
      setError('Completá tarjeta, período y vencimiento'); return;
    }
    const seleccionados = gastosComprometidos.filter(m => seleccionComprometidos.has(m.id));
    if (consumos.length === 0 && !extrasNum && seleccionados.length === 0) {
      setError('Agregá al menos un consumo o seleccioná gastos de tarjeta del período'); return;
    }
    setError(''); setLoading(true);

    try {
      // 1. Marcar resumen anterior como no vigente
      const anteriores = await sbGet<ResumenTarjeta>('resumenes_tarjeta', {
        user_id   : `eq.${user.id}`,
        tarjeta   : `eq.${tarjeta}`,
        es_vigente: 'eq.true',
      });

      let montoArrastradoLocal = 0;
      if (anteriores.length > 0) {
        const ant = anteriores[0];
        montoArrastradoLocal = Math.max(0, parseFloat(ant.monto_total) - parseFloat(ant.monto_pagado));
        setMontoArrastrado(montoArrastradoLocal);
        await sbPatch('resumenes_tarjeta', ant.id, { es_vigente: false });
      }

      // 2. Crear resumen
      const resumen = await sbPost<{ id: string }>('resumenes_tarjeta', {
        user_id            : user.id,
        tarjeta,
        periodo,
        fecha_vencimiento  : vcto,
        monto_total        : totalResumen,
        monto_pagado       : 0,
        estado             : 'pendiente',
        notas              : extrasNum > 0 ? `${extrasDesc}: ${fmt(extrasNum)}` : null,
        es_vigente         : true,
        resumen_anterior_id: anteriores.length > 0 ? anteriores[0].id : null,
        monto_arrastrado   : montoArrastradoLocal,
      });

      // 3. Asociar gastos comprometidos seleccionados al resumen
      for (const mov of seleccionados) {
        await sbPatch('movimientos', mov.id, {
          resumen_id: resumen.id,
          estado    : 'confirmado',
        });

        // Generar deuda interpersonal si era compartido
        const parteOtro = num(mov.parte_contraparte);
        if (parteOtro > 0 && pareja) {
          await crearDeudaInterpersonal({
            acreedorId  : user.id,
            deudorId    : pareja.id,
            descripcion : `${mov.descripcion} — ${mov.division === 'mitad' ? '50/50' : 'proporcional'}`,
            montoTotal  : parteOtro,
            origen      : 'gasto',
            movimientoId: mov.id,
            notas       : `Resumen ${tarjeta} ${periodo}`,
          });
        }
      }

      // 4. Guardar consumos manuales como movimientos
      for (const c of consumos) {
        const montoC    = parseFloat(c.monto) || 0;
        const miParte   = Math.round(partePorDiv(montoC, c.division, prop));
        const parteOtro = Math.round(montoC - miParte);

        const mov = await sbPost<{ id: string }>('movimientos', {
          fecha            : c.fecha,
          tipo             : 'gasto',
          descripcion      : c.descripcion,
          categoria        : c.categoria,
          medio_pago       : tarjeta,
          division         : c.division,
          tipo_division    : c.division,
          monto_total      : montoC,
          monto_pagado     : montoC,
          mi_parte         : miParte,
          parte_usuario    : miParte,
          parte_contraparte: parteOtro,
          es_deuda         : false,
          es_ahorro        : false,
          en_cuotas        : false,
          notas            : `Resumen ${tarjeta} ${periodo}`,
          user_id          : user.id,
          es_compartido    : c.compartido,
          estado           : 'confirmado',
          resumen_id       : resumen.id,
        });

        // Si está marcado como gasto recurrente → registrar pago
        if (c.esSuscripcion) {
          let subId = c.suscripcionId;

          if (!subId && cSubNuevo.trim()) {
            const nuevo = await crearGastoRecurrente({
              user_id        : user.id,
              nombre         : cSubNuevo.trim(),
              emoji          : '📦',
              tipo           : 'suscripcion_digital',
              descripcion    : null,
              division       : c.division as 'personal' | 'prop' | 'mitad',
              monto_estimado : montoC,
              activa         : true,
            });
            subId = nuevo.id;
          }

          if (subId) {
            await registrarPagoGastoRecurrente({
              gasto_recurrente_id: subId,
              movimiento_id      : mov.id,
              resumen_id         : resumen.id,
              periodo,
              monto              : montoC,
            });

            const gr = gastosRecurrentes.find(s => s.id === subId);
            if (gr && gr.monto_estimado !== montoC) {
              const { actualizarGastoRecurrente } = await import('../../lib/gastos_recurrentes.service');
              await actualizarGastoRecurrente(subId, { monto_estimado: montoC });
            }
          }
        }
      }

      // 5. Deuda interpersonal consolidada por consumos manuales compartidos
      if (montoCompartidoManual > 0 && pareja) {
        await crearDeudaInterpersonal({
          acreedorId  : user.id,
          deudorId    : pareja.id,
          descripcion : `Gastos compartidos resumen ${tarjeta} ${periodo}`,
          montoTotal  : montoCompartidoManual,
          origen      : 'resumen',
          resumenId   : resumen.id,
          notas       : `${compartidos.length} consumos compartidos`,
        });
      }

      const msgs = [
        `Resumen ${tarjeta} ${periodo} cargado ✓`,
        seleccionados.length > 0 ? `${seleccionados.length} gastos del mes asociados` : '',
        montoCompartido > 0 ? `${pareja?.nombre || 'Tu pareja'} te debe ${fmt(montoCompartido)}` : '',
        montoArrastrado > 0 ? `Arrastre anterior: ${fmt(montoArrastrado)}` : '',
      ].filter(Boolean).join(' · ');

      onToast(msgs, montoArrastrado > 0 ? 'warn' : 'ok');
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setLoading(false); }
  }

  const subOptions = [
    { value: '',          label: '— Seleccionar gasto recurrente —' },
    ...gastosRecurrentes.map(s => ({ value: s.id, label: `${s.emoji} ${s.nombre}` })),
    { value: '__nueva__', label: '+ Crear nuevo' },
  ];

  return (
    <div className={styles.wrap}>
      {/* Datos del resumen */}
      <Card className={styles.section}>
        <div className={styles.sectionTitle}>Datos del resumen</div>
        <Select
          label="Tarjeta *" options={medioOptions} value={tarjeta}
          onChange={e => setTarjeta(e.target.value)} placeholder="— Elegí —" fullWidth
        />
        {medioOptions.length === 0 && (
          <div className={styles.hint}>Primero agregá una tarjeta de crédito en Config.</div>
        )}
        <Input label="Período *" placeholder="Marzo 2026" value={periodo} onChange={e => setPeriodo(e.target.value)} fullWidth />
        <Input label="Fecha de vencimiento *" type="date" value={vcto} onChange={e => setVcto(e.target.value)} fullWidth />
      </Card>

      {/* Gastos comprometidos del período */}
      {gastosComprometidos.length > 0 && (
        <Card className={styles.section}>
          <div className={styles.sectionTitle}>
            Gastos cargados con esta tarjeta{' '}
            <Badge variant="warning">{gastosComprometidos.length}</Badge>
          </div>
          <div className={styles.hint}>
            Gastos registrados durante el mes con {tarjeta}. Seleccioná los que pertenecen a este resumen.
          </div>
          <div className={styles.consumoList}>
            {gastosComprometidos.map(mov => {
              const seleccionado = seleccionComprometidos.has(mov.id);
              const parteOtro    = num(mov.parte_contraparte);
              return (
                <div
                  key      ={mov.id}
                  className={`${styles.consumoItem} ${!seleccionado ? styles.itemDesseleccionado : ''}`}
                  onClick  ={() => toggleSeleccionComprometido(mov.id)}
                  style    ={{ cursor: 'pointer', opacity: seleccionado ? 1 : 0.5 }}
                >
                  <div className={styles.consumoMain}>
                    <div className={styles.consumoInfo}>
                      <div className={styles.consumoDesc}>
                        <span style={{ marginRight: 6 }}>{seleccionado ? '☑' : '☐'}</span>
                        {mov.descripcion}
                        {mov.es_compartido && (
                          <span className={styles.compTag}>
                            {' · '}{mov.division === 'mitad' ? '50/50' : 'Prop.'}
                            {pareja ? ` · ${pareja.nombre}: ${fmt(parteOtro)}` : ''}
                          </span>
                        )}
                      </div>
                      <div className={styles.consumoMeta}>{mov.fecha} · {mov.categoria}</div>
                    </div>
                    <div className={styles.consumoRight}>
                      <span className={styles.consumoMonto}>{fmt(num(mov.monto_total))}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {seleccionComprometidos.size > 0 && (
            <div className={styles.consumoTotal}>
              <span>{seleccionComprometidos.size} seleccionados</span>
              <span>{fmt(montoComprometidoSeleccionado)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Consumos manuales adicionales */}
      <Card className={styles.section}>
        <div className={styles.sectionTitle}>
          Otros consumos del resumen <Badge variant="default">{consumos.length}</Badge>
        </div>

        {/* Formulario inline */}
        <div className={styles.consumoForm}>
          <Input label="Fecha" type="date" value={cFecha} onChange={e => setCFecha(e.target.value)} fullWidth />
          <Input label="Descripción *" placeholder="Netflix, supermercado…" value={cDesc} onChange={e => setCDesc(e.target.value)} fullWidth />
          <Select label="Categoría" options={CAT_OPTIONS} value={cCat} onChange={e => setCCat(e.target.value)} fullWidth />
          <Input label="Monto ($) *" type="number" placeholder="0" value={cMonto} onChange={e => setCMonto(e.target.value)} fullWidth />

          <label className={`${styles.sharedToggle} ${cComp ? styles.sharedActive : ''}`}>
            <input
              type    ="checkbox"
              checked ={cComp}
              onChange={e => setCComp(e.target.checked)}
              style   ={{ display: 'none' }}
            />
            <span>{cComp ? '👥 Compartido' : '👤 Solo mío'}</span>
          </label>

          {cComp && (
            <div className={styles.divRow}>
              {(['mitad', 'prop', 'personal'] as const).map(d => (
                <button
                  key      ={d}
                  className={`${styles.divBtn} ${cDiv === d ? styles.divActive : ''}`}
                  onClick  ={() => setCDiv(d)}
                >
                  {d === 'mitad' ? '50/50' : d === 'prop' ? 'Prop.' : 'Solo mío'}
                </button>
              ))}
            </div>
          )}

          <div className={subStyles.subToggleRow}>
            <label className={`${subStyles.subToggle} ${cEsSub ? subStyles.subToggleActivo : ''}`}>
              <input
                type    ="checkbox"
                checked ={cEsSub}
                onChange={e => { setCEsSub(e.target.checked); if (!e.target.checked) { setCSubId(''); setCSubNuevo(''); } }}
              />
              <span className={subStyles.subTogglePill} />
              <span>Es gasto recurrente</span>
            </label>

            {cEsSub && (
              <>
                <select
                  className={subStyles.subSelect}
                  value={cSubId}
                  onChange={e => setCSubId(e.target.value)}
                >
                  {subOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {cSubId === '__nueva__' && (
                  <Input
                    label="Nombre del nuevo gasto recurrente"
                    placeholder="Netflix, Alquiler..."
                    value={cSubNuevo}
                    onChange={e => setCSubNuevo(e.target.value)}
                    fullWidth
                  />
                )}
              </>
            )}
          </div>

          <Button variant="secondary" fullWidth onClick={addConsumo} disabled={!cDesc || !cMonto}>
            + Agregar
          </Button>
        </div>

        {/* Lista de consumos manuales */}
        {consumos.length > 0 && (
          <div className={styles.consumoList}>
            {consumos.map((c, i) => {
              const m      = parseFloat(c.monto) || 0;
              const miP    = Math.round(partePorDiv(m, c.division, prop));
              const parteP = Math.round(m - miP);
              return (
                <div key={i} className={`${styles.consumoItem} ${c.compartido ? styles.itemComp : ''}`}>
                  <div className={styles.consumoMain}>
                    <div className={styles.consumoInfo}>
                      <div className={styles.consumoDesc}>
                        {c.descripcion}
                        {c.esSuscripcion && <span className={styles.subTag}>🔄 recurrente</span>}
                      </div>
                      <div className={styles.consumoMeta}>
                        {c.fecha} · {c.categoria}
                        {c.compartido && (
                          <span className={styles.compTag}>
                            {c.division === 'mitad' ? ' · 50/50' : c.division === 'prop' ? ' · Prop.' : ''}
                            {' · '}{pareja?.nombre || 'pareja'}: {fmt(parteP)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.consumoRight}>
                      <span className={styles.consumoMonto}>{fmt(m)}</span>
                      <div className={styles.consumoActions}>
                        <button
                          className={`${styles.compToggle} ${c.compartido ? styles.compToggleOn : ''}`}
                          onClick={() => toggleComp(i)}
                          title="Compartido"
                        >
                          👥
                        </button>
                        {c.compartido && (
                          <select
                            className={styles.divSelect}
                            value   ={c.division}
                            onChange={e => setDivision(i, e.target.value as 'mitad' | 'prop' | 'personal')}
                          >
                            <option value="mitad">50/50</option>
                            <option value="prop">Prop.</option>
                          </select>
                        )}
                        <button className={styles.removeBtn} onClick={() => removeConsumo(i)}>✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Extras */}
      <Card className={styles.section}>
        <div className={styles.sectionTitle}>Impuestos y otros</div>
        <div className={styles.hint}>Intereses, impuestos, arrastre manual u otros cargos no desglosables.</div>
        <Input label="Descripción" value={extrasDesc} onChange={e => setExtrasDesc(e.target.value)} fullWidth />
        <Input label="Monto ($)" type="number" placeholder="0" value={extrasMonto} onChange={e => setExtrasMonto(e.target.value)} fullWidth />
      </Card>

      {/* Resumen del total */}
      {totalResumen > 0 && (
        <div className={styles.resumenFinal}>
          {seleccionComprometidos.size > 0 && (
            <div className={styles.resumenRow}>
              <span>Gastos del período ({seleccionComprometidos.size})</span>
              <span>{fmt(montoComprometidoSeleccionado)}</span>
            </div>
          )}
          {consumos.length > 0 && (
            <div className={styles.resumenRow}>
              <span>Otros consumos ({consumos.length})</span>
              <span>{fmt(consumos.reduce((a, c) => a + (parseFloat(c.monto) || 0), 0))}</span>
            </div>
          )}
          {extrasNum > 0 && (
            <div className={styles.resumenRow}>
              <span>{extrasDesc}</span>
              <span>{fmt(extrasNum)}</span>
            </div>
          )}
          <div className={styles.resumenRowTotal}>
            <span>Total resumen</span>
            <strong className={styles.resumenTotal}>{fmt(totalResumen)}</strong>
          </div>
          {montoCompartido > 0 && (
            <div className={styles.resumenRowDeuda}>
              <span>💳 {pareja?.nombre || 'Pareja'} te debe</span>
              <strong style={{ color: 'var(--gn)' }}>{fmt(montoCompartido)}</strong>
            </div>
          )}
          {montoArrastrado > 0 && (
            <div className={styles.resumenRow} style={{ color: 'var(--am)', fontSize: 12 }}>
              <span>⚠️ Arrastre período anterior</span>
              <span>{fmt(montoArrastrado)}</span>
            </div>
          )}
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
      <div style={{ margin: '0 16px 16px' }}>
        <Button variant="primary" fullWidth loading={loading} onClick={handleSubmit}>
          Guardar resumen
        </Button>
      </div>
    </div>
  );
}
