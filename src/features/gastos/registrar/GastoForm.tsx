import { useState } from 'react';
import { Input, Select, Button, Card } from '../../../components/ui';
import { RadioGroup } from '../../../components/ui/RadioGroup';
import { sbPost } from '../../../lib/supabase';
import { CATEGORIAS, type MedioPago, type Usuario } from '../../../lib/types';
import { fmt, FISO, partePorDiv } from '../../../lib/utils';
import styles from './forms.module.css';

interface Props {
  user    : Usuario;
  medios  : MedioPago[];
  prop    : number;
  onSuccess: (msg: string) => void;
}

const DIVISION_OPTIONS = [
  { value: 'personal', label: 'Solo mío' },
  { value: 'prop',     label: 'Compartido proporcional', sublabel: 'Según ingresos del hogar' },
  { value: 'mitad',    label: 'Compartido 50/50' },
  { value: 'novia',    label: 'Lo pagué yo / es de mi pareja' },
];

const CUOTAS_OPTIONS = [
  { value: 'no', label: 'No, pago único' },
  { value: 'si', label: 'Sí, en cuotas' },
];

export function GastoForm({ user, medios, prop, onSuccess }: Props) {
  const [fecha,   setFecha]   = useState(FISO);
  const [desc,    setDesc]    = useState('');
  const [cat,     setCat]     = useState('');
  const [medioId, setMedioId] = useState('');
  const [monto,   setMonto]   = useState('');
  const [div,     setDiv]     = useState('personal');
  const [enCuotas,setEnCuotas]= useState('no');
  const [cantCuotas,setCantCuotas] = useState('');
  const [notas,   setNotas]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const medio    = medios.find(m => m.id === medioId);
  const esCred   = medio?.tipo === 'credito';
  const esComp   = ['prop', 'mitad'].includes(div);
  const montoNum = parseFloat(monto) || 0;
  const miParte  = partePorDiv(montoNum, div, prop);

  const catOptions = CATEGORIAS.map(c => ({ value: c, label: c }));
  const medOptions = medios.map(m => ({ value: m.id, label: m.nombre }));

  async function handleSubmit() {
    if (!desc || !cat || !medioId || !montoNum || !div) {
      setError('Completá todos los campos obligatorios');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sbPost('movimientos', {
        fecha,
        tipo             : 'gasto',
        descripcion      : desc,
        categoria        : cat,
        medio_pago       : medio?.nombre || medioId,
        division         : div,
        tipo_division    : div,
        monto_total      : montoNum,
        mi_parte         : Math.round(miParte),
        parte_usuario    : Math.round(miParte),
        parte_contraparte: Math.round(montoNum - miParte),
        es_deuda         : false,
        es_ahorro        : false,
        en_cuotas        : enCuotas === 'si',
        cant_cuotas      : enCuotas === 'si' && cantCuotas ? parseInt(cantCuotas) : null,
        notas            : notas || null,
        user_id          : user.id,
        es_compartido    : esComp,
        estado           : esComp ? 'pendiente' : 'confirmado',
      });
      onSuccess(esComp ? '⚡ Enviado a tu pareja' : 'Gasto guardado ✓');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={styles.formCard}>
      <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} fullWidth />
      <Input label="Descripción *" placeholder="Supermercado, delivery…" value={desc} onChange={e => setDesc(e.target.value)} fullWidth />
      <Select label="Categoría *" options={catOptions} value={cat} onChange={e => setCat(e.target.value)} placeholder="— Elegí —" fullWidth />
      <Select label="Medio de pago *" options={medOptions} value={medioId} onChange={e => setMedioId(e.target.value)} placeholder="— Elegí —" fullWidth />

      {esCred && (
        <RadioGroup name="cuotas" label="¿En cuotas?" options={CUOTAS_OPTIONS} value={enCuotas} onChange={setEnCuotas} />
      )}
      {esCred && enCuotas === 'si' && (
        <Select
          label="Cantidad de cuotas"
          options={['2','3','6','9','12','18','24'].map(v => ({ value: v, label: `${v} cuotas` }))}
          value={cantCuotas}
          onChange={e => setCantCuotas(e.target.value)}
          placeholder="—"
          fullWidth
        />
      )}

      <Input label="Monto total ($) *" type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} fullWidth />

      <RadioGroup name="division" label="División *" options={DIVISION_OPTIONS} value={div} onChange={setDiv} />

      {esComp && (
        <div className={styles.alert}>⚡ Gasto compartido — tu pareja deberá confirmarlo.</div>
      )}
      {montoNum > 0 && (
        <div className={styles.pill}>
          <span>Tu parte</span>
          <strong>{fmt(miParte)}</strong>
        </div>
      )}

      <Input label="Notas" placeholder="Opcional…" value={notas} onChange={e => setNotas(e.target.value)} fullWidth />

      {error && <div className={styles.error}>{error}</div>}

      <Button variant="primary" fullWidth loading={loading} onClick={handleSubmit} style={{ marginTop: 8 }}>
        Guardar gasto
      </Button>
    </Card>
  );
}
