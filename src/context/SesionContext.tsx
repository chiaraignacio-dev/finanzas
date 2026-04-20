import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { sbGet }              from '../lib/supabase';
import { cache }              from '../lib/cache';
import { calcularProporcion } from '../lib/utils';
import type { Usuario, MedioPago, Meta } from '../lib/types';

// ── Tipos del contexto ─────────────────────────────────
interface EstadoSesion {
  usuario        : Usuario;
  todosUsuarios  : Record<string, Usuario>;
  pareja         : Usuario | null;
  medios         : MedioPago[];
  metas          : Meta[];
  proporcion     : number;
  cargando       : boolean;
  recargar       : () => Promise<void>;
}

// ── Toast ──────────────────────────────────────────────
type TipoToast = 'ok' | 'err' | 'warn';

interface EstadoToast {
  mensaje  : string;
  tipo     : TipoToast;
  visible  : boolean;
  mostrar  : (msg: string, tipo?: TipoToast) => void;
}

// ── Contextos ──────────────────────────────────────────
const ContextoSesion = createContext<EstadoSesion | null>(null);
const ContextoToast  = createContext<EstadoToast  | null>(null);

// ── Provider ───────────────────────────────────────────
interface Props {
  usuario  : Usuario;
  onLogout : () => void;
  children : ReactNode;
}

export function SesionProvider({ usuario, onLogout: _onLogout, children }: Props) {
  const [todosUsuarios, setTodosUsuarios] = useState<Record<string, Usuario>>({});
  const [medios,        setMedios]        = useState<MedioPago[]>([]);
  const [metas,         setMetas]         = useState<Meta[]>([]);
  const [cargando,      setCargando]      = useState(true);

  // Toast
  const [mensaje,  setMensaje]  = useState('');
  const [tipo,     setTipo]     = useState<TipoToast>('ok');
  const [visible,  setVisible]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function mostrar(msg: string, t: TipoToast = 'ok') {
    setMensaje(msg);
    setTipo(t);
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 3500);
  }

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const [usuarios, ms, mts] = await Promise.all([
        sbGet<Usuario>('usuarios', {}, 30_000),
        sbGet<MedioPago>('medios_pago', { user_id: `eq.${usuario.id}`, activo: 'eq.true' }, 30_000),
        sbGet<Meta>('metas', { user_id: `eq.${usuario.id}`, activa: 'eq.true' }, 30_000),
      ]);

      const porUsername: Record<string, Usuario> = {};
      usuarios.forEach(u => (porUsername[u.username] = u));

      setTodosUsuarios(porUsername);
      setMedios(ms);
      setMetas(mts);
    } catch (e) {
      console.error('Error recargando sesión:', e);
    } finally {
      setCargando(false);
    }
  }, [usuario.id]);

  useEffect(() => { recargar(); }, [recargar]);

  // Cleanup al desmontar
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const pareja = Object.values(todosUsuarios).find(u => u.id !== usuario.id) ?? null;

  const proporcion = pareja
    ? calcularProporcion(
        todosUsuarios[usuario.username] ?? usuario,
        pareja,
      )
    : 0.5435;

  const sesion: EstadoSesion = {
    usuario,
    todosUsuarios,
    pareja,
    medios,
    metas,
    proporcion,
    cargando,
    recargar,
  };

  const toast: EstadoToast = { mensaje, tipo, visible, mostrar };

  return (
    <ContextoSesion.Provider value={sesion}>
      <ContextoToast.Provider value={toast}>
        {children}
      </ContextoToast.Provider>
    </ContextoSesion.Provider>
  );
}

// ── Hooks de consumo ───────────────────────────────────
export function usarSesion(): EstadoSesion {
  const ctx = useContext(ContextoSesion);
  if (!ctx) throw new Error('usarSesion debe usarse dentro de SesionProvider');
  return ctx;
}

export function usarToast(): EstadoToast {
  const ctx = useContext(ContextoToast);
  if (!ctx) throw new Error('usarToast debe usarse dentro de SesionProvider');
  return ctx;
}

// ── Hook para logout limpio ────────────────────────────
export function usarLogout(onLogout: () => void) {
  return () => {
    cache.clear();
    localStorage.removeItem('fin_s');
    onLogout();
  };
}
