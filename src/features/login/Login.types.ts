import type { Usuario } from '../../lib/types';

export interface LoginFormValues {
  username: string;
  password: string;
}

export interface LoginProps {
  onSuccess: (user: Usuario) => void;
}
