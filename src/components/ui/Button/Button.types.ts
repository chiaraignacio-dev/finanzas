import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?  : ButtonVariant;
  size?     : ButtonSize;
  loading?  : boolean;
  fullWidth?: boolean;
  children  : ReactNode;
}
