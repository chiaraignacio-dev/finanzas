import type { TabId } from '../BottomNav/BottomNav.types';
import styles from './DesktopSidebar.module.css';

interface Props {
  active  : TabId;
  onChange: (tab: TabId) => void;
  badge   : number;
  userName: string;
  userInitial: string;
  onLogout: () => void;
}

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'registrar', icon: '✚',  label: 'Registrar' },
  { id: 'historial', icon: '≡',  label: 'Historial' },
  { id: 'dashboard', icon: '⊞',  label: 'Dashboard' },
  { id: 'deudas',    icon: '⊟',  label: 'Deudas' },
  { id: 'config',    icon: '⚙',  label: 'Config' },
];

export function DesktopSidebar({ active, onChange, badge, userName, userInitial, onLogout }: Props) {
  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🏠</span>
        <span className={styles.logoText}>MyFi</span>
      </div>

      {/* Nav items */}
      <nav className={styles.nav}>
        {TABS.map(tab => (
          <button
            key      ={tab.id}
            className={`${styles.item} ${active === tab.id ? styles.active : ''}`}
            onClick  ={() => onChange(tab.id)}
          >
            <span className={styles.itemIcon}>{tab.icon}</span>
            <span className={styles.itemLabel}>{tab.label}</span>
            {tab.id === 'deudas' && badge > 0 && (
              <span className={styles.badge}>{badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* User pill + logout */}
      <div className={styles.footer}>
        <div className={styles.userPill}>
          <div className={styles.avatar}>{userInitial}</div>
          <span className={styles.userName}>{userName}</span>
        </div>
        <button className={styles.logout} onClick={onLogout}>Salir</button>
      </div>
    </aside>
  );
}
