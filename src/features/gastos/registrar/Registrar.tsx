import { useState } from 'react';
import { PageHeader }   from '../../../components/ui/PageHeader';
import { GastoForm }    from './GastoForm';
import { DeudaForm }    from './DeudaForm';
import { AhorroForm }   from './AhorroForm';
import { IngresoForm }  from './IngresoForm';
import { ServicioForm } from './ServicioForm';
import { ResumenForm }  from '../../tarjetas/ResumenForm';
import type { Usuario, MedioPago, Meta } from '../../../lib/types';
import { FLAB } from '../../../lib/utils';
import styles from './Registrar.module.css';

interface Props {
  user   : Usuario;
  medios : MedioPago[];
  metas  : Meta[];
  prop   : number;
  onToast: (msg: string, type?: 'ok' | 'err' | 'warn') => void;
}

type TipoForm = 'gasto' | 'deuda' | 'ahorro' | 'ingreso' | 'servicio' | 'resumen' | null;

const TIPOS = [
  { id: 'gasto',    icon: '🛒', label: 'Gasto',           sub: 'Compras, delivery, ocio' },
  { id: 'deuda',    icon: '💳', label: 'Pago deuda',      sub: 'BBVA, Uala, MP' },
  { id: 'ahorro',   icon: '🎯', label: 'Ahorro',          sub: 'Metas personales' },
  { id: 'ingreso',  icon: '💰', label: 'Ingreso extra',   sub: 'Changas, ventas' },
  { id: 'servicio', icon: '🔌', label: 'Servicio',        sub: 'Luz, agua, gas…' },
  { id: 'resumen',  icon: '📄', label: 'Resumen tarjeta', sub: 'Cargá el resumen mensual' },
] as const;

export function Registrar({ user, medios, metas, prop, onToast }: Props) {
  const [tipo,    setTipo]    = useState<TipoForm>(null);
  const [success, setSuccess] = useState(false);

  function handleSuccess(msg: string) {
    onToast(msg);
    setTipo(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  }

  return (
    <div>
      <PageHeader
        title   ="Registrar"
        subtitle={FLAB}
        right={
          <div className={styles.avatar}>
            <div className={styles.avatarIcon}>{user.nombre[0].toUpperCase()}</div>
            <span className={styles.avatarName}>{user.nombre}</span>
          </div>
        }
      />

      {!tipo && !success && (
        <>
          <div className={styles.slab}>¿Qué movimiento?</div>
          <div className={styles.grid}>
            {TIPOS.map(t => (
              <button key={t.id} className={styles.typeBtn} onClick={() => setTipo(t.id)}>
                <span className={styles.typeIcon}>{t.icon}</span>
                <span className={styles.typeLabel}>{t.label}</span>
                <span className={styles.typeSub}>{t.sub}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tipo && <BackBtn onClick={() => setTipo(null)} />}

      {tipo === 'gasto'    && <GastoForm    user={user} medios={medios} prop={prop} onSuccess={handleSuccess} />}
      {tipo === 'deuda'    && <DeudaForm    user={user} onSuccess={handleSuccess} />}
      {tipo === 'ahorro'   && <AhorroForm   user={user} metas={metas}  onSuccess={handleSuccess} />}
      {tipo === 'ingreso'  && <IngresoForm  user={user} onSuccess={handleSuccess} />}
      {tipo === 'servicio' && <ServicioForm user={user} prop={prop}    onSuccess={handleSuccess} />}
      {tipo === 'resumen'  && (
        <ResumenForm
          user   ={user}
          medios ={medios}
          onToast={onToast}
          onDone ={() => handleSuccess('Resumen cargado ✓')}
        />
      )}

      {success && !tipo && (
        <div className={styles.successFlash}>
          <div style={{ fontSize: 48 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>¡Guardado!</div>
        </div>
      )}
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return <button className={styles.backBtn} onClick={onClick}>← Volver</button>;
}
