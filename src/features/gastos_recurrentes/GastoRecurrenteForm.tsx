import { useState }                    from 'react';
import { crearGastoRecurrente,
         actualizarGastoRecurrente }   from '../../lib/gastos_recurrentes.service';
import { usarSesion }                  from '../../context/SesionContext';
import { Input, Select, Button }       from '../../components/ui';
import { TIPOS_GASTO_RECURRENTE }      from '../../lib/types';
import type { GastoRecurrente,
              TipoGastoRecurrente,
              DivisionGastoRecurrente } from '../../lib/types';
import styles                          from './GastosRecurrentes.module.css';

// Emoji sugerido según tipo
const EMOJI_POR_TIPO: Record<TipoGastoRecurrente, string> = {
  suscripcion_digital: '📱',
  alquiler           : '🏠',
  gimnasio           : '🏋️',
  expensas           : '🏢',
  seguro             : '🛡️',
  cuota              : '💳',
  otro               : '📦',
};

const EMOJIS_EXTRA = ['🎬', '🎵', '📺', '🎙️', '🧘', '☁️', '🔧', '🍔', '✈️', '🚗', '💡', '📡'];

const DIV_OPTIONS = [
  { value: 'personal', label: 'Solo mío'    },
  { value: 'mitad',    label: '50/50'       },
  { value: 'prop',     label: 'Proporcional'},
];

const TIPO_OPTIONS = TIPOS_GASTO_RECURRENTE.map((t: { value: TipoGastoRecurrente; label: string; emoji: string }) => ({
  value: t.value,
  label: `${t.emoji} ${t.label}`,
}));

interface Props {
  inicial?   : Partial<GastoRecurrente>;
  onGuardado : () => void;
  onCerrar   : () => void;
}

export function GastoRecurrenteForm({ inicial, onGuardado, onCerrar }: Props) {
  const { usuario } = usarSesion();
  const esEdicion   = !!inicial?.id;

  const [tipo,     setTipo]     = useState<TipoGastoRecurrente>(inicial?.tipo ?? 'suscripcion_digital');
  const [nombre,   setNombre]   = useState(inicial?.nombre         ?? '');
  const [emoji,    setEmoji]    = useState(inicial?.emoji          ?? '📱');
  const [desc,     setDesc]     = useState(inicial?.descripcion    ?? '');
  const [division, setDivision] = useState<DivisionGastoRecurrente>(inicial?.division ?? 'personal');
  const [monto,    setMonto]    = useState(inicial?.monto_estimado?.toString() ?? '');
  const [cargando, setCarg]     = useState(false);
  const [error,    setError]    = useState('');

  // Al cambiar tipo, sugerir emoji si el usuario no lo tocó manualmente
  function handleTipo(t: TipoGastoRecurrente) {
    setTipo(t);
    setEmoji(EMOJI_POR_TIPO[t]);
  }

  const emojisDisponibles = [EMOJI_POR_TIPO[tipo], ...EMOJIS_EXTRA.filter(e => e !== EMOJI_POR_TIPO[tipo])];

  async function guardar() {
    if (!nombre.trim() || !monto) { setError('Nombre y monto son obligatorios'); return; }
    setError('');
    setCarg(true);
    try {
      const payload = {
        user_id        : usuario.id,
        nombre         : nombre.trim(),
        emoji,
        tipo,
        descripcion    : desc.trim() || null,
        division,
        monto_estimado : parseFloat(monto),
        activa         : true,
      };

      if (esEdicion && inicial?.id) {
        await actualizarGastoRecurrente(inicial.id, payload);
      } else {
        await crearGastoRecurrente(payload as Omit<GastoRecurrente, 'id' | 'created_at' | 'updated_at'>);
      }
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setCarg(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitulo}>
            {esEdicion ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente'}
          </h2>
          <button className={styles.btnCerrar} onClick={onCerrar}>✕</button>
        </div>

        {/* Tipo — lo primero para sugerir emoji */}
        <Select
          label   ="Tipo *"
          options ={TIPO_OPTIONS}
          value   ={tipo}
          onChange={e => handleTipo(e.target.value as TipoGastoRecurrente)}
          fullWidth
        />

        {/* Emoji picker */}
        <div className={styles.emojiGrid}>
          {emojisDisponibles.map(e => (
            <button
              key      ={e}
              className={`${styles.emojiBtn} ${emoji === e ? styles.emojiActivo : ''}`}
              onClick  ={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>

        <Input
          label      ="Nombre *"
          placeholder="Alquiler, Netflix, Seguro del auto..."
          value      ={nombre}
          onChange   ={e => setNombre(e.target.value)}
          fullWidth
        />

        <Input
          label      ="Monto estimado ($) *"
          type       ="number"
          placeholder="0"
          value      ={monto}
          onChange   ={e => setMonto(e.target.value)}
          fullWidth
        />

        <Select
          label   ="División"
          options ={DIV_OPTIONS}
          value   ={division}
          onChange={e => setDivision(e.target.value as DivisionGastoRecurrente)}
          fullWidth
        />

        <Input
          label      ="Descripción (opcional)"
          placeholder="Plan familiar, 2 ambientes, etc."
          value      ={desc}
          onChange   ={e => setDesc(e.target.value)}
          fullWidth
        />

        {error && <div className={styles.error}>{error}</div>}

        <Button variant="primary" fullWidth loading={cargando} onClick={guardar}>
          {esEdicion ? 'Guardar cambios' : 'Crear gasto recurrente'}
        </Button>
      </div>
    </div>
  );
}
