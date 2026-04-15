export type ToastType = 'ok' | 'err' | 'warn';

export interface ToastMessage {
  id     : number;
  message: string;
  type   : ToastType;
}

export interface ToastProps {
  message: string;
  type   : ToastType;
  visible: boolean;
}
