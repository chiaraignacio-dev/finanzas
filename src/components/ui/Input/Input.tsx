import styles from './Input.module.css';
import type { InputProps } from './Input.types';

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  const wrapCls = [
    styles.wrap,
    fullWidth ? styles.fullWidth : '',
  ].filter(Boolean).join(' ');

  const inputCls = [
    styles.input,
    error      ? styles.hasError  : '',
    leftIcon   ? styles.hasLeft   : '',
    rightIcon  ? styles.hasRight  : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapCls}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className={styles.inputWrap}>
        {leftIcon  && <span className={styles.iconLeft}>{leftIcon}</span>}
        <input id={inputId} className={inputCls} {...rest} />
        {rightIcon && <span className={styles.iconRight}>{rightIcon}</span>}
      </div>
      {error && <span className={styles.error}>{error}</span>}
      {hint  && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
