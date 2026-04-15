import type { HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'default' | 'pending' | 'success' | 'danger';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant? : CardVariant;
  padding? : 'sm' | 'md' | 'lg' | 'none';
  children : ReactNode;
}
