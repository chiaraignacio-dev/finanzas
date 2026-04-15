import styles from './Toast.module.css';
import type { ToastProps } from './Toast.types';

export function Toast({ message, type, visible }: ToastProps) {
  const cls = [
    styles.toast,
    styles[type],
    visible ? styles.visible : '',
  ].filter(Boolean).join(' ');

  return <div className={cls}>{message}</div>;
}
