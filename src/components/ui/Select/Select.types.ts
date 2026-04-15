import type { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?    : string;
  options   : SelectOption[];
  error?    : string;
  hint?     : string;
  fullWidth?: boolean;
  placeholder?: string;
}
