export type TabId =
  | 'registrar'
  | 'historial'
  | 'dashboard'
  | 'deudas'
  | 'balance'
  | 'presupuestos'
  | 'config';

export interface BottomNavProps {
  active  : TabId;
  onChange: (tab: TabId) => void;
  badge?  : number;
}
