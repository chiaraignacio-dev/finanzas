import styles from './Badge.module.css';
import type { BadgeProps } from './Badge.types';

export function Badge({
  variant  = 'default',
  children,
  className = '',
  ...rest
}: BadgeProps) {
  const cls = [styles.badge, styles[variant], className].filter(Boolean).join(' ');
  return <span className={cls} {...rest}>{children}</span>;
}
