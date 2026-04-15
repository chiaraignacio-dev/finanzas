export type TabId = 'registrar' | 'historial' | 'dashboard' | 'config';

export interface NavTab {
  id   : TabId;
  label: string;
  icon : string; // SVG path data
}

export interface BottomNavProps {
  active  : TabId;
  onChange: (tab: TabId) => void;
  badge?  : number; // para historial
}
