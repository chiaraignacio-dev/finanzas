export type TabId = 'registrar' | 'historial' | 'dashboard' | 'deudas' | 'config';

export interface NavTab {
  id   : TabId;
  label: string;
}

export interface BottomNavProps {
  active  : TabId;
  onChange: (tab: TabId) => void;
  badge?  : number;
}
