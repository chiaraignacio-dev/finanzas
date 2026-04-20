import { useState }                   from 'react';
import { Input, Select, Button, Card } from '../../components/ui';
import { RadioGroup }                 from '../../components/ui/RadioGroup';
import { usarSesion }                 from '../../context/SesionContext';
import { sbPost }                     from '../../lib/supabase';
import { obtenerFechaISO, num }       from '../../lib/utils';
import styles                         from './IngresoForm.module.css';

interface Props { onDone: () => void; }

const OPCIONES_TIPO = [
  { value: 'sueldo',   label: '💼 Sueldo mensual' },
  { value: 'quincena', label: '📅 Quincena' },
  { value: 'extra',    label: '💰 Ingreso extra' },
  { value: 'otro',     label: '📌 Otro' },
];
const OPCIONES_RECIBIDO = [
  { value: 'si', label: 'Sí — ya lo recibí',  sublabel: 'Impacta inmediatamente en disponible' },
  { value: 'no', label: 'No — lo espero',      sublabel: 'No impacta hasta que confirmes el cobro' },
];

export function IngresoForm({ onDone }: Props) {
  const { usuario }              = usarSesion();
  const [desc,     setDesc]     = useState('');
  const [monto,    setMonto]    = useState('');
  const [tipo,     setTipo]     = useState('sueldo');
  const [recibido, setRecibido] = useState('si');
  const [fechaEsp, setFechaEsp] = useState(obtenerFechaISO());
  const [notas,    setNotas]    = useState('');
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState('');

  const montoNum = num(monto);

  async function guardar() {
    if (!desc || !montoNum) { setError('Completá descripción y monto'); return; }
    setError(''); setCargando(true);
    try {
      await sbPost('ingresos', {
        user_id        : usuario.id,
        descripcion    : desc,
        monto          : montoNum,
        tipo,
        fecha_esperada : fechaEsp || null,
        fecha_recibido : recibido === 'si' ? obtenerFechaISO() : null,
        recibido       : recibido === 'si',
        recurrente     : false,
        notas          : notas || null,
      });
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setCargando(false); }
  }

  return (
    <Card className={styles.card}>
      <Input label="Descripción *" placeholder="Sueldo abril, bono, venta…" value={desc} onChange={e => setDesc(e.target.value)} fullWidth />
      <Select label="Tipo" options={OPCIONES_TIPO} value={tipo} onChange={e => setTipo(e.target.value)} fullWidth />
      <Input label="Monto ($) *" type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} fullWidth />
      <Input label="Fecha esperada de cobro" type="date" value={fechaEsp} onChange={e => setFechaEsp(e.target.value)} fullWidth />
      <RadioGroup name="recibido" label="¿Ya lo recibiste? *" options={OPCIONES_RECIBIDO} value={recibido} onChange={setRecibido} />
      <div className={recibido === 'si' ? styles.alertaOk : styles.alertaInfo}>
        {recibido === 'si' ? '✅ Se sumará al disponible inmediatamente.' : '⏳ No impacta hasta que confirmes el cobro.'}
      </div>
      <Input label="Notas" placeholder="Opcional…" value={notas} onChange={e => setNotas(e.target.value)} fullWidth />
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="primary" fullWidth loading={cargando} onClick={guardar}>Registrar ingreso</Button>
    </Card>
  );
}
