import type { ReactElement }    from 'react';
import { useState, useEffect }  from 'react';
import { BottomNav }            from '../BottomNav';
import { DesktopSidebar }       from '../DesktopSidebar';
import { Toast }                from '../Toast';
import { SesionProvider, usarSesion, usarToast } from '../../../context/SesionContext';
import { usarEscritorioOMobile } from '../../../hooks/usarEscritorioOMobile';
import { Registrar }             from '../../../features/gastos/registrar/Registrar';
import { Historial }             from '../../../features/gastos/historial/Historial';
import { Dashboard }             from '../../../features/dashboard/Dashboard';
import { PagarDeudas }           from '../../../features/deudas/PagarDeudas';
import { Balance }               from '../../../features/balance/Balance';
import { Presupuestos }          from '../../../features/presupuestos/Presupuestos';
import { Config }                from '../../../features/config/Config';
import { Suscripciones }         from '../../../features/suscripciones/Suscripciones';
import {
  programarRecordatoriosServicios,
  registrarServiceWorker,
} from '../../../lib/notificaciones';
import type { TabId }   from '../BottomNav';
import type { Usuario } from '../../../lib/types';
import styles           from './AppShell.module.css';

function ShellInterno({ onLogout }: { onLogout: () => void }) {
  const { usuario, cargando }      = usarSesion();
  const { mensaje, tipo, visible } = usarToast();
  const [pestañaActiva, setPestañaActiva] = useState<TabId>('registrar');
  const [badge,         setBadge]         = useState(0);
  const esEscritorio = usarEscritorioOMobile();

  useEffect(() => {
    if (!cargando) {
      registrarServiceWorker();
      programarRecordatoriosServicios(usuario.id);
    }
  }, [cargando, usuario.id]);

  const pantallas: Record<TabId, ReactElement> = {
    registrar     : <Registrar />,
    historial     : <Historial onBadge={() => {}} />,
    dashboard     : <Dashboard />,
    deudas        : <PagarDeudas onBadge={setBadge} />,
    balance       : <Balance />,
    presupuestos  : <Presupuestos />,
    suscripciones : <Suscripciones />,
    config        : <Config onLogout={onLogout} />,
  };

  return (
    <div className={esEscritorio ? styles.rootEscritorio : styles.rootMobile}>
      <Toast message={mensaje} type={tipo} visible={visible} />

      {esEscritorio && (
        <DesktopSidebar
          active     ={pestañaActiva}
          onChange   ={setPestañaActiva}
          badge      ={badge}
          userName   ={usuario.nombre}
          userInitial={usuario.nombre[0].toUpperCase()}
          onLogout   ={onLogout}
        />
      )}

      <div className={styles.contenido}>
        <main className={styles.pantalla}>
          {pestañaActiva === 'registrar'     && pantallas.registrar}
          {pestañaActiva === 'historial'     && pantallas.historial}
          {pestañaActiva === 'dashboard'     && pantallas.dashboard}
          {pestañaActiva === 'deudas'        && pantallas.deudas}
          {pestañaActiva === 'balance'       && pantallas.balance}
          {pestañaActiva === 'presupuestos'  && pantallas.presupuestos}
          {pestañaActiva === 'suscripciones' && pantallas.suscripciones}
          {pestañaActiva === 'config'        && pantallas.config}
        </main>

        {!esEscritorio && (
          <BottomNav active={pestañaActiva} onChange={setPestañaActiva} badge={badge} />
        )}
      </div>
    </div>
  );
}

interface AppShellProps {
  usuario : Usuario;
  onLogout: () => void;
}

export function AppShell({ usuario, onLogout }: AppShellProps) {
  return (
    <SesionProvider usuario={usuario} onLogout={onLogout}>
      <ShellInterno onLogout={onLogout} />
    </SesionProvider>
  );
}
