import { useState, useEffect, useCallback } from 'react';
import { Card, Button } from '../../components/ui';
import { sbGet, sbPatch } from '../../lib/supabase';
import { fmt, FISO } from '../../lib/utils';
import type { Usuario, Ingreso } from '../../lib/types';
import styles from './IngresosPendientes.module.css';

interface Props {
  user   : Usuario;
  onToast: (msg: string, type?: 'ok' | 'err' | 'warn') => void;
  onPaid : () => void;
}

export function IngresosPendientes({ user, onToast, onPaid }: Props) {
  const [pendientes, setPendientes] = useState<Ingreso[]>([]);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await sbGet<Ingreso>('ingresos', {
        user_id : `eq.${user.id}`,
        recibido: 'eq.false',
      });
      setPendientes(rows);
    } finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  async function confirmar(ingreso: Ingreso) {
    try {
      await sbPatch('ingresos', ingreso.id, {
        recibido      : true,
        fecha_recibido: FISO,
      });
      onToast(`${ingreso.descripcion} confirmado ✓`);
      onPaid();
      load();
    } catch { onToast('Error', 'err'); }
  }

  if (loading) return null;
  if (!pendientes.length) return null;

  return (
    <div>
      <div className={styles.slab}>💰 Ingresos por confirmar</div>
      <Card className={styles.card}>
        {pendientes.map(ing => (
          <div key={ing.id} className={styles.item}>
            <div className={styles.info}>
              <div className={styles.desc}>{ing.descripcion}</div>
              <div className={styles.meta}>
                {ing.fecha_esperada
                  ? `Esperado: ${new Date(ing.fecha_esperada).toLocaleDateString('es-AR')}`
                  : 'Sin fecha estimada'}
              </div>
            </div>
            <div className={styles.right}>
              <div className={styles.monto}>{fmt(parseFloat(ing.monto))}</div>
              <Button
                variant ="success"
                size    ="sm"
                onClick ={() => confirmar(ing)}
                style   ={{ marginTop: 4 }}
              >
                Recibido ✓
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
