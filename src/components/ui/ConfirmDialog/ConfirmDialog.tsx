import { Modal } from '../Modal';
import { Button } from '../Button';
import styles from './ConfirmDialog.module.css';

interface Props {
  abierto   : boolean;
  mensaje   : string;
  labelConfirmar?: string;
  labelCancelar? : string;
  peligroso ?: boolean;
  onConfirmar: () => void;
  onCancelar : () => void;
}

export function ConfirmDialog({
  abierto,
  mensaje,
  labelConfirmar = 'Confirmar',
  labelCancelar  = 'Cancelar',
  peligroso      = false,
  onConfirmar,
  onCancelar,
}: Props) {
  return (
    <Modal open={abierto} onClose={onCancelar}>
      <p className={styles.mensaje}>{mensaje}</p>
      <div className={styles.acciones}>
        <Button
          variant ={peligroso ? 'danger' : 'primary'}
          fullWidth
          onClick ={onConfirmar}
        >
          {labelConfirmar}
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancelar}>
          {labelCancelar}
        </Button>
      </div>
    </Modal>
  );
}
