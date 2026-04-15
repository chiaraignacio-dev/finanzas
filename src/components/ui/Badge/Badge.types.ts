import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant = 'default' | 'warning' | 'info' | 'success' | 'danger' | 'purple';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant? : BadgeVariant;
  children : ReactNode;
}
