import styles from './Select.module.css';
import type { SelectProps } from './Select.types';

export function Select({
  label,
  options,
  error,
  hint,
  fullWidth = false,
  placeholder,
  className = '',
  id,
  ...rest
}: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  const wrapCls = [
    styles.wrap,
    fullWidth ? styles.fullWidth : '',
  ].filter(Boolean).join(' ');

  const selectCls = [
    styles.select,
    error ? styles.hasError : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapCls}>
      {label && (
        <label className={styles.label} htmlFor={selectId}>
          {label}
        </label>
      )}
      <div className={styles.selectWrap}>
        <select id={selectId} className={selectCls} {...rest}>
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className={styles.arrow}>▾</span>
      </div>
      {error && <span className={styles.error}>{error}</span>}
      {hint  && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
