import { useState } from 'react';
import { Input, Button, Card } from '../../../components/ui';
import { RadioGroup } from '../../../components/ui/RadioGroup';
import { sbPost } from '../../../lib/supabase';
import { fmt, partePorDiv } from '../../../lib/utils';
import type { Usuario } from '../../../lib/types';
import styles from './forms.module.css';

interface Props {
  user     : Usuario;
  prop     : number;
  onSuccess: (msg: string) => void;
}

const TIPO_OPTIONS = [
  { value: 'luz',       label: '⚡ Luz' },
  { value: 'agua',      label: '💧 Agua' },
  { value: 'gas',       label: '🔥 Gas' },
  { value: 'internet',  label: '📡 Internet / Cable' },
  { value: 'expensas',  label: '🏢 Expensas' },
];

const COMP_OPTIONS = [
  { value: 'si', label: 'Sí, lo compartimos' },
  { value: 'no', label: 'No, es solo mío' },
];

export function ServicioForm({ user, prop, onSuccess }: Props) {
  const [tipo,    setTipo]    = useState('');
  const [monto,   setMonto]   = useState('');
  const [vcto,    setVcto]    = useState('');
  const [consumo, setConsumo] = useState('');
  const [comp,    setComp]    = useState('no');
  const [notas,   setNotas]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const montoNum = parseFloat(monto) || 0;
  const miParte  = Math.round(comp === 'si' ? partePorDiv(montoNum, 'prop', prop) : montoNum);

  async function handleSubmit() {
    if (!tipo || !montoNum || !vcto) { setError('Completá tipo, importe y vencimiento'); return; }
    setError(''); setLoading(true);
    try {
      await sbPost('servicios', {
        mes              : new Date(vcto).toLocaleString('es-AR', { month: 'long' }),
        anio             : new Date(vcto).getFullYear(),
        servicio         : tipo,
        monto_total      : montoNum,
        consumo          : consumo || null,
        quien_pago       : 'pendiente',
        mi_parte         : miParte,
        notas            : notas || null,
        user_id          : user.id,
        estado           : 'pendiente',
        fecha_vencimiento: vcto,
        es_compartido    : comp === 'si',
      });
      onSuccess('Servicio registrado ✓');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setLoading(false); }
  }

  return (
    <Card className={styles.formCard}>
      <RadioGroup name="tipo" label="Tipo de servicio *" options={TIPO_OPTIONS} value={tipo} onChange={setTipo} />
      <Input label="Importe a pagar ($) *" type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} fullWidth />
      <Input label="Fecha de vencimiento *" type="date" value={vcto} onChange={e => setVcto(e.target.value)} fullWidth />
      <Input label="Consumo (opcional)" placeholder="180 kWh / 12 m³…" value={consumo} onChange={e => setConsumo(e.target.value)} fullWidth />
      <RadioGroup name="comp" label="¿Es compartido?" options={COMP_OPTIONS} value={comp} onChange={setComp} />
      {montoNum > 0 && (
        <div className={styles.pill}><span>Tu parte</span><strong>{fmt(miParte)}</strong></div>
      )}
      <Input label="Notas" placeholder="Opcional…" value={notas} onChange={e => setNotas(e.target.value)} fullWidth />
      <div className={styles.alertInfo}>🔔 Recibirás una notificación el día del vencimiento.</div>
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="primary" fullWidth loading={loading} onClick={handleSubmit} style={{ marginTop: 8 }}>
        Guardar servicio
      </Button>
    </Card>
  );
}
