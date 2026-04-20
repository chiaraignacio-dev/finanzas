import { useState }               from 'react';
import { PageHeader }             from '../../../components/ui/PageHeader';
import { usarSesion, usarToast }  from '../../../context/SesionContext';
import { GastoForm }              from './GastoForm';
import { AhorroForm }             from './AhorroForm';
import { ServicioForm }           from './ServicioForm';
import { ResumenForm }            from '../../tarjetas/ResumenForm';
import { IngresoForm }            from '../../ingresos/IngresoForm';
import { DeudaExplicitaForm }     from '../../deudas/DeudaExplicitaForm';
import { obtenerFechaLab }        from '../../../lib/utils';
import styles                     from './Registrar.module.css';

type TipoFormulario = 'gasto' | 'deuda' | 'ahorro' | 'ingreso' | 'servicio' | 'resumen' | null;

const TIPOS_MOVIMIENTO = [
  { id: 'gasto',    icono: '🛒', etiqueta: 'Gasto',           descripcion: 'Compras, delivery, ocio' },
  { id: 'deuda',    icono: '📌', etiqueta: 'Deuda pendiente', descripcion: 'Seña, préstamo, saldo...' },
  { id: 'ahorro',   icono: '🎯', etiqueta: 'Ahorro',          descripcion: 'Metas personales' },
  { id: 'ingreso',  icono: '💰', etiqueta: 'Ingreso',         descripcion: 'Sueldo, extra, venta' },
  { id: 'servicio', icono: '🔌', etiqueta: 'Servicio',        descripcion: 'Luz, agua, gas…' },
  { id: 'resumen',  icono: '💳', etiqueta: 'Resumen tarjeta', descripcion: 'Cargá el resumen mensual' },
] as const;

export function Registrar() {
  const { usuario }               = usarSesion();
  const { mostrar: mostrarToast } = usarToast();
  const [tipo,    setTipo]    = useState<TipoFormulario>(null);
  const [exito,   setExito]   = useState(false);

  function manejarExito(mensaje: string) {
    mostrarToast(mensaje);
    setTipo(null);
    setExito(true);
    setTimeout(() => setExito(false), 2000);
  }

  return (
    <div>
      <PageHeader
        title   ="Registrar"
        subtitle={obtenerFechaLab()}
        right={
          <div className={styles.avatar}>
            <div className={styles.avatarIcono}>{usuario.nombre[0].toUpperCase()}</div>
            <span className={styles.avatarNombre}>{usuario.nombre}</span>
          </div>
        }
      />

      {!tipo && !exito && (
        <>
          <div className={styles.etiquetaSeccion}>¿Qué movimiento?</div>
          <div className={styles.grilla}>
            {TIPOS_MOVIMIENTO.map(t => (
              <button key={t.id} className={styles.botonTipo} onClick={() => setTipo(t.id)}>
                <span className={styles.icono}>{t.icono}</span>
                <span className={styles.etiqueta}>{t.etiqueta}</span>
                <span className={styles.descripcion}>{t.descripcion}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tipo && <BotonVolver onClick={() => setTipo(null)} />}

      {tipo === 'gasto'    && <GastoForm           onExito={manejarExito} />}
      {tipo === 'deuda'    && <DeudaExplicitaForm   onDone={() => manejarExito('Deuda registrada ✓')} />}
      {tipo === 'ahorro'   && <AhorroForm           onExito={manejarExito} />}
      {tipo === 'ingreso'  && <IngresoForm          onDone={() => manejarExito('Ingreso registrado ✓')} />}
      {tipo === 'servicio' && <ServicioForm         onExito={manejarExito} />}
      {tipo === 'resumen'  && <ResumenForm          onDone={() => manejarExito('Resumen cargado ✓')} />}

      {exito && !tipo && (
        <div className={styles.flashExito}>
          <div style={{ fontSize: 48 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>¡Guardado!</div>
        </div>
      )}
    </div>
  );
}

function BotonVolver({ onClick }: { onClick: () => void }) {
  return <button className={styles.botonVolver} onClick={onClick}>← Volver</button>;
}
