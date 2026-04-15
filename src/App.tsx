import { useState, useEffect } from 'react';
import { Login }    from './features/login';
import { AppShell } from './components/ui/AppShell';
import { sbGet }    from './lib/supabase';
import type { Usuario } from './lib/types';
import './index.css';

export default function App() {
  const [user,     setUser]     = useState<Usuario | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const raw = localStorage.getItem('fin_s');
      if (!raw) { setChecking(false); return; }
      try {
        const { id } = JSON.parse(raw);
        const users  = await sbGet<Usuario>('usuarios', { id: `eq.${id}` });
        if (users.length) setUser(users[0]);
      } catch { /* sesión inválida */ }
      finally  { setChecking(false); }
    }
    restoreSession();
  }, []);

  function handleLogout() {
    localStorage.removeItem('fin_s');
    setUser(null);
  }

  if (checking) return null;
  if (!user)    return <Login onSuccess={setUser} />;

  return <AppShell user={user} onLogout={handleLogout} />;
}
