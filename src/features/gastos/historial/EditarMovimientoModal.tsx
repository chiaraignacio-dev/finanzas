import { useState, useEffect }               from 'react';
import { Input, Select, Button }             from '../../../components/ui';
import { RadioGroup }                        from '../../../components/ui/RadioGroup';
import { Modal }                             from '../../../components/ui/Modal';
import { usarSesion }                        from '../../../context/SesionContext';
import { sbPatch }                           from '../../../lib/supabase';
import { crearDeudaInterpersonal }           from '../../../lib/deudas.service';
import { CATEGORIAS }                        from '../../../lib/types';
import { fmt, partePorDiv, num }             from '../../../lib/utils';
import type { Movimiento }                   from '../../../lib/types';
import styles                                from './EditarMovimientoModal.module.css';

interface Props {
  movimiento : Movimiento | null;
  onCerrar   : () => void;
  onGuardado : () => void;
}

const OPCIONES_DIVISION = [
  { value: 'personal', label: 'Solo mío' },
  { value: 'prop',     label: 'Proporcional', sublabel: 'Según ingresos del hogar' },
  { value: 'mitad',    label: '50/50' },
  { value: 'novia',    label: 'Lo pagué yo — es de mi pareja' },
];

const opsCat = CATEGORIAS.map(c => ({ value: c, label: c }));

export function EditarMovimientoModal({ movimiento: mov, onCerrar, onGuardado }: Props) {
  const { usuario, pareja, proporcion } = usarSesion();

  const [fecha,    setFecha]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [cat,      setCat]      = useState('');
  const [monto,    setMonto]    = useState('');
  const [division, setDivision] = useState('personal');
  const [notas,    setNotas]    = useState('');
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState('');

  // Poblar form con datos del movimiento al abrir
  useEffect(() => {
    if (!mov) return;
    setFecha(mov.fecha);
    setDesc(mov.descripcion);
    setCat(mov.categoria || '');
    setMonto(String(num(mov.monto_total)));
    setDivision(mov.division || 'personal');
    setNotas(mov.notas || '');
    setError('');
  }, [mov]);

  if (!mov) return null;

  const montoNum   = num(monto);
  const esDePareja = division === 'novia';
  const miParte    = esDePareja ? 0 : Math.round(partePorDiv(montoNum, division, proporcion));
  const parteOtro  = Math.round(montoNum - miParte);
  const esComp     = ['prop', 'mitad'].includes(division);

  async function guardar() {
    if (!mov) return;
    if (!desc || !montoNum) { setError('Completá descripción y monto'); return; }
    setError(''); setCargando(true);
    try {
      const divisionCambio  = division !== mov.division;
      const eraCompartido   = mov.es_compartido;
      const ahoraCompartido = esComp || esDePareja;

      await sbPatch('movimientos', mov.id, {
        fecha,
        descripcion      : desc,
        categoria        : cat,
        division,
        monto_total      : montoNum,
        mi_parte         : miParte,
        parte_contraparte: parteOtro,
        parte_usuario    : miParte,
        notas            : notas || null,
        es_compartido    : esComp,
        estado           : (eraCompartido || ahoraCompartido) && divisionCambio
          ? 'pendiente'
          : mov.estado,
      });

      // Si cambió la división y ahora es compartido, crear nueva deuda interpersonal
      if (ahoraCompartido && parteOtro > 0 && pareja && divisionCambio) {
        await crearDeudaInterpersonal({
          acreedorId  : usuario.id,
          deudorId    : pareja.id,
          descripcion : `${desc} (editado) — ${division === 'mitad' ? '50/50' : 'proporcional'}`,
          montoTotal  : parteOtro,
          origen      : 'gasto',
          movimientoId: mov.id,
          notas       : `Editado el ${fecha}`,
        });
      }

      onGuardado();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setCargando(false); }
  }

  return (
    <Modal open={!!mov} onClose={onCerrar}>
      <div className={styles.titulo}>Editar movimiento</div>

      <div className={styles.form}>
        <Input
          label="Fecha"
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          fullWidth
        />
        <Input
          label="Descripción *"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          fullWidth
        />
        <Select
          label="Categoría"
          options={opsCat}
          value={cat}
          onChange={e => setCat(e.target.value)}
          placeholder="— Elegí —"
          fullWidth
        />
        <Input
          label="Monto total ($) *"
          type="number"
          value={monto}
          onChange={e => setMonto(e.target.value)}
          fullWidth
        />
        <RadioGroup
          name="division-edit"
          label="División"
          options={OPCIONES_DIVISION}
          value={division}
          onChange={setDivision}
        />

        {montoNum > 0 && (
          <div className={styles.resumen}>
            <div className={styles.resumenFila}>
              <span>Mi parte</span>
              <strong>{fmt(miParte)}</strong>
            </div>
            {esComp && parteOtro > 0 && pareja && (
              <div className={styles.resumenFila}>
                <span>Parte de {pareja.nombre}</span>
                <strong>{fmt(parteOtro)}</strong>
              </div>
            )}
          </div>
        )}

        {esComp && pareja && (
          <div className={styles.aviso}>
            ⚡ Si cambiás la división, {pareja.nombre} deberá confirmar la deuda nuevamente.
          </div>
        )}

        <Input
          label="Notas"
          placeholder="Opcional…"
          value={notas}
          onChange={e => setNotas(e.target.value)}
          fullWidth
        />

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.botones}>
          <Button variant="primary" fullWidth loading={cargando} onClick={guardar}>
            Guardar cambios
          </Button>
          <Button variant="secondary" fullWidth onClick={onCerrar}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
