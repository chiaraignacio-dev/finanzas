import type { ReactElement } from 'react';
import styles from './BottomNav.module.css';
import type { BottomNavProps, TabId } from './BottomNav.types';

const TABS: { id: TabId; label: string; svg: ReactElement }[] = [
  {
    id   : 'registrar',
    label: 'Registrar',
    svg  : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8"  y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    id   : 'historial',
    label: 'Historial',
    svg  : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M3 12h18M3 6h18M3 18h18" />
      </svg>
    ),
  },
  {
    id   : 'dashboard',
    label: 'Dashboard',
    svg  : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3"  y="3"  width="7" height="7" />
        <rect x="14" y="3"  width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3"  y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id   : 'config',
    label: 'Config',
    svg  : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export function BottomNav({ active, onChange, badge = 0 }: BottomNavProps) {
  return (
    <nav className={styles.nav}>
      {TABS.map(tab => (
        <button
          key       ={tab.id}
          className ={`${styles.btn} ${active === tab.id ? styles.active : ''}`}
          onClick   ={() => onChange(tab.id)}
        >
          <span className={styles.icon}>
            {tab.svg}
            {tab.id === 'historial' && badge > 0 && (
              <span className={styles.badge}>{badge}</span>
            )}
          </span>
          <span>{tab.label}</span>
          <span className={styles.dot} />
        </button>
      ))}
    </nav>
  );
}
