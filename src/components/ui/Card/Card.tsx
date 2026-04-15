import styles from './Card.module.css';
import type { CardProps } from './Card.types';

export function Card({
  variant  = 'default',
  padding  = 'md',
  children,
  className = '',
  ...rest
}: CardProps) {
  const cls = [
    styles.card,
    styles[variant],
    styles[`pad-${padding}`],
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
