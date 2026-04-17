import { useState } from 'react';
import { Input, Select, Button, Card } from '../../components/ui';
import { RadioGroup } from '../../components/ui/RadioGroup';
import { sbPost } from '../../lib/supabase';
import { FISO } from '../../lib/utils';
import type { Usuario } from '../../lib/types';
import styles from './IngresoForm.module.css';

interface Props {
  user     : Usuario;
  onToast  : (msg: string, type?: 'ok' | 'err' | 'warn') => void;
  onDone   : () => void;
}

const TIPO_OPTIONS = [
  { value: 'sueldo',   label: '💼 Sueldo mensual' },
  { value: 'quincena', label: '📅 Quincena' },
  { value: 'extra',    label: '💰 Ingreso extra' },
  { value: 'otro',     label: '📌 Otro' },
];

const RECIBIDO_OPTIONS = [
  { value: 'si', label: 'Sí — ya lo recibí', sublabel: 'Impacta inmediatamente en disponible' },
  { value: 'no', label: 'No — lo espero', sublabel: 'No impacta hasta que confirmes el cobro' },
];

export function IngresoForm({ user, onToast, onDone }: Props) {
  const [desc,      setDesc]      = useState('');
  const [monto,     setMonto]     = useState('');
  const [tipo,      setTipo]      = useState('sueldo');
  const [recibido,  setRecibido]  = useState('si');
  const [fechaEsp,  setFechaEsp]  = useState(FISO);
  const [notas,     setNotas]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const montoNum = parseFloat(monto) || 0;

  async function handleSubmit() {
    if (!desc || !montoNum) { setError('Completá descripción y monto'); return; }
    setError(''); setLoading(true);

    try {
      await sbPost('ingresos', {
        user_id        : user.id,
        descripcion    : desc,
        monto          : montoNum,
        tipo,
        fecha_esperada : fechaEsp || null,
        fecha_recibido : recibido === 'si' ? FISO : null,
        recibido       : recibido === 'si',
        recurrente     : false,
        notas          : notas || null,
      });

      onToast(recibido === 'si'
        ? 'Ingreso registrado y confirmado ✓'
        : 'Ingreso registrado — recordá confirmarlo cuando lo recibas');
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setLoading(false); }
  }

  return (
    <Card className={styles.card}>
      <Input
        label      ="Descripción *"
        placeholder="Sueldo abril, bono, venta…"
        value      ={desc}
        onChange   ={e => setDesc(e.target.value)}
        fullWidth
      />
      <Select
        label  ="Tipo"
        options={TIPO_OPTIONS}
        value  ={tipo}
        onChange={e => setTipo(e.target.value)}
        fullWidth
      />
      <Input
        label      ="Monto ($) *"
        type       ="number"
        placeholder="0"
        value      ={monto}
        onChange   ={e => setMonto(e.target.value)}
        fullWidth
      />
      <Input
        label="Fecha esperada de cobro"
        type ="date"
        value={fechaEsp}
        onChange={e => setFechaEsp(e.target.value)}
        fullWidth
      />
      <RadioGroup
        name    ="recibido"
        label   ="¿Ya lo recibiste? *"
        options ={RECIBIDO_OPTIONS}
        value   ={recibido}
        onChange={setRecibido}
      />
      <div className={recibido === 'si' ? styles.alertOk : styles.alertInfo}>
        {recibido === 'si'
          ? '✅ Se sumará al disponible inmediatamente.'
          : '⏳ No impacta en el disponible hasta que confirmes el cobro.'}
      </div>
      <Input
        label      ="Notas"
        placeholder="Opcional…"
        value      ={notas}
        onChange   ={e => setNotas(e.target.value)}
        fullWidth
      />
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="primary" fullWidth loading={loading} onClick={handleSubmit}>
        Registrar ingreso
      </Button>
    </Card>
  );
}
