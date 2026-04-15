import { useState } from 'react';
import { Input, Button, Card } from '../../../components/ui';
import { sbPost } from '../../../lib/supabase';
import { fmt, FISO } from '../../../lib/utils';
import type { Usuario } from '../../../lib/types';
import styles from './forms.module.css';

interface Props {
  user     : Usuario;
  onSuccess: (msg: string) => void;
}

export function IngresoForm({ user, onSuccess }: Props) {
  const [fecha,  setFecha]  = useState(FISO);
  const [desc,   setDesc]   = useState('');
  const [monto,  setMonto]  = useState('');
  const [notas,  setNotas]  = useState('');
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState('');

  const montoNum = parseFloat(monto) || 0;

  async function handleSubmit() {
    if (!desc || !montoNum) { setError('Completá descripción y monto'); return; }
    setError(''); setLoading(true);
    try {
      await sbPost('movimientos', {
        fecha,
        tipo         : 'ingreso',
        descripcion  : 'INGRESO: ' + desc,
        categoria    : 'Ingreso extra',
        medio_pago   : 'transferencia',
        division     : 'personal',
        tipo_division: 'personal',
        monto_total  : montoNum,
        mi_parte     : montoNum,
        es_deuda     : false,
        es_ahorro    : false,
        en_cuotas    : false,
        notas        : notas || null,
        user_id      : user.id,
        es_compartido: false,
        estado       : 'confirmado',
      });
      onSuccess('Ingreso guardado ✓');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setLoading(false); }
  }

  return (
    <Card className={styles.formCard}>
      <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} fullWidth />
      <Input label="Descripción *" placeholder="Changa, venta, bono…" value={desc} onChange={e => setDesc(e.target.value)} fullWidth />
      <Input label="Monto ($) *" type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} fullWidth />
      {montoNum > 0 && (
        <div className={styles.pill}><span>Monto</span><strong>{fmt(montoNum)}</strong></div>
      )}
      <Input label="Notas" placeholder="Opcional…" value={notas} onChange={e => setNotas(e.target.value)} fullWidth />
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="primary" fullWidth loading={loading} onClick={handleSubmit} style={{ marginTop: 8 }}>
        Guardar ingreso
      </Button>
    </Card>
  );
}
