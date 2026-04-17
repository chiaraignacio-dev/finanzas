import { useState } from 'react';
import { Input, Button, Card } from '../../components/ui';
import { RadioGroup } from '../../components/ui/RadioGroup';
import { sbPost } from '../../lib/supabase';
import { fmt, FISO, partePorDiv } from '../../lib/utils';
import type { Usuario } from '../../lib/types';
import styles from './DeudaExplicitaForm.module.css';

interface Props {
  user     : Usuario;
  prop     : number;
  allUsers : Record<string, Usuario>;
  onToast  : (msg: string, type?: 'ok' | 'err' | 'warn') => void;
  onDone   : () => void;
}

const DIVISION_OPTIONS = [
  { value: 'personal', label: 'Solo mía' },
  { value: 'prop',     label: 'Proporcional con pareja' },
  { value: 'mitad',    label: '50/50 con pareja' },
];

export function DeudaExplicitaForm({ user, prop, onToast, onDone }: Props) {
  const [desc,       setDesc]       = useState('');
  const [total,      setTotal]      = useState('');
  const [yaPagado,   setYaPagado]   = useState('');
  const [vcto,       setVcto]       = useState('');
  const [division,   setDivision]   = useState('personal');
  const [notas,      setNotas]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const totalNum     = parseFloat(total) || 0;
  const yaPagadoNum  = parseFloat(yaPagado) || 0;
  const saldoDeuda   = Math.max(0, totalNum - yaPagadoNum);
  const miParte      = Math.round(partePorDiv(saldoDeuda, division, prop));

  async function handleSubmit() {
    if (!desc || !totalNum) { setError('Completá descripción y monto total'); return; }
    if (yaPagadoNum > totalNum) { setError('Lo ya pagado no puede superar el total'); return; }
    setError(''); setLoading(true);

    try {
      await sbPost('movimientos', {
        fecha                : FISO,
        tipo                 : 'deuda',
        descripcion          : desc,
        categoria            : 'Deuda',
        medio_pago           : 'pendiente',
        division,
        tipo_division        : division,
        monto_total          : totalNum,
        monto_inicial_pagado : yaPagadoNum,
        monto_pagado         : yaPagadoNum,
        mi_parte             : miParte,
        parte_usuario        : miParte,
        parte_contraparte    : Math.round(saldoDeuda - miParte),
        es_deuda             : true,
        es_ahorro            : false,
        en_cuotas            : false,
        notas                : notas || null,
        user_id              : user.id,
        es_compartido        : division !== 'personal',
        es_deuda_interpersonal: false,
        estado               : saldoDeuda > 0 ? 'pendiente' : 'pagado',
        fecha_vencimiento    : vcto || null,
      });

      onToast('Deuda registrada ✓');
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setLoading(false); }
  }

  return (
    <Card className={styles.card}>
      <Input
        label      ="Descripción *"
        placeholder="Seña depto, electrodoméstico, préstamo…"
        value      ={desc}
        onChange   ={e => setDesc(e.target.value)}
        fullWidth
      />
      <Input
        label      ="Monto total ($) *"
        type       ="number"
        placeholder="0"
        value      ={total}
        onChange   ={e => setTotal(e.target.value)}
        fullWidth
      />
      <Input
        label      ="Ya pagado ($)"
        type       ="number"
        placeholder="0 — si no pagaste nada dejá en blanco"
        value      ={yaPagado}
        onChange   ={e => setYaPagado(e.target.value)}
        hint       ="Ej: seña de $30.000 sobre un total de $130.000"
        fullWidth
      />
      {totalNum > 0 && (
        <div className={styles.resumen}>
          <div className={styles.resumenRow}>
            <span>Total</span>
            <span>{fmt(totalNum)}</span>
          </div>
          {yaPagadoNum > 0 && (
            <div className={styles.resumenRow}>
              <span style={{ color: 'var(--gn)' }}>Ya pagado</span>
              <span style={{ color: 'var(--gn)' }}>- {fmt(yaPagadoNum)}</span>
            </div>
          )}
          <div className={styles.resumenRow} style={{ fontWeight: 700, borderTop: '1px solid var(--bd)', paddingTop: 8, marginTop: 4 }}>
            <span>Saldo pendiente</span>
            <span style={{ color: 'var(--rd)', fontFamily: 'var(--font-mono)', fontSize: 18 }}>{fmt(saldoDeuda)}</span>
          </div>
        </div>
      )}
      <Input
        label="Fecha de vencimiento"
        type ="date"
        value={vcto}
        onChange={e => setVcto(e.target.value)}
        fullWidth
      />
      <RadioGroup
        name    ="division"
        label   ="¿Con quién es la deuda?"
        options ={DIVISION_OPTIONS}
        value   ={division}
        onChange={setDivision}
      />
      {division !== 'personal' && saldoDeuda > 0 && (
        <div className={styles.alertInfo}>
          Tu parte del saldo: <strong>{fmt(miParte)}</strong>
        </div>
      )}
      <Input
        label      ="Notas"
        placeholder="Opcional…"
        value      ={notas}
        onChange   ={e => setNotas(e.target.value)}
        fullWidth
      />
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="primary" fullWidth loading={loading} onClick={handleSubmit}>
        Registrar deuda
      </Button>
    </Card>
  );
}
