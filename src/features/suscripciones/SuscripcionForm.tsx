import { useState } from 'react';
import { crearSuscripcion, actualizarSuscripcion } from '../../lib/suscripciones.service';
import { usarSesion } from '../../context/SesionContext';
import { Input, Select, Button } from '../../components/ui';
import type { Suscripcion, DivisionSuscripcion } from '../../lib/types';
import styles from './Suscripciones.module.css';

const EMOJIS = ['📦', '🎬', '🎵', '🏋️', '📰', '☁️', '🎮', '📱', '🔧', '🍿', '📺', '🎙️', '🧘', '🍔', '✈️'];

const DIV_OPTIONS = [
  { value: 'personal', label: 'Solo mío'      },
  { value: 'mitad',    label: '50/50'          },
  { value: 'prop',     label: 'Proporcional'   },
];

interface Props {
  inicial?   : Partial<Suscripcion>;
  onGuardado : () => void;
  onCerrar   : () => void;
}

export function SuscripcionForm({ inicial, onGuardado, onCerrar }: Props) {
  const { usuario } = usarSesion();
  const esEdicion   = !!inicial?.id;

  const [nombre,   setNombre]   = useState(inicial?.nombre         ?? '');
  const [emoji,    setEmoji]    = useState(inicial?.emoji          ?? '📦');
  const [desc,     setDesc]     = useState(inicial?.descripcion    ?? '');
  const [division, setDivision] = useState<DivisionSuscripcion>(inicial?.division ?? 'personal');
  const [monto,    setMonto]    = useState(inicial?.monto_estimado?.toString() ?? '');
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState('');

  async function guardar() {
    if (!nombre.trim() || !monto) { setError('Nombre y monto son obligatorios'); return; }
    setError('');
    setCargando(true);
    try {
      const payload = {
        user_id        : usuario.id,
        nombre         : nombre.trim(),
        emoji,
        descripcion    : desc.trim() || null,
        division,
        monto_estimado : parseFloat(monto),
        activa         : true,
      };

      if (esEdicion && inicial?.id) {
        await actualizarSuscripcion(inicial.id, payload);
      } else {
        await crearSuscripcion(payload as Omit<Suscripcion, 'id' | 'created_at' | 'updated_at'>);
      }
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitulo}>
            {esEdicion ? 'Editar suscripción' : 'Nueva suscripción'}
          </h2>
          <button className={styles.btnCerrar} onClick={onCerrar}>✕</button>
        </div>

        {/* Emoji picker */}
        <div className={styles.emojiGrid}>
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={`${styles.emojiBtn} ${emoji === e ? styles.emojiActivo : ''}`}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Campos */}
        <Input
          label="Nombre *"
          placeholder="Netflix, Spotify, Gimnasio..."
          value={nombre}
          onChange={(ev) => setNombre(ev.target.value)}
          fullWidth
        />

        <Input
          label="Monto estimado ($) *"
          type="number"
          placeholder="0"
          value={monto}
          onChange={(ev) => setMonto(ev.target.value)}
          fullWidth
        />

        <Select
          label="División"
          options={DIV_OPTIONS}
          value={division}
          onChange={(ev) => setDivision(ev.target.value as DivisionSuscripcion)}
          fullWidth
        />

        <Input
          label="Descripción (opcional)"
          placeholder="Plan familiar, etc."
          value={desc}
          onChange={(ev) => setDesc(ev.target.value)}
          fullWidth
        />

        {error && <div className={styles.error}>{error}</div>}

        <Button
          variant="primary"
          fullWidth
          loading={cargando}
          onClick={guardar}
        >
          {esEdicion ? 'Guardar cambios' : 'Crear suscripción'}
        </Button>
      </div>
    </div>
  );
}
