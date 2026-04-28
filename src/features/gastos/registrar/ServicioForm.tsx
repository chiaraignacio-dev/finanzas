import { useState }                       from 'react';
import { Input, Button, Card }            from '../../../components/ui';
import { RadioGroup }                     from '../../../components/ui/RadioGroup';
import { usarSesion }                     from '../../../context/SesionContext';
import { sbPost }                         from '../../../lib/supabase';
import { crearDeudaInterpersonal }        from '../../../lib/deudas.service';
import { fmt, partePorDiv, num }          from '../../../lib/utils';
import styles                             from './forms.module.css';

interface Props { onExito: (msg: string) => void; }

const OPCIONES_TIPO = [
  { value: 'luz',      label: '⚡ Luz (EPRE)' },
  { value: 'agua',     label: '💧 Agua (AYSAM)' },
  { value: 'gas',      label: '🔥 Gas (Naturgy)' },
  { value: 'internet', label: '📡 Internet / Cable' },
  { value: 'expensas', label: '🏢 Expensas' },
];
const OPCIONES_COMPARTIDO = [
  { value: 'si', label: 'Sí, lo compartimos' },
  { value: 'no', label: 'No, es solo mío' },
];

export function ServicioForm({ onExito }: Props) {
  const { usuario, pareja, proporcion } = usarSesion();
  const [tipo,     setTipo]     = useState('');
  const [monto,    setMonto]    = useState('');
  const [vcto,     setVcto]     = useState('');
  const [consumo,  setConsumo]  = useState('');
  const [comp,     setComp]     = useState('no');
  const [notas,    setNotas]    = useState('');
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState('');

  const montoNum   = num(monto);
  const esComp     = comp === 'si';
  // Mi parte: si es compartido, proporcional; si no, el total
  const miParte    = Math.round(esComp ? partePorDiv(montoNum, 'prop', proporcion) : montoNum);
  const parteOtro  = Math.round(montoNum - miParte);

  async function guardar() {
    if (!tipo || !montoNum || !vcto) { setError('Completá tipo, importe y vencimiento'); return; }
    setError(''); setCargando(true);
    try {
      // 1. Crear el servicio
      await sbPost('servicios', {
        servicio         : tipo,
        monto_total      : montoNum,
        consumo          : consumo || null,
        quien_pago       : 'pendiente',
        mi_parte         : miParte,
        notas            : notas || null,
        user_id          : usuario.id,
        estado           : 'pendiente',
        fecha_vencimiento: vcto,
        es_compartido    : esComp,
      });

      // 2. Si es compartido, generar deuda interpersonal de Abril hacia Ignacio
      //    (Ignacio va a pagar el total, Abril le debe su parte)
      if (esComp && parteOtro > 0 && pareja) {
        await crearDeudaInterpersonal({
          acreedorId  : usuario.id,
          deudorId    : pareja.id,
          descripcion : `Servicio: ${tipo} — vence ${vcto}`,
          montoTotal  : parteOtro,
          origen      : 'manual',
          notas       : `Parte de ${pareja.nombre} en ${tipo}${consumo ? ` (${consumo})` : ''}`,
        });
      }

      const msg = esComp && pareja
        ? `Servicio registrado ✓ — ${pareja.nombre} te debe ${fmt(parteOtro)}`
        : 'Servicio registrado ✓';

      onExito(msg);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setCargando(false); }
  }

  return (
    <Card className={styles.formCard}>
      <RadioGroup name="tipo" label="Tipo de servicio *" options={OPCIONES_TIPO} value={tipo} onChange={setTipo} />
      <Input label="Importe a pagar ($) *" type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} fullWidth />
      <Input label="Fecha de vencimiento *" type="date" value={vcto} onChange={e => setVcto(e.target.value)} fullWidth />
      <Input label="Consumo (opcional)" placeholder="180 kWh / 12 m³…" value={consumo} onChange={e => setConsumo(e.target.value)} fullWidth />
      <RadioGroup name="comp" label="¿Es compartido?" options={OPCIONES_COMPARTIDO} value={comp} onChange={setComp} />

      {montoNum > 0 && (
        <div className={styles.pill}>
          <span>Tu parte</span>
          <strong>{fmt(miParte)}</strong>
        </div>
      )}

      {esComp && parteOtro > 0 && pareja && (
        <div className={styles.alert}>
          ⚡ Se registrará que {pareja.nombre} te debe <strong>{fmt(parteOtro)}</strong> cuando pagues el servicio.
        </div>
      )}

      <Input label="Notas" placeholder="Opcional…" value={notas} onChange={e => setNotas(e.target.value)} fullWidth />
      <div className={styles.alertInfo}>🔔 Aparecerá en Deudas hasta que lo marques como pagado.</div>
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="primary" fullWidth loading={cargando} onClick={guardar}>Guardar servicio</Button>
    </Card>
  );
}
