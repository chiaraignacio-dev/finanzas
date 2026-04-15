import { useState } from 'react';
import { Input, Select, Button, Card } from '../../../components/ui';
import { RadioGroup } from '../../../components/ui/RadioGroup';
import { sbPost, sbPatch } from '../../../lib/supabase';
import { FISO } from '../../../lib/utils';
import type { Usuario, Meta } from '../../../lib/types';
import styles from './forms.module.css';

interface Props {
  user     : Usuario;
  metas    : Meta[];
  onSuccess: (msg: string) => void;
}

const DEST_OPTIONS = [
  { value: 'pesos', label: 'Cuenta en pesos' },
  { value: 'dolar', label: 'Dólares (MEP / billetera)' },
  { value: 'pf',    label: 'Plazo fijo / FCI' },
];

export function AhorroForm({ user, metas, onSuccess }: Props) {
  const [metaId, setMetaId] = useState('');
  const [fecha,  setFecha]  = useState(FISO);
  const [monto,  setMonto]  = useState('');
  const [dest,   setDest]   = useState('pesos');
  const [notas,  setNotas]  = useState('');
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState('');

  const meta     = metas.find(m => m.id === metaId);
  const montoNum = parseFloat(monto) || 0;
  const pct      = meta && montoNum ? ((montoNum / parseFloat(meta.monto_objetivo)) * 100).toFixed(2) : null;

  const metaOptions = metas.map(m => ({
    value: m.id,
    label: `${m.emoji || '🎯'} ${m.nombre} — $${Math.round(parseFloat(m.monto_objetivo)).toLocaleString('es-AR')}`,
  }));

  async function handleSubmit() {
    if (!metaId || !montoNum) { setError('Elegí una meta y completá el monto'); return; }
    setError(''); setLoading(true);
    try {
      await sbPost('movimientos', {
        fecha,
        tipo         : 'ahorro',
        descripcion  : 'Ahorro: ' + (meta?.nombre || '—'),
        categoria    : 'Ahorro',
        medio_pago   : dest,
        division     : 'personal',
        tipo_division: 'personal',
        monto_total  : montoNum,
        mi_parte     : montoNum,
        es_deuda     : false,
        es_ahorro    : true,
        en_cuotas    : false,
        notas        : notas || meta?.nombre || null,
        user_id      : user.id,
        es_compartido: false,
        estado       : 'confirmado',
      });
      if (meta) {
        await sbPatch('metas', metaId, {
          monto_actual: parseFloat(meta.monto_actual) + montoNum,
        });
      }
      onSuccess(`Ahorro guardado ✓ — aportaste ${pct}% a "${meta?.nombre}"`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setLoading(false); }
  }

  return (
    <Card className={styles.formCard}>
      <Select label="Meta de ahorro *" options={metaOptions} value={metaId} onChange={e => setMetaId(e.target.value)} placeholder="— Elegí una meta —" fullWidth />
      <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} fullWidth />
      <Input label="Monto ($) *" type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} fullWidth />
      {pct && (
        <div className={styles.pill}><span>Aporte a la meta</span><strong>{pct}%</strong></div>
      )}
      <RadioGroup name="dest" label="¿Dónde lo guardaste?" options={DEST_OPTIONS} value={dest} onChange={setDest} />
      <Input label="Notas" placeholder="Opcional…" value={notas} onChange={e => setNotas(e.target.value)} fullWidth />
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="success" fullWidth loading={loading} onClick={handleSubmit} style={{ marginTop: 8 }}>
        Guardar ahorro
      </Button>
    </Card>
  );
}
