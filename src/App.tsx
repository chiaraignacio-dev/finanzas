import { useState, useEffect } from 'react';
import { Login }    from './features/login';
import { AppShell } from './components/ui/AppShell';
import { sbGet }    from './lib/supabase';
import { cache }    from './lib/cache';
import type { Usuario } from './lib/types';
import './index.css';

export default function App() {
  const [usuario,    setUsuario]    = useState<Usuario | null>(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    async function restaurarSesion() {
      const guardado = localStorage.getItem('fin_s');
      if (!guardado) { setVerificando(false); return; }
      try {
        const { id } = JSON.parse(guardado);
        const usuarios = await sbGet<Usuario>('usuarios', { id: `eq.${id}` });
        if (usuarios.length) setUsuario(usuarios[0]);
      } catch {
        localStorage.removeItem('fin_s');
      } finally {
        setVerificando(false);
      }
    }
    restaurarSesion();
  }, []);

  function manejarLogout() {
    cache.clear();
    localStorage.removeItem('fin_s');
    setUsuario(null);
  }

  if (verificando) return null;
  if (!usuario)    return <Login onSuccess={setUsuario} />;

  return <AppShell usuario={usuario} onLogout={manejarLogout} />;
}
