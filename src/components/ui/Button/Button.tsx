import styles from './Button.module.css';
import type { ButtonProps } from './Button.types';

export function Button({
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const cls = [
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth  ? styles.fullWidth : '',
    loading    ? styles.loading   : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading
        ? <span className={styles.spinner} />
        : children}
    </button>
  );
}
