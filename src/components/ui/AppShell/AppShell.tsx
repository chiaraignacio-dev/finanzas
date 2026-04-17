import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import { BottomNav }       from '../BottomNav';
import { DesktopSidebar }  from '../DesktopSidebar';
import { Toast }           from '../Toast';
import type { TabId }      from '../BottomNav';
import type { ToastType }  from '../Toast';
import { Registrar }   from '../../../features/gastos/registrar/Registrar';
import { Historial }   from '../../../features/gastos/historial/Historial';
import { Dashboard }   from '../../../features/dashboard/Dashboard';
import { PagarDeudas } from '../../../features/deudas/PagarDeudas';
import { Config }      from '../../../features/config/Config';
import { sbGet }       from '../../../lib/supabase';
import { getProp }     from '../../../lib/utils';
import type { Usuario, MedioPago, Meta } from '../../../lib/types';
import styles from './AppShell.module.css';

interface AppShellProps {
  user    : Usuario;
  onLogout: () => void;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function AppShell({ user, onLogout }: AppShellProps) {
  const [activeTab,    setActiveTab]    = useState<TabId>('registrar');
  const [badge,        setBadge]        = useState(0);
  const [toastMsg,     setToastMsg]     = useState('');
  const [toastType,    setToastType]    = useState<ToastType>('ok');
  const [toastVisible, setToastVisible] = useState(false);
  const [allUsers,     setAllUsers]     = useState<Record<string, Usuario>>({});
  const [medios,       setMedios]       = useState<MedioPago[]>([]);
  const [metas,        setMetas]        = useState<Meta[]>([]);
  const [prop,         setProp]         = useState(0.5435);
  const isDesktop = useIsDesktop();
  let toastTimer: ReturnType<typeof setTimeout>;

  function toast(msg: string, type: ToastType = 'ok') {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setToastVisible(false), 3500);
  }

  const loadSharedData = useCallback(async () => {
    try {
      const [users, ms, mts] = await Promise.all([
        sbGet<Usuario>('usuarios', {}),
        sbGet<MedioPago>('medios_pago', { user_id: `eq.${user.id}`, activo: 'eq.true' }),
        sbGet<Meta>('metas', { user_id: `eq.${user.id}`, activa: 'eq.true' }),
      ]);
      const byUsername: Record<string, Usuario> = {};
      users.forEach(u => (byUsername[u.username] = u));
      setAllUsers(byUsername);
      setMedios(ms);
      setMetas(mts);

      const ignacio = byUsername['ignacio'];
      const abril   = byUsername['abril'];
      if (ignacio && abril) {
        setProp(getProp(
          ignacio.ingreso_fijo || 0, ignacio.ingreso_q1 || 0, ignacio.ingreso_q2 || 0,
          abril.ingreso_fijo   || 0, abril.ingreso_q1   || 0, abril.ingreso_q2   || 0,
        ));
      }
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => { loadSharedData(); }, [loadSharedData]);

  const screens: Record<TabId, ReactElement> = {
    registrar: <Registrar user={user} medios={medios} metas={metas} prop={prop} allUsers={allUsers} onToast={toast} />,
    historial : <Historial user={user} allUsers={allUsers} onToast={toast} onBadge={() => {}} />,
    dashboard : <Dashboard user={user} allUsers={allUsers} />,
    deudas    : <PagarDeudas user={user} allUsers={allUsers} onToast={toast} onBadge={setBadge} />,
    config    : <Config user={user} onToast={toast} onLogout={onLogout} onReload={loadSharedData} />,
  };

  return (
    <div className={isDesktop ? styles.rootDesktop : styles.rootMobile}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} />

      {/* Sidebar — solo se monta en desktop */}
      {isDesktop && (
        <DesktopSidebar
          active      ={activeTab}
          onChange    ={setActiveTab}
          badge       ={badge}
          userName    ={user.nombre}
          userInitial ={user.nombre[0].toUpperCase()}
          onLogout    ={onLogout}
        />
      )}

      {/* Área de contenido */}
      <div className={styles.content}>
        <main className={styles.screen}>
          {screens[activeTab]}
        </main>

        {/* BottomNav — solo se monta en mobile */}
        {!isDesktop && (
          <BottomNav active={activeTab} onChange={setActiveTab} badge={badge} />
        )}
      </div>
    </div>
  );
}
