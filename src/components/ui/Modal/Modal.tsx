import styles from './Modal.module.css';
import type { ModalProps } from './Modal.types';

export function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.sheet}>
        <div className={styles.handle} />
        {children}
      </div>
    </div>
  );
}
