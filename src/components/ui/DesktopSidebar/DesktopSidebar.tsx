
import type { TabId }           from '../BottomNav/BottomNav.types';
import styles                   from './DesktopSidebar.module.css';

interface Props {
  active      : TabId;
  onChange    : (tab: TabId) => void;
  badge       : number;
  userName    : string;
  userInitial : string;
  onLogout    : () => void;
}

const TABS: { id: TabId; icono: string; etiqueta: string }[] = [
  { id: 'registrar',    icono: '✚',  etiqueta: 'Registrar' },
  { id: 'historial',    icono: '≡',  etiqueta: 'Historial' },
  { id: 'dashboard',    icono: '⊞',  etiqueta: 'Dashboard' },
  { id: 'deudas',       icono: '⊟',  etiqueta: 'Deudas' },
  { id: 'balance',      icono: '⚖',  etiqueta: 'Balance' },
  { id: 'presupuestos', icono: '📊', etiqueta: 'Límites' },
  { id: 'config',       icono: '⚙',  etiqueta: 'Config' },
];

export function DesktopSidebar({ active, onChange, badge, userName, userInitial, onLogout }: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcono}>🏠</span>
        <span className={styles.logoTexto}>MyFi</span>
      </div>

      <nav className={styles.nav}>
        {TABS.map(tab => (
          <button
            key      ={tab.id}
            className={`${styles.item} ${active === tab.id ? styles.active : ''}`}
            onClick  ={() => onChange(tab.id)}
          >
            <span className={styles.itemIcono}>{tab.icono}</span>
            <span className={styles.itemEtiqueta}>{tab.etiqueta}</span>
            {tab.id === 'deudas' && badge > 0 && (
              <span className={styles.badge}>{badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div className={styles.pie}>
        <div className={styles.usuarioPill}>
          <div className={styles.avatar}>{userInitial}</div>
          <span className={styles.nombreUsuario}>{userName}</span>
        </div>
        <button className={styles.salir} onClick={onLogout}>Salir</button>
      </div>
    </aside>
  );
}
