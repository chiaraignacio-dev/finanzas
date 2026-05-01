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

// Detecta si una fecha cae en los últimos 7 días del mes
function esCobradoAFinDeMes(fechaISO: string): boolean {
  const fecha     = new Date(fechaISO + 'T00:00:00');
  const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
  return fecha.getDate() >= ultimoDia - 6;
}

// Devuelve el 1ro del mes siguiente a una fecha ISO
function primeroDiaMesSiguiente(fechaISO: string): string {
  const fecha   = new Date(fechaISO + 'T00:00:00');
  const siguiente = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1);
  return siguiente.toISOString().split('T')[0];
}

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

  // Determina la fecha_recibido real a usar al guardar
  // Para sueldos/quincenas cobrados a fin de mes → usar el 1ro del mes siguiente
  function calcularFechaRecibido(): string {
    if (recibido !== 'si') return obtenerFechaISO();
    const esSueldoOQuincena = tipo === 'sueldo' || tipo === 'quincena';
    if (esSueldoOQuincena && esCobradoAFinDeMes(fechaEsp)) {
      return primeroDiaMesSiguiente(fechaEsp);
    }
    return fechaEsp;
  }

  const fechaRecibidoReal = recibido === 'si' ? calcularFechaRecibido() : null;
  const mostrarAviso =
    recibido === 'si' &&
    (tipo === 'sueldo' || tipo === 'quincena') &&
    esCobradoAFinDeMes(fechaEsp);

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
        fecha_recibido : fechaRecibidoReal,
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
      <Input
        label="Descripción *"
        placeholder="Sueldo abril, bono, venta…"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        fullWidth
      />
      <Select
        label="Tipo"
        options={OPCIONES_TIPO}
        value={tipo}
        onChange={e => setTipo(e.target.value)}
        fullWidth
      />
      <Input
        label="Monto ($) *"
        type="number"
        placeholder="0"
        value={monto}
        onChange={e => setMonto(e.target.value)}
        fullWidth
      />
      <Input
        label="Fecha de cobro"
        type="date"
        value={fechaEsp}
        onChange={e => setFechaEsp(e.target.value)}
        fullWidth
      />
      <RadioGroup
        name="recibido"
        label="¿Ya lo recibiste? *"
        options={OPCIONES_RECIBIDO}
        value={recibido}
        onChange={setRecibido}
      />

      {/* Aviso automático para sueldos cobrados a fin de mes */}
      {mostrarAviso && (
        <div className={styles.alertaOk}>
          📅 Cobrado a fin de mes — se imputará al <strong>1 de {
            new Date(primeroDiaMesSiguiente(fechaEsp) + 'T00:00:00')
              .toLocaleString('es-AR', { month: 'long' })
          }</strong> para que impacte en el mes correcto.
        </div>
      )}

      {!mostrarAviso && recibido === 'si' && (
        <div className={styles.alertaOk}>✅ Se sumará al disponible inmediatamente.</div>
      )}
      {recibido === 'no' && (
        <div className={styles.alertaInfo}>⏳ No impacta hasta que confirmes el cobro.</div>
      )}

      <Input
        label="Notas"
        placeholder="Opcional…"
        value={notas}
        onChange={e => setNotas(e.target.value)}
        fullWidth
      />
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="primary" fullWidth loading={cargando} onClick={guardar}>
        Registrar ingreso
      </Button>
    </Card>
  );
}
