export type TabId =
  | 'registrar'
  | 'historial'
  | 'dashboard'
  | 'deudas'
  | 'balance'
  | 'presupuestos'
  | 'gastos_recurrentes'
  | 'config';

export interface BottomNavProps {
  active  : TabId;
  onChange: (tab: TabId) => void;
  badge?  : number;
}
