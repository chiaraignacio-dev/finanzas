import { useState, useEffect } from 'react';
import { Input, Select, Button, Card } from '../../components/ui';
import { RadioGroup } from '../../components/ui';
import { PageHeader } from '../../components/ui';
import { sbGet, sbPost, sbPatch } from '../../lib/supabase';
import { hash, fmt } from '../../lib/utils';
import type { Usuario, MedioPago, Meta } from '../../lib/types';
import styles from './Config.module.css';

interface Props {
  user    : Usuario;
  onToast : (msg: string, type?: 'ok' | 'err' | 'warn') => void;
  onLogout: () => void;
  onReload: () => void;
}

const TIPO_MEDIO_OPTIONS = [
  { value: 'credito',  label: 'Tarjeta de crédito' },
  { value: 'debito',   label: 'Tarjeta de débito' },
  { value: 'efectivo', label: 'Efectivo / QR / Transfer' },
  { value: 'billetera',label: 'Billetera virtual' },
];

const COBRO_OPTIONS = [
  { value: 'fijo', label: 'Mensual fijo' },
  { value: 'q',    label: 'Por quincena' },
];

export function Config({ user, onToast, onLogout, onReload }: Props) {
  const [medios,  setMedios]  = useState<MedioPago[]>([]);
  const [metas,   setMetas]   = useState<Meta[]>([]);

  // Ingresos
  const [cobro,   setCobro]   = useState('fijo');
  const [ingFijo, setIngFijo] = useState('');
  const [ingQ1,   setIngQ1]   = useState('');
  const [ingQ2,   setIngQ2]   = useState('');

  // Nuevo medio
  const [showMedio, setShowMedio] = useState(false);
  const [nmNombre,  setNmNombre]  = useState('');
  const [nmTipo,    setNmTipo]    = useState('');
  const [nmBanco,   setNmBanco]   = useState('');
  const [nmCierre,  setNmCierre]  = useState('');
  const [nmLimite,  setNmLimite]  = useState('');
  const [nmDeuda,   setNmDeuda]   = useState('');

  // Nueva meta
  const [showMeta,  setShowMeta]  = useState(false);
  const [metNombre, setMetNombre] = useState('');
  const [metEmoji,  setMetEmoji]  = useState('🎯');
  const [metMonto,  setMetMonto]  = useState('');
  const [metFecha,  setMetFecha]  = useState('');
  const [metComp,   setMetComp]   = useState('no');

  // Contraseña
  const [np1, setNp1] = useState('');
  const [np2, setNp2] = useState('');

  useEffect(() => {
    sbGet<MedioPago>('medios_pago', { user_id: `eq.${user.id}`, activo: 'eq.true' }).then(setMedios);
    sbGet<Meta>('metas', { user_id: `eq.${user.id}`, activa: 'eq.true' }).then(setMetas);

    // Prellenar ingresos
    if (user.ingreso_q1 || user.ingreso_q2) {
      setCobro('q');
      setIngQ1(String(user.ingreso_q1 || ''));
      setIngQ2(String(user.ingreso_q2 || ''));
    } else {
      setIngFijo(String(user.ingreso_fijo || ''));
    }
  }, [user]);

  async function saveIngresos() {
    const payload = cobro === 'fijo'
      ? { ingreso_fijo: parseFloat(ingFijo) || 0, ingreso_q1: 0, ingreso_q2: 0 }
      : { ingreso_q1: parseFloat(ingQ1) || 0, ingreso_q2: parseFloat(ingQ2) || 0, ingreso_fijo: 0 };
    try {
      await sbPatch('usuarios', user.id, payload);
      onToast('Ingresos guardados ✓');
      onReload();
    } catch { onToast('Error', 'err'); }
  }

  async function saveMedio() {
    if (!nmNombre) { onToast('Ingresá un nombre', 'err'); return; }
    try {
      await sbPost('medios_pago', {
        user_id    : user.id,
        nombre     : nmNombre,
        tipo       : nmTipo || null,
        banco      : nmBanco || null,
        dia_cierre : nmCierre || null,
        limite     : parseFloat(nmLimite) || null,
        saldo_deuda: parseFloat(nmDeuda) || 0,
        activo     : true,
        datos_extra: {},
      });
      onToast('Medio agregado ✓');
      setShowMedio(false);
      setNmNombre(''); setNmTipo(''); setNmBanco(''); setNmCierre(''); setNmLimite(''); setNmDeuda('');
      const m = await sbGet<MedioPago>('medios_pago', { user_id: `eq.${user.id}`, activo: 'eq.true' });
      setMedios(m);
      onReload();
    } catch { onToast('Error', 'err'); }
  }

  async function delMedio(id: string) {
    if (!confirm('¿Eliminar?')) return;
    await sbPatch('medios_pago', id, { activo: false });
    setMedios(m => m.filter(x => x.id !== id));
    onReload();
  }

  async function saveMeta() {
    if (!metNombre || !metMonto) { onToast('Completá nombre y monto', 'err'); return; }
    try {
      await sbPost('metas', {
        user_id       : user.id,
        nombre        : metNombre,
        emoji         : metEmoji || '🎯',
        monto_objetivo: parseFloat(metMonto),
        monto_actual  : 0,
        fecha_objetivo: metFecha || null,
        activa        : true,
        es_compartida : metComp === 'si',
      });
      onToast('Meta creada ✓');
      setShowMeta(false);
      setMetNombre(''); setMetEmoji('🎯'); setMetMonto(''); setMetFecha(''); setMetComp('no');
      const m = await sbGet<Meta>('metas', { user_id: `eq.${user.id}`, activa: 'eq.true' });
      setMetas(m);
    } catch { onToast('Error', 'err'); }
  }

  async function delMeta(id: string) {
    if (!confirm('¿Eliminar esta meta?')) return;
    await sbPatch('metas', id, { activa: false });
    setMetas(m => m.filter(x => x.id !== id));
  }

  async function changePass() {
    if (!np1 || np1 !== np2) { onToast(np1 ? 'No coinciden' : 'Ingresá contraseña', 'err'); return; }
    if (np1.length < 4)      { onToast('Mínimo 4 caracteres', 'err'); return; }
    try {
      await sbPatch('usuarios', user.id, { password_hash: hash(np1) });
      onToast('Contraseña actualizada ✓');
      setNp1(''); setNp2('');
    } catch { onToast('Error', 'err'); }
  }

  return (
    <div>
      <PageHeader
        title="Configuración"
        subtitle={`@${user.username}`}
        right={
          <Button variant="ghost" size="sm" onClick={onLogout}
            style={{ color: 'var(--rd)', border: '1px solid rgba(239,68,68,0.4)' }}>
            Salir
          </Button>
        }
      />

      {/* Ingresos */}
      <div className={styles.slab}>Mis ingresos</div>
      <Card className={styles.section}>
        <RadioGroup name="cobro" label="¿Cómo cobrás?" options={COBRO_OPTIONS} value={cobro} onChange={setCobro} />
        {cobro === 'fijo'
          ? <Input label="Ingreso mensual neto ($)" type="number" value={ingFijo} onChange={e => setIngFijo(e.target.value)} fullWidth />
          : <>
              <Input label="1ra quincena ($)" type="number" value={ingQ1} onChange={e => setIngQ1(e.target.value)} fullWidth />
              <Input label="2da quincena ($)" type="number" value={ingQ2} onChange={e => setIngQ2(e.target.value)} fullWidth />
            </>
        }
        <Button variant="primary" fullWidth onClick={saveIngresos}>Guardar ingresos</Button>
      </Card>

      {/* Medios */}
      <div className={styles.slab}>Mis medios de pago</div>
      <Card className={styles.section}>
        {medios.length === 0 && <div className={styles.empty}>Sin medios configurados</div>}
        {medios.map(m => (
          <div key={m.id} className={styles.listItem}>
            <div>
              <div className={styles.listTitle}>{m.nombre}</div>
              <div className={styles.listSub}>{m.tipo || '—'} · {m.banco || '—'}{m.dia_cierre ? ' · ' + m.dia_cierre : ''}</div>
              {m.saldo_deuda ? <div style={{ fontSize: 11, color: 'var(--rd)' }}>Deuda: {fmt(m.saldo_deuda)}</div> : null}
            </div>
            <Button variant="ghost" size="sm" onClick={() => delMedio(m.id)}
              style={{ color: 'var(--rd)', border: '1px solid rgba(239,68,68,0.3)' }}>✕</Button>
          </div>
        ))}
      </Card>
      <div style={{ margin: '0 16px 12px' }}>
        <Button variant="secondary" fullWidth onClick={() => setShowMedio(v => !v)}>+ Agregar medio de pago</Button>
      </div>
      {showMedio && (
        <Card className={styles.section}>
          <div className={styles.sectionTitle}>Nuevo medio de pago</div>
          <Input label="Nombre *" placeholder="Visa Galicia, Naranja X…" value={nmNombre} onChange={e => setNmNombre(e.target.value)} fullWidth />
          <Select label="Tipo" options={TIPO_MEDIO_OPTIONS} value={nmTipo} onChange={e => setNmTipo(e.target.value)} placeholder="—" fullWidth />
          <Input label="Banco / Entidad" placeholder="BBVA, Uala…" value={nmBanco} onChange={e => setNmBanco(e.target.value)} fullWidth />
          <Input label="Día de cierre" placeholder="Ej: último jueves del mes" value={nmCierre} onChange={e => setNmCierre(e.target.value)} fullWidth />
          <Input label="Límite de crédito ($)" type="number" value={nmLimite} onChange={e => setNmLimite(e.target.value)} fullWidth />
          <Input label="Saldo deuda actual ($)" type="number" value={nmDeuda} onChange={e => setNmDeuda(e.target.value)} fullWidth />
          <Button variant="primary" fullWidth onClick={saveMedio}>Guardar</Button>
          <Button variant="secondary" fullWidth onClick={() => setShowMedio(false)}>Cancelar</Button>
        </Card>
      )}

      {/* Metas */}
      <div className={styles.slab}>Mis metas de ahorro</div>
      <Card className={styles.section}>
        {metas.length === 0 && <div className={styles.empty}>Sin metas creadas aún</div>}
        {metas.map(m => {
          const p = parseFloat(m.monto_objetivo) ? Math.min(100, parseFloat(m.monto_actual) / parseFloat(m.monto_objetivo) * 100) : 0;
          return (
            <div key={m.id} className={styles.metaItem}>
              <div className={styles.listItem}>
                <div>
                  <div className={styles.listTitle}>{m.emoji || '🎯'} {m.nombre}</div>
                  {m.fecha_objetivo && <div className={styles.listSub}>{new Date(m.fecha_objetivo).toLocaleDateString('es-AR')}</div>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => delMeta(m.id)}
                  style={{ color: 'var(--rd)', border: '1px solid rgba(239,68,68,0.3)' }}>✕</Button>
              </div>
              <div className={styles.barWrap}>
                <div className={styles.barLabels}>
                  <span>{fmt(parseFloat(m.monto_actual))}</span>
                  <span>de {fmt(parseFloat(m.monto_objetivo))}</span>
                </div>
                <div className={styles.bar}><div className={styles.barFill} style={{ width: `${p.toFixed(0)}%` }} /></div>
                <div className={styles.barPct}>{p.toFixed(1)}%</div>
              </div>
            </div>
          );
        })}
      </Card>
      <div style={{ margin: '0 16px 12px' }}>
        <Button variant="secondary" fullWidth onClick={() => setShowMeta(v => !v)}>+ Nueva meta</Button>
      </div>
      {showMeta && (
        <Card className={styles.section}>
          <div className={styles.sectionTitle}>Nueva meta</div>
          <Input label="Nombre *" placeholder="Primer auto, Viaje…" value={metNombre} onChange={e => setMetNombre(e.target.value)} fullWidth />
          <div style={{ display: 'flex', gap: 10 }}>
            <Input label="Emoji" value={metEmoji} onChange={e => setMetEmoji(e.target.value)} style={{ width: 70, fontSize: 22, textAlign: 'center' }} />
            <Input label="Monto objetivo ($) *" type="number" value={metMonto} onChange={e => setMetMonto(e.target.value)} fullWidth />
          </div>
          <Input label="Fecha objetivo" type="date" value={metFecha} onChange={e => setMetFecha(e.target.value)} fullWidth />
          <RadioGroup name="metComp" label="¿Es compartida?" options={[{ value: 'si', label: 'Sí — aparece en Hogar' }, { value: 'no', label: 'No — solo la veo yo' }]} value={metComp} onChange={setMetComp} />
          <Button variant="primary" fullWidth onClick={saveMeta}>Crear meta</Button>
          <Button variant="secondary" fullWidth onClick={() => setShowMeta(false)}>Cancelar</Button>
        </Card>
      )}

      {/* Seguridad */}
      <div className={styles.slab}>Seguridad</div>
      <Card className={styles.section}>
        <Input label="Nueva contraseña" type="password" placeholder="Mínimo 4 caracteres" value={np1} onChange={e => setNp1(e.target.value)} fullWidth />
        <Input label="Confirmar" type="password" placeholder="Repetí la contraseña" value={np2} onChange={e => setNp2(e.target.value)} fullWidth />
        <Button variant="secondary" fullWidth onClick={changePass}>Cambiar contraseña</Button>
      </Card>
      <div style={{ height: 16 }} />
    </div>
  );
}
