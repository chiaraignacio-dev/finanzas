export type TabId =
  | 'registrar'
  | 'historial'
  | 'dashboard'
  | 'deudas'
  | 'balance'
  | 'presupuestos'
  | 'suscripciones'
  | 'config';

export interface BottomNavProps {
  active  : TabId;
  onChange: (tab: TabId) => void;
  badge?  : number;
}
