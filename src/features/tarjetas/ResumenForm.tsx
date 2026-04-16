import { useState } from 'react';
import { Input, Select, Button, Card, Badge } from '../../components/ui';
import { sbPost } from '../../lib/supabase';
import { fmt, FISO } from '../../lib/utils';
import { CATEGORIAS } from '../../lib/types';
import type { Usuario, MedioPago } from '../../lib/types';
import styles from './ResumenForm.module.css';

interface Consumo {
  descripcion: string;
  monto      : string;
  categoria  : string;
  fecha      : string;
}

interface Props {
  user    : Usuario;
  medios  : MedioPago[];
  onToast : (msg: string, type?: 'ok' | 'err' | 'warn') => void;
  onDone  : () => void;
}

const CAT_OPTIONS  = CATEGORIAS.map(c => ({ value: c, label: c }));

export function ResumenForm({ user, medios, onToast, onDone }: Props) {
  // Datos del resumen
  const [tarjeta,  setTarjeta]  = useState('');
  const [periodo,  setPeriodo]  = useState('');
  const [vcto,     setVcto]     = useState('');
  const [total,    setTotal]    = useState('');
  const [notas,    setNotas]    = useState('');

  // Consumos del detalle
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [cDesc,    setCDesc]    = useState('');
  const [cMonto,   setCMonto]   = useState('');
  const [cCat,     setCCat]     = useState('Otro');
  const [cFecha,   setCFecha]   = useState(FISO);

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const medioOptions = medios
    .filter(m => m.tipo === 'credito')
    .map(m => ({ value: m.nombre, label: m.nombre }));

  const totalConsumos = consumos.reduce((a, c) => a + (parseFloat(c.monto) || 0), 0);
  const totalNum      = parseFloat(total) || 0;

  function addConsumo() {
    if (!cDesc || !cMonto) return;
    setConsumos(prev => [...prev, { descripcion: cDesc, monto: cMonto, categoria: cCat, fecha: cFecha }]);
    setCDesc(''); setCMonto(''); setCCat('Otro'); setCFecha(FISO);
  }

  function removeConsumo(i: number) {
    setConsumos(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!tarjeta || !periodo || !vcto || !totalNum) {
      setError('Completá tarjeta, período, vencimiento y total del resumen');
      return;
    }
    setError(''); setLoading(true);

    try {
      // 1. Crear el resumen (genera la deuda)
      const resumen = await sbPost<{ id: string }>('resumenes_tarjeta', {
        user_id          : user.id,
        tarjeta,
        periodo,
        fecha_vencimiento: vcto,
        monto_total      : totalNum,
        monto_pagado     : 0,
        estado           : 'pendiente',
        notas            : notas || null,
      });

      // 2. Guardar consumos del detalle como movimientos informativos
      for (const c of consumos) {
        await sbPost('movimientos', {
          fecha            : c.fecha,
          tipo             : 'gasto',
          descripcion      : c.descripcion,
          categoria        : c.categoria,
          medio_pago       : tarjeta,
          division         : 'personal',
          tipo_division    : 'personal',
          monto_total      : parseFloat(c.monto),
          mi_parte         : parseFloat(c.monto),
          parte_usuario    : parseFloat(c.monto),
          parte_contraparte: 0,
          es_deuda         : false,
          es_ahorro        : false,
          en_cuotas        : false,
          notas            : `Detalle resumen ${tarjeta} ${periodo}`,
          user_id          : user.id,
          es_compartido    : false,
          estado           : 'confirmado',
          resumen_id       : resumen.id,
        });
      }

      onToast(`Resumen ${tarjeta} ${periodo} registrado ✓`);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      {/* Datos del resumen */}
      <Card className={styles.section}>
        <div className={styles.sectionTitle}>Datos del resumen</div>
        <Select
          label      ="Tarjeta *"
          options    ={medioOptions}
          value      ={tarjeta}
          onChange   ={e => setTarjeta(e.target.value)}
          placeholder="— Elegí —"
          fullWidth
        />
        {medioOptions.length === 0 && (
          <div className={styles.hint}>Primero agregá una tarjeta de crédito en Config.</div>
        )}
        <Input label="Período *" placeholder="Marzo 2026" value={periodo} onChange={e => setPeriodo(e.target.value)} fullWidth />
        <Input label="Fecha de vencimiento *" type="date" value={vcto} onChange={e => setVcto(e.target.value)} fullWidth />
        <Input label="Total del resumen ($) *" type="number" placeholder="0"
          value={total} onChange={e => setTotal(e.target.value)} fullWidth />
        <div className={styles.alert}>
          💳 Este total se registrará como deuda e impactará en <strong>Falta pagar</strong>.
          Los consumos del detalle son solo informativos.
        </div>
        <Input label="Notas" placeholder="Opcional…" value={notas} onChange={e => setNotas(e.target.value)} fullWidth />
      </Card>

      {/* Consumos del detalle */}
      <Card className={styles.section}>
        <div className={styles.sectionTitle}>
          Detalle de consumos <Badge variant="default">{consumos.length}</Badge>
        </div>
        <div className={styles.hint}>
          Opcional — solo informativo. La sumatoria no tiene que coincidir con el total.
        </div>

        {/* Form inline para agregar consumo */}
        <div className={styles.consumoForm}>
          <Input label="Fecha" type="date" value={cFecha} onChange={e => setCFecha(e.target.value)} fullWidth />
          <Input label="Descripción" placeholder="Supermercado, Netflix…" value={cDesc} onChange={e => setCDesc(e.target.value)} fullWidth />
          <Select label="Categoría" options={CAT_OPTIONS} value={cCat} onChange={e => setCCat(e.target.value)} fullWidth />
          <Input label="Monto ($)" type="number" placeholder="0" value={cMonto} onChange={e => setCMonto(e.target.value)} fullWidth />
          <Button variant="secondary" fullWidth onClick={addConsumo} disabled={!cDesc || !cMonto}>
            + Agregar consumo
          </Button>
        </div>

        {/* Lista de consumos */}
        {consumos.length > 0 && (
          <div className={styles.consumoList}>
            {consumos.map((c, i) => (
              <div key={i} className={styles.consumoItem}>
                <div className={styles.consumoInfo}>
                  <div className={styles.consumoDesc}>{c.descripcion}</div>
                  <div className={styles.consumoMeta}>{c.fecha} · {c.categoria}</div>
                </div>
                <div className={styles.consumoRight}>
                  <span className={styles.consumoMonto}>{fmt(parseFloat(c.monto))}</span>
                  <button className={styles.removeBtn} onClick={() => removeConsumo(i)}>✕</button>
                </div>
              </div>
            ))}
            <div className={styles.consumoTotal}>
              <span>Subtotal detalle</span>
              <span>{fmt(totalConsumos)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Resumen final */}
      {totalNum > 0 && (
        <div className={styles.resumenFinal}>
          <div className={styles.resumenRow}>
            <span>Total a pagar ({tarjeta || 'tarjeta'})</span>
            <strong className={styles.resumenTotal}>{fmt(totalNum)}</strong>
          </div>
          <div className={styles.resumenRow} style={{ color: 'var(--tx3)', fontSize: 12 }}>
            <span>Detalle cargado</span>
            <span>{fmt(totalConsumos)} ({totalNum ? ((totalConsumos / totalNum) * 100).toFixed(0) : 0}%)</span>
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <div style={{ margin: '0 16px 16px' }}>
        <Button variant="primary" fullWidth loading={loading} onClick={handleSubmit}>
          Guardar resumen y crear deuda
        </Button>
      </div>
    </div>
  );
}
