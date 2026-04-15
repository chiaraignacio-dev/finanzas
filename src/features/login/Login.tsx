import { useState } from 'react';
import { Button, Input, Card } from '../../components/ui';
import { sbGet, sbPatch } from '../../lib/supabase';
import { hash } from '../../lib/utils';
import type { Usuario } from '../../lib/types';
import type { LoginProps } from './Login.types';
import styles from './Login.module.css';

export function Login({ onSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit() {
    if (!username || !password) {
      setError('Completá usuario y contraseña');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const users = await sbGet<Usuario>('usuarios', { username: `eq.${username.toLowerCase().trim()}` });

      if (!users.length) {
        setError('Usuario no encontrado');
        return;
      }

      const usr = users[0];
      const h   = hash(password);

      // Primera vez: guardar contraseña
      if (!usr.password_hash) {
        await sbPatch<Usuario>('usuarios', usr.id, { password_hash: h });
        usr.password_hash = h;
      }

      if (usr.password_hash !== h) {
        setError('Contraseña incorrecta');
        return;
      }

      localStorage.setItem('fin_s', JSON.stringify({ id: usr.id, username: usr.username }));
      onSuccess(usr);

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.logo}>🏠</div>
      <h1 className={styles.title}>MyFi</h1>
      <p className={styles.sub}>Ignacio &amp; Abril · Mendoza</p>

      <Card className={styles.card}>
        <Input
          label       ="Usuario"
          placeholder ="ignacio / abril"
          value       ={username}
          onChange    ={e => setUsername(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          fullWidth
        />
        <Input
          label       ="Contraseña"
          type        ="password"
          placeholder ="••••••"
          value       ={password}
          onChange    ={e => setPassword(e.target.value)}
          onKeyDown   ={e => e.key === 'Enter' && handleSubmit()}
          fullWidth
          style       ={{ marginTop: 14 }}
        />

        {error && <p className={styles.error}>{error}</p>}

        <Button
          variant  ="primary"
          fullWidth
          loading  ={loading}
          onClick  ={handleSubmit}
          style    ={{ marginTop: 16 }}
        >
          Ingresar
        </Button>

        <p className={styles.hint}>
          Primera vez: la contraseña que escribas<br />se guarda automáticamente.
        </p>
      </Card>
    </div>
  );
}
