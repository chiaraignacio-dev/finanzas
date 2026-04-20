import { useState }                from 'react';
import { Input, Select, Button, Card } from '../../../components/ui';
import { RadioGroup }              from '../../../components/ui/RadioGroup';
import { usarSesion }              from '../../../context/SesionContext';
import { sbPost, sbPatch }         from '../../../lib/supabase';
import { obtenerFechaISO, num }    from '../../../lib/utils';
import styles                      from './forms.module.css';

interface Props { onExito: (msg: string) => void; }

const OPCIONES_DESTINO = [
  { value: 'pesos', label: 'Cuenta en pesos' },
  { value: 'dolar', label: 'Dólares (MEP / billetera)' },
  { value: 'pf',    label: 'Plazo fijo / FCI' },
];

export function AhorroForm({ onExito }: Props) {
  const { usuario, metas } = usarSesion();
  const [metaId,   setMetaId]   = useState('');
  const [fecha,    setFecha]    = useState(obtenerFechaISO());
  const [monto,    setMonto]    = useState('');
  const [destino,  setDestino]  = useState('pesos');
  const [notas,    setNotas]    = useState('');
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState('');

  const meta     = metas.find(m => m.id === metaId);
  const montoNum = num(monto);
  const pct      = meta && montoNum ? ((montoNum / num(meta.monto_objetivo)) * 100).toFixed(2) : null;

  const opsMetas = metas.map(m => ({
    value: m.id,
    label: `${m.emoji || '🎯'} ${m.nombre} — $${Math.round(num(m.monto_objetivo)).toLocaleString('es-AR')}`,
  }));

  async function guardar() {
    if (!metaId || !montoNum) { setError('Elegí una meta y completá el monto'); return; }
    setError(''); setCargando(true);
    try {
      await sbPost('movimientos', {
        fecha,
        tipo         : 'ahorro',
        descripcion  : 'Ahorro: ' + (meta?.nombre || '—'),
        categoria    : 'Ahorro',
        medio_pago   : destino,
        division     : 'personal',
        monto_total  : montoNum,
        mi_parte     : montoNum,
        monto_pagado : montoNum,
        notas        : notas || meta?.nombre || null,
        user_id      : usuario.id,
        es_compartido: false,
        estado       : 'confirmado',
      });
      if (meta) {
        await sbPatch('metas', metaId, { monto_actual: num(meta.monto_actual) + montoNum });
      }
      onExito(`Ahorro guardado ✓ — aportaste ${pct}% a "${meta?.nombre}"`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setCargando(false); }
  }

  return (
    <Card className={styles.formCard}>
      <Select label="Meta de ahorro *" options={opsMetas} value={metaId} onChange={e => setMetaId(e.target.value)} placeholder="— Elegí una meta —" fullWidth />
      <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} fullWidth />
      <Input label="Monto ($) *" type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} fullWidth />
      {pct && <div className={styles.pill}><span>Aporte a la meta</span><strong>{pct}%</strong></div>}
      <RadioGroup name="destino" label="¿Dónde lo guardaste?" options={OPCIONES_DESTINO} value={destino} onChange={setDestino} />
      <Input label="Notas" placeholder="Opcional…" value={notas} onChange={e => setNotas(e.target.value)} fullWidth />
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="success" fullWidth loading={cargando} onClick={guardar}>Guardar ahorro</Button>
    </Card>
  );
}
