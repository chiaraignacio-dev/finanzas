import { useState } from 'react';
import { Input, Button, Card } from '../../../components/ui';
import { RadioGroup } from '../../../components/ui/RadioGroup';
import { sbPost } from '../../../lib/supabase';
import { fmt, FISO } from '../../../lib/utils';
import type { Usuario } from '../../../lib/types';
import styles from './forms.module.css';

interface Props {
  user     : Usuario;
  onSuccess: (msg: string) => void;
}

const CUAL_OPTIONS = [
  { value: 'bbva', label: '💳 Visa BBVA', sublabel: 'TNA 80,83%' },
  { value: 'uala', label: '📱 Uala' },
  { value: 'mp',   label: '🟦 Préstamo MercadoPago' },
  { value: 'otra', label: 'Otra' },
];

const TIPO_OPTIONS = [
  { value: 'minimo',  label: 'Pago mínimo' },
  { value: 'parcial', label: 'Pago parcial' },
  { value: 'total',   label: 'Pago total ✅' },
];

export function DeudaForm({ user, onSuccess }: Props) {
  const [fecha,  setFecha]  = useState(FISO);
  const [cual,   setCual]   = useState('');
  const [otra,   setOtra]   = useState('');
  const [monto,  setMonto]  = useState('');
  const [tipo,   setTipo]   = useState('');
  const [notas,  setNotas]  = useState('');
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState('');

  const montoNum = parseFloat(monto) || 0;
  const lab      = cual === 'otra' ? otra : cual.toUpperCase();

  async function handleSubmit() {
    if (!cual || !montoNum) { setError('Completá los campos obligatorios'); return; }
    setError(''); setLoading(true);
    try {
      await sbPost('movimientos', {
        fecha,
        tipo          : 'deuda',
        descripcion   : 'Pago deuda: ' + lab,
        categoria     : 'Deuda',
        medio_pago    : cual,
        division      : 'personal',
        tipo_division : 'personal',
        monto_total   : montoNum,
        mi_parte      : montoNum,
        es_deuda      : true,
        es_ahorro     : false,
        en_cuotas     : false,
        notas         : [tipo, notas].filter(Boolean).join(' · ') || null,
        user_id       : user.id,
        es_compartido : false,
        estado        : 'confirmado',
      });
      onSuccess('Pago guardado ✓');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setLoading(false); }
  }

  return (
    <Card className={styles.formCard}>
      <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} fullWidth />
      <RadioGroup name="cual" label="¿Qué deuda? *" options={CUAL_OPTIONS} value={cual} onChange={setCual} />
      {cual === 'bbva' && (
        <div className={styles.alertDanger}>🔴 Sin cancelar el total generás ~$35k en intereses por mes.</div>
      )}
      {cual === 'otra' && (
        <Input label="Nombre" placeholder="Ej: préstamo familiar…" value={otra} onChange={e => setOtra(e.target.value)} fullWidth />
      )}
      <Input label="Monto pagado ($) *" type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} fullWidth />
      {montoNum > 0 && (
        <div className={styles.pill}><span>Monto</span><strong>{fmt(montoNum)}</strong></div>
      )}
      <RadioGroup name="tipo" label="Tipo de pago" options={TIPO_OPTIONS} value={tipo} onChange={setTipo} />
      <Input label="Notas" placeholder="Opcional…" value={notas} onChange={e => setNotas(e.target.value)} fullWidth />
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="primary" fullWidth loading={loading} onClick={handleSubmit} style={{ marginTop: 8 }}>
        Guardar pago
      </Button>
    </Card>
  );
}
