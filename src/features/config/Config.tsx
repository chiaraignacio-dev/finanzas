import { useState, useEffect }         from 'react';
import { Input, Select, Button, Card } from '../../components/ui';
import { RadioGroup }                  from '../../components/ui';
import { PageHeader }                  from '../../components/ui';
import { ConfirmDialog }               from '../../components/ui/ConfirmDialog';
import { usarSesion, usarToast }       from '../../context/SesionContext';
import { sbGet, sbPost, sbPatch }      from '../../lib/supabase';
import { hash, fmt, num }              from '../../lib/utils';
import type { MedioPago, Meta }        from '../../lib/types';
import styles                          from './Config.module.css';

interface Props { onLogout: () => void; }

const OPCIONES_TIPO_MEDIO = [
  { value: 'credito',   label: 'Tarjeta de crédito' },
  { value: 'debito',    label: 'Tarjeta de débito' },
  { value: 'efectivo',  label: 'Efectivo / QR / Transfer' },
  { value: 'billetera', label: 'Billetera virtual' },
];

const OPCIONES_COBRO = [
  { value: 'fijo', label: 'Mensual fijo' },
  { value: 'q',    label: 'Por quincena' },
];

// ── Estado inicial del form de nuevo medio ─────────────
const MEDIO_VACIO = { nombre: '', tipo: '', banco: '', cierre: '', limite: '', deuda: '' };
const META_VACIA  = { nombre: '', emoji: '🎯', monto: '', fecha: '', compartida: 'no' };

export function Config({ onLogout }: Props) {
  const { usuario, recargar }         = usarSesion();
  const { mostrar: mostrarToast }     = usarToast();
  const [medios,     setMedios]       = useState<MedioPago[]>([]);
  const [metas,      setMetas]        = useState<Meta[]>([]);

  // Ingresos
  const [cobro,   setCobro]   = useState('fijo');
  const [ingFijo, setIngFijo] = useState('');
  const [ingQ1,   setIngQ1]   = useState('');
  const [ingQ2,   setIngQ2]   = useState('');

  // Forms agrupados
  const [mostrarMedio,  setMostrarMedio]  = useState(false);
  const [mostrarMeta,   setMostrarMeta]   = useState(false);
  const [nuevoMedio,    setNuevoMedio]    = useState(MEDIO_VACIO);
  const [nuevaMeta,     setNuevaMeta]     = useState(META_VACIA);

  // Contraseña
  const [np1, setNp1] = useState('');
  const [np2, setNp2] = useState('');

  // Confirm dialog
  const [confirmando, setConfirmando] = useState<{ tipo: 'medio' | 'meta'; id: string } | null>(null);

  useEffect(() => {
    sbGet<MedioPago>('medios_pago', { user_id: `eq.${usuario.id}`, activo: 'eq.true' }).then(setMedios);
    sbGet<Meta>('metas',       { user_id: `eq.${usuario.id}`, activa: 'eq.true'  }).then(setMetas);

    if (usuario.ingreso_q1 || usuario.ingreso_q2) {
      setCobro('q');
      setIngQ1(String(usuario.ingreso_q1 || ''));
      setIngQ2(String(usuario.ingreso_q2 || ''));
    } else {
      setIngFijo(String(usuario.ingreso_fijo || ''));
    }
  }, [usuario]);

  // ── Helpers de campo agrupado ──────────────────────
  function actualizarMedio(campo: string, valor: string) {
    setNuevoMedio(prev => ({ ...prev, [campo]: valor }));
  }
  function actualizarMeta(campo: string, valor: string) {
    setNuevaMeta(prev => ({ ...prev, [campo]: valor }));
  }

  // ── Ingresos ───────────────────────────────────────
  async function guardarIngresos() {
    const payload = cobro === 'fijo'
      ? { ingreso_fijo: num(ingFijo), ingreso_q1: 0, ingreso_q2: 0 }
      : { ingreso_q1: num(ingQ1), ingreso_q2: num(ingQ2), ingreso_fijo: 0 };
    try {
      await sbPatch('usuarios', usuario.id, payload);
      mostrarToast('Ingresos guardados ✓');
      recargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  // ── Medios ─────────────────────────────────────────
  async function guardarMedio() {
    if (!nuevoMedio.nombre) { mostrarToast('Ingresá un nombre', 'err'); return; }
    try {
      await sbPost('medios_pago', {
        user_id    : usuario.id,
        nombre     : nuevoMedio.nombre,
        tipo       : nuevoMedio.tipo    || null,
        banco      : nuevoMedio.banco   || null,
        dia_cierre : nuevoMedio.cierre  || null,
        limite     : num(nuevoMedio.limite) || null,
        saldo_deuda: num(nuevoMedio.deuda),
        activo     : true,
        datos_extra: {},
      });
      mostrarToast('Medio agregado ✓');
      setMostrarMedio(false);
      setNuevoMedio(MEDIO_VACIO);
      const m = await sbGet<MedioPago>('medios_pago', { user_id: `eq.${usuario.id}`, activo: 'eq.true' });
      setMedios(m);
      recargar();
    } catch { mostrarToast('Error', 'err'); }
  }

  async function eliminarMedio(id: string) {
    await sbPatch('medios_pago', id, { activo: false });
    setMedios(m => m.filter(x => x.id !== id));
    recargar();
  }

  // ── Metas ──────────────────────────────────────────
  async function guardarMeta() {
    if (!nuevaMeta.nombre || !nuevaMeta.monto) { mostrarToast('Completá nombre y monto', 'err'); return; }
    try {
      await sbPost('metas', {
        user_id       : usuario.id,
        nombre        : nuevaMeta.nombre,
        emoji         : nuevaMeta.emoji  || '🎯',
        monto_objetivo: num(nuevaMeta.monto),
        monto_actual  : 0,
        fecha_objetivo: nuevaMeta.fecha || null,
        activa        : true,
        es_compartida : nuevaMeta.compartida === 'si',
      });
      mostrarToast('Meta creada ✓');
      setMostrarMeta(false);
      setNuevaMeta(META_VACIA);
      const m = await sbGet<Meta>('metas', { user_id: `eq.${usuario.id}`, activa: 'eq.true' });
      setMetas(m);
    } catch { mostrarToast('Error', 'err'); }
  }

  async function eliminarMeta(id: string) {
    await sbPatch('metas', id, { activa: false });
    setMetas(m => m.filter(x => x.id !== id));
  }

  // ── Contraseña ─────────────────────────────────────
  async function cambiarContrasena() {
    if (!np1 || np1 !== np2) { mostrarToast(np1 ? 'No coinciden' : 'Ingresá contraseña', 'err'); return; }
    if (np1.length < 4)      { mostrarToast('Mínimo 4 caracteres', 'err'); return; }
    try {
      await sbPatch('usuarios', usuario.id, { password_hash: hash(np1) });
      mostrarToast('Contraseña actualizada ✓');
      setNp1(''); setNp2('');
    } catch { mostrarToast('Error', 'err'); }
  }

  // ── Confirm handler ────────────────────────────────
  function confirmarEliminacion() {
    if (!confirmando) return;
    if (confirmando.tipo === 'medio') eliminarMedio(confirmando.id);
    if (confirmando.tipo === 'meta')  eliminarMeta(confirmando.id);
    setConfirmando(null);
  }

  return (
    <div>
      <ConfirmDialog
        abierto    ={!!confirmando}
        mensaje    ={confirmando?.tipo === 'medio' ? '¿Eliminás este medio de pago?' : '¿Eliminás esta meta?'}
        peligroso
        labelConfirmar="Sí, eliminar"
        onConfirmar={confirmarEliminacion}
        onCancelar ={() => setConfirmando(null)}
      />

      <PageHeader
        title   ="Configuración"
        subtitle={`@${usuario.username}`}
        right={
          <Button variant="ghost" size="sm" onClick={onLogout}
            style={{ color: 'var(--rd)', border: '1px solid rgba(224,90,90,0.4)' }}>
            Salir
          </Button>
        }
      />

      {/* Ingresos */}
      <div className={styles.seccion}>Mis ingresos</div>
      <Card className={styles.card}>
        <RadioGroup name="cobro" label="¿Cómo cobrás?" options={OPCIONES_COBRO} value={cobro} onChange={setCobro} />
        {cobro === 'fijo'
          ? <Input label="Ingreso mensual neto ($)" type="number" value={ingFijo} onChange={e => setIngFijo(e.target.value)} fullWidth />
          : <>
              <Input label="1ra quincena ($)" type="number" value={ingQ1} onChange={e => setIngQ1(e.target.value)} fullWidth />
              <Input label="2da quincena ($)" type="number" value={ingQ2} onChange={e => setIngQ2(e.target.value)} fullWidth />
            </>
        }
        <Button variant="primary" fullWidth onClick={guardarIngresos}>Guardar ingresos</Button>
      </Card>

      {/* Medios */}
      <div className={styles.seccion}>Mis medios de pago</div>
      <Card className={styles.card}>
        {medios.length === 0 && <div className={styles.vacio}>Sin medios configurados</div>}
        {medios.map(m => (
          <div key={m.id} className={styles.fila}>
            <div>
              <div className={styles.filaTitulo}>{m.nombre}</div>
              <div className={styles.filaSubtitulo}>{m.tipo || '—'} · {m.banco || '—'}{m.dia_cierre ? ' · ' + m.dia_cierre : ''}</div>
              {m.saldo_deuda ? <div style={{ fontSize: 11, color: 'var(--rd)' }}>Deuda: {fmt(m.saldo_deuda)}</div> : null}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setConfirmando({ tipo: 'medio', id: m.id })}
              style={{ color: 'var(--rd)', border: '1px solid rgba(224,90,90,0.3)' }}>✕</Button>
          </div>
        ))}
      </Card>
      <div className={styles.accion}>
        <Button variant="secondary" fullWidth onClick={() => setMostrarMedio(v => !v)}>+ Agregar medio de pago</Button>
      </div>
      {mostrarMedio && (
        <Card className={styles.card}>
          <div className={styles.tituloCard}>Nuevo medio de pago</div>
          <Input label="Nombre *" placeholder="Visa Galicia, Naranja X…" value={nuevoMedio.nombre} onChange={e => actualizarMedio('nombre', e.target.value)} fullWidth />
          <Select label="Tipo" options={OPCIONES_TIPO_MEDIO} value={nuevoMedio.tipo} onChange={e => actualizarMedio('tipo', e.target.value)} placeholder="—" fullWidth />
          <Input label="Banco / Entidad" placeholder="BBVA, Uala…" value={nuevoMedio.banco} onChange={e => actualizarMedio('banco', e.target.value)} fullWidth />
          <Input label="Día de cierre" placeholder="Ej: último jueves del mes" value={nuevoMedio.cierre} onChange={e => actualizarMedio('cierre', e.target.value)} fullWidth />
          <Input label="Límite de crédito ($)" type="number" value={nuevoMedio.limite} onChange={e => actualizarMedio('limite', e.target.value)} fullWidth />
          <Input label="Saldo deuda actual ($)" type="number" value={nuevoMedio.deuda} onChange={e => actualizarMedio('deuda', e.target.value)} fullWidth />
          <Button variant="primary" fullWidth onClick={guardarMedio}>Guardar</Button>
          <Button variant="secondary" fullWidth onClick={() => setMostrarMedio(false)}>Cancelar</Button>
        </Card>
      )}

      {/* Metas */}
      <div className={styles.seccion}>Mis metas de ahorro</div>
      <Card className={styles.card}>
        {metas.length === 0 && <div className={styles.vacio}>Sin metas creadas aún</div>}
        {metas.map(m => {
          const p = num(m.monto_objetivo) ? Math.min(100, num(m.monto_actual) / num(m.monto_objetivo) * 100) : 0;
          return (
            <div key={m.id} className={styles.metaItem}>
              <div className={styles.fila}>
                <div>
                  <div className={styles.filaTitulo}>{m.emoji || '🎯'} {m.nombre}</div>
                  {m.fecha_objetivo && <div className={styles.filaSubtitulo}>{new Date(m.fecha_objetivo).toLocaleDateString('es-AR')}</div>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setConfirmando({ tipo: 'meta', id: m.id })}
                  style={{ color: 'var(--rd)', border: '1px solid rgba(224,90,90,0.3)' }}>✕</Button>
              </div>
              <div className={styles.barraWrap}>
                <div className={styles.barraEtiquetas}>
                  <span>{fmt(num(m.monto_actual))}</span>
                  <span>de {fmt(num(m.monto_objetivo))}</span>
                </div>
                <div className={styles.barra}><div className={styles.barraRelleno} style={{ width: `${p.toFixed(0)}%` }} /></div>
                <div className={styles.barraPct}>{p.toFixed(1)}%</div>
              </div>
            </div>
          );
        })}
      </Card>
      <div className={styles.accion}>
        <Button variant="secondary" fullWidth onClick={() => setMostrarMeta(v => !v)}>+ Nueva meta</Button>
      </div>
      {mostrarMeta && (
        <Card className={styles.card}>
          <div className={styles.tituloCard}>Nueva meta</div>
          <Input label="Nombre *" placeholder="Primer auto, Viaje…" value={nuevaMeta.nombre} onChange={e => actualizarMeta('nombre', e.target.value)} fullWidth />
          <div style={{ display: 'flex', gap: 10 }}>
            <Input label="Emoji" value={nuevaMeta.emoji} onChange={e => actualizarMeta('emoji', e.target.value)} style={{ width: 70, fontSize: 22, textAlign: 'center' }} />
            <Input label="Monto objetivo ($) *" type="number" value={nuevaMeta.monto} onChange={e => actualizarMeta('monto', e.target.value)} fullWidth />
          </div>
          <Input label="Fecha objetivo" type="date" value={nuevaMeta.fecha} onChange={e => actualizarMeta('fecha', e.target.value)} fullWidth />
          <RadioGroup name="metComp" label="¿Es compartida?" options={[{ value: 'si', label: 'Sí — aparece en Hogar' }, { value: 'no', label: 'No — solo la veo yo' }]} value={nuevaMeta.compartida} onChange={v => actualizarMeta('compartida', v)} />
          <Button variant="primary" fullWidth onClick={guardarMeta}>Crear meta</Button>
          <Button variant="secondary" fullWidth onClick={() => setMostrarMeta(false)}>Cancelar</Button>
        </Card>
      )}

      {/* Seguridad */}
      <div className={styles.seccion}>Seguridad</div>
      <Card className={styles.card}>
        <Input label="Nueva contraseña" type="password" placeholder="Mínimo 4 caracteres" value={np1} onChange={e => setNp1(e.target.value)} fullWidth />
        <Input label="Confirmar" type="password" placeholder="Repetí la contraseña" value={np2} onChange={e => setNp2(e.target.value)} fullWidth />
        <Button variant="secondary" fullWidth onClick={cambiarContrasena}>Cambiar contraseña</Button>
      </Card>
      <div style={{ height: 16 }} />
    </div>
  );
}
