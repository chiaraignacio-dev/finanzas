import { useState }                   from 'react';
import { Input, Button, Card }        from '../../components/ui';
import { RadioGroup }                 from '../../components/ui/RadioGroup';
import { usarSesion }                 from '../../context/SesionContext';
import { sbPost }                     from '../../lib/supabase';
import { crearDeudaInterpersonal }    from '../../lib/deudas.service';
import { fmt, obtenerFechaISO, partePorDiv, num } from '../../lib/utils';
import styles                         from './DeudaExplicitaForm.module.css';

interface Props { onDone: () => void; }

const OPCIONES_DIVISION = [
  { value: 'personal', label: 'Solo mía' },
  { value: 'prop',     label: 'Proporcional con pareja' },
  { value: 'mitad',    label: '50/50 con pareja' },
];

export function DeudaExplicitaForm({ onDone }: Props) {
  // FIX 1: agregar pareja al destructuring
  const { usuario, proporcion, pareja } = usarSesion();
  const [desc,     setDesc]     = useState('');
  const [total,    setTotal]    = useState('');
  const [yaPagado, setYaPagado] = useState('');
  const [vcto,     setVcto]     = useState('');
  const [division, setDivision] = useState('personal');
  const [notas,    setNotas]    = useState('');
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState('');

  const totalNum    = num(total);
  const yaPagadoNum = num(yaPagado);
  const saldoDeuda  = Math.max(0, totalNum - yaPagadoNum);
  const miParte     = Math.round(partePorDiv(saldoDeuda, division, proporcion));

  async function guardar() {
    if (!desc || !totalNum)       { setError('Completá descripción y monto total'); return; }
    if (yaPagadoNum > totalNum)   { setError('Lo ya pagado no puede superar el total'); return; }
    setError(''); setCargando(true);
    try {
      // FIX 2: estado siempre 'pendiente' cuando hay saldo, 'confirmado' solo si está saldado
      const estadoMovimiento = saldoDeuda > 0 ? 'pendiente' : 'confirmado';

      const mov = await sbPost<{ id: string }>('movimientos', {
        fecha                : obtenerFechaISO(),
        tipo                 : 'deuda',
        descripcion          : desc,
        categoria            : 'Deuda',
        medio_pago           : 'pendiente',
        division,
        monto_total          : totalNum,
        monto_inicial_pagado : yaPagadoNum,
        monto_pagado         : yaPagadoNum,
        mi_parte             : miParte,
        parte_usuario        : miParte,
        parte_contraparte    : Math.round(saldoDeuda - miParte),
        en_cuotas            : false,
        notas                : [notas, vcto ? `Vence: ${vcto}` : ''].filter(Boolean).join(' · ') || null,
        user_id              : usuario.id,
        es_compartido        : division !== 'personal',
        estado               : estadoMovimiento,
      });

      // FIX 3: crear deuda interpersonal si es compartida y hay saldo pendiente de la pareja
      if (division !== 'personal' && saldoDeuda > 0 && pareja) {
        const partePareja = Math.round(saldoDeuda - miParte);
        if (partePareja > 0) {
          await crearDeudaInterpersonal({
            acreedorId   : usuario.id,
            deudorId     : pareja.id,
            descripcion  : `${desc} — ${division === 'mitad' ? '50/50' : 'proporcional'}`,
            montoTotal   : partePareja,
            origen       : 'manual',
            movimientoId : mov.id,
            notas        : [notas, vcto ? `Vence: ${vcto}` : ''].filter(Boolean).join(' · ') || null,
          });
        }
      }

      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setCargando(false); }
  }

  return (
    <Card className={styles.card}>
      <Input label="Descripción *" placeholder="Seña depto, electrodoméstico, préstamo…" value={desc} onChange={e => setDesc(e.target.value)} fullWidth />
      <Input label="Monto total ($) *" type="number" placeholder="0" value={total} onChange={e => setTotal(e.target.value)} fullWidth />
      <Input label="Ya pagado ($)" type="number" placeholder="0" value={yaPagado} onChange={e => setYaPagado(e.target.value)} hint="Ej: seña de $30.000 sobre un total de $130.000" fullWidth />
      {totalNum > 0 && (
        <div className={styles.resumen}>
          <div className={styles.resumenFila}><span>Total</span><span>{fmt(totalNum)}</span></div>
          {yaPagadoNum > 0 && <div className={styles.resumenFila}><span style={{ color: 'var(--gn)' }}>Ya pagado</span><span style={{ color: 'var(--gn)' }}>- {fmt(yaPagadoNum)}</span></div>}
          <div className={styles.resumenFilaTotal}><span>Saldo pendiente</span><span style={{ color: 'var(--rd)', fontFamily: 'var(--font-mono)', fontSize: 18 }}>{fmt(saldoDeuda)}</span></div>
        </div>
      )}
      <Input label="Fecha de vencimiento" type="date" value={vcto} onChange={e => setVcto(e.target.value)} fullWidth />
      <RadioGroup name="division" label="¿Con quién es la deuda?" options={OPCIONES_DIVISION} value={division} onChange={setDivision} />
      {division !== 'personal' && saldoDeuda > 0 && pareja && (
        <div className={styles.alertaInfo}>
          Tu parte del saldo: <strong>{fmt(miParte)}</strong>
          {' · '}Parte de {pareja.nombre}: <strong>{fmt(Math.round(saldoDeuda - miParte))}</strong>
        </div>
      )}
      <Input label="Notas" placeholder="Opcional…" value={notas} onChange={e => setNotas(e.target.value)} fullWidth />
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="primary" fullWidth loading={cargando} onClick={guardar}>Registrar deuda</Button>
    </Card>
  );
}
