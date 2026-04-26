import { useState }                        from 'react';
import { Input, Select, Button, Card }     from '../../../components/ui';
import { RadioGroup }                      from '../../../components/ui/RadioGroup';
import { usarSesion }                       from '../../../context/SesionContext';
import { sbPost }                          from '../../../lib/supabase';
import { crearDeudaInterpersonal }         from '../../../lib/deudas.service';
import { CATEGORIAS }                      from '../../../lib/types';
import { fmt, obtenerFechaISO, partePorDiv, num } from '../../../lib/utils';
import styles                              from './forms.module.css';

interface Props {
  onExito: (mensaje: string) => void;
}

const OPCIONES_DIVISION = [
  { value: 'personal', label: 'Solo mío' },
  { value: 'prop',     label: 'Proporcional', sublabel: 'Según ingresos del hogar' },
  { value: 'mitad',    label: '50/50' },
  { value: 'novia',    label: 'Lo pagué yo — es de mi pareja' },
];

const OPCIONES_CUOTAS = [
  { value: 'no', label: 'No, pago único' },
  { value: 'si', label: 'Sí, en cuotas' },
];

export function GastoForm({ onExito }: Props) {
  const { usuario, pareja, medios, proporcion } = usarSesion();

  const [fecha,      setFecha]      = useState(obtenerFechaISO());
  const [desc,       setDesc]       = useState('');
  const [cat,        setCat]        = useState('');
  const [medioId,    setMedioId]    = useState('');
  const [monto,      setMonto]      = useState('');
  const [division,   setDivision]   = useState('personal');
  const [enCuotas,   setEnCuotas]   = useState('no');
  const [cantCuotas, setCantCuotas] = useState('');
  const [notas,      setNotas]      = useState('');
  const [cargando,   setCargando]   = useState(false);
  const [error,      setError]      = useState('');

  const medio      = medios.find(m => m.id === medioId);
  const esCred     = medio?.tipo === 'credito';
  const esComp     = ['prop', 'mitad'].includes(division);
  const montoNum   = num(monto);
  const esDePareja = division === 'novia';
  const miParte    = esDePareja ? 0 : Math.round(partePorDiv(montoNum, division, proporcion));
  const parteOtro  = Math.round(montoNum - miParte);

  const opsCat    = CATEGORIAS.map(c => ({ value: c, label: c }));
  const opsMedios = medios.map(m => ({ value: m.id, label: m.nombre }));

  async function guardar() {
    if (!desc || !cat || !medioId || !montoNum || !division) {
      setError('Completá todos los campos obligatorios'); return;
    }
    setError(''); setCargando(true);
    try {
      // Si el medio es tarjeta de crédito, el gasto queda comprometido
      // (no impacta en disponible ni genera deuda hasta cargar el resumen)
      const esCredito = medio?.tipo === 'credito';
      const estado    = esCredito ? 'comprometido' : 'confirmado';

      const mov = await sbPost<{ id: string }>('movimientos', {
        fecha,
        tipo             : 'gasto',
        descripcion      : desc,
        categoria        : cat,
        medio_pago       : medio?.nombre || medioId,
        division,
        monto_total      : montoNum,
        mi_parte         : miParte,
        monto_pagado     : montoNum,
        parte_usuario    : miParte,
        parte_contraparte: parteOtro,
        en_cuotas        : enCuotas === 'si',
        cant_cuotas      : enCuotas === 'si' && cantCuotas ? parseInt(cantCuotas) : null,
        notas            : notas || null,
        user_id          : usuario.id,
        es_compartido    : esComp,
        estado,
      });

      // Solo generar deuda interpersonal si NO es crédito
      // Para crédito, la deuda se genera al asociar el movimiento al resumen
      if (!esCredito && parteOtro > 0 && pareja) {
        await crearDeudaInterpersonal({
          acreedorId  : usuario.id,
          deudorId    : pareja.id,
          descripcion : `${desc} — ${division === 'mitad' ? '50/50' : 'proporcional'}`,
          montoTotal  : parteOtro,
          origen      : 'gasto',
          movimientoId: mov.id,
          notas       : `Gasto del ${fecha}`,
        });
      }

      const msg = esCredito
        ? 'Gasto en tarjeta guardado ✓ — se sumará al disponible cuando cargues el resumen'
        : parteOtro > 0 && pareja
          ? `Gasto guardado ✓ — ${pareja.nombre} te debe ${fmt(parteOtro)}`
          : 'Gasto guardado ✓';

      onExito(msg);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setCargando(false); }
  }

  return (
    <Card className={styles.formCard}>
      <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} fullWidth />
      <Input label="Descripción *" placeholder="Supermercado, delivery…" value={desc} onChange={e => setDesc(e.target.value)} fullWidth />
      <Select label="Categoría *" options={opsCat} value={cat} onChange={e => setCat(e.target.value)} placeholder="— Elegí —" fullWidth />
      <Select label="Medio de pago *" options={opsMedios} value={medioId} onChange={e => setMedioId(e.target.value)} placeholder="— Elegí —" fullWidth />

      {esCred && <RadioGroup name="cuotas" label="¿En cuotas?" options={OPCIONES_CUOTAS} value={enCuotas} onChange={setEnCuotas} />}
      {esCred && enCuotas === 'si' && (
        <Select
          label   ="Cantidad de cuotas"
          options ={['2','3','6','9','12','18','24'].map(v => ({ value: v, label: `${v} cuotas` }))}
          value   ={cantCuotas}
          onChange={e => setCantCuotas(e.target.value)}
          placeholder="—"
          fullWidth
        />
      )}

      <Input label="Monto total ($) *" type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} fullWidth />
      <RadioGroup name="division" label="División *" options={OPCIONES_DIVISION} value={division} onChange={setDivision} />

      {montoNum > 0 && (
        <div className={styles.pill}><span>Mi parte</span><strong>{fmt(miParte)}</strong></div>
      )}

      {esCred && (
        <div className={styles.alertInfo}>
          💳 Este gasto quedará pendiente hasta que cargues el resumen de la tarjeta. No impacta en tu disponible ni genera deuda hasta ese momento.
        </div>
      )}

      {!esCred && esComp && parteOtro > 0 && division !== 'novia' && pareja && (
        <div className={styles.alert}>
          ⚡ Se generará una deuda de <strong>{fmt(parteOtro)}</strong> de {pareja.nombre} hacia vos.
        </div>
      )}

      <Input label="Notas" placeholder="Opcional…" value={notas} onChange={e => setNotas(e.target.value)} fullWidth />
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="primary" fullWidth loading={cargando} onClick={guardar} style={{ marginTop: 8 }}>
        Guardar gasto
      </Button>
    </Card>
  );
}
