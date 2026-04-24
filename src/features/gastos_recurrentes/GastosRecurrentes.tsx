import { useEffect, useState }          from 'react';
import { getGastosRecurrentes,
         actualizarGastoRecurrente }    from '../../lib/gastos_recurrentes.service';
import type { GastoRecurrenteConHistorial,
              TipoGastoRecurrente }     from '../../lib/types';
import { TIPOS_GASTO_RECURRENTE }       from '../../lib/types';
import { usarSesion, usarToast }        from '../../context/SesionContext';
import { PageHeader }                   from '../../components/ui/PageHeader';
import { GastoRecurrenteCard }          from './GastoRecurrenteCard';
import { GastoRecurrenteForm }          from './GastoRecurrenteForm';
import { GraficoGastosRecurrentes }     from './GraficoGastosRecurrentes';
import { fmt }                          from '../../lib/utils';
import styles                           from './GastosRecurrentes.module.css';

// Agrupa por tipo para mostrar secciones
function agrupar(lista: GastoRecurrenteConHistorial[]) {
  const grupos: Partial<Record<TipoGastoRecurrente, GastoRecurrenteConHistorial[]>> = {};
  lista.forEach(g => {
    if (!grupos[g.tipo]) grupos[g.tipo] = [];
    grupos[g.tipo]!.push(g);
  });
  return grupos;
}

export function GastosRecurrentes() {
  const { usuario }             = usarSesion();
  const { mostrar: onToast }    = usarToast();
  const [lista,     setLista]   = useState<GastoRecurrenteConHistorial[]>([]);
  const [cargando,  setCarg]    = useState(true);
  const [mostrarForm, setForm]  = useState(false);
  const [editando,  setEdit]    = useState<GastoRecurrenteConHistorial | null>(null);

  async function cargar() {
    setCarg(true);
    try { setLista(await getGastosRecurrentes(usuario.id)); }
    finally { setCarg(false); }
  }

  useEffect(() => { cargar(); }, []);

  async function darDeBaja(id: string) {
    await actualizarGastoRecurrente(id, { activa: false });
    onToast('Gasto recurrente dado de baja', 'ok');
    cargar();
  }

  function cerrar() { setForm(false); setEdit(null); }

  function onGuardado() {
    cerrar();
    cargar();
    onToast(editando ? 'Actualizado' : 'Gasto recurrente creado', 'ok');
  }

  const totalMensual = lista.reduce((a, g) => a + g.ultimo_monto, 0);
  const pendientes   = lista.filter(g => !g.pagado_este_mes).length;
  const grupos       = agrupar(lista);

  return (
    <div className={styles.page}>
      <PageHeader title="Gastos recurrentes" />

      {/* Resumen rápido */}
      <div className={styles.resumen}>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Total mensual</span>
          <span className={styles.resumenValor}>{fmt(totalMensual)}</span>
        </div>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Activos</span>
          <span className={styles.resumenValor}>{lista.length}</span>
        </div>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Pendientes</span>
          <span className={`${styles.resumenValor} ${pendientes > 0 ? styles.pendiente : ''}`}>
            {pendientes}
          </span>
        </div>
      </div>

      {/* Gráfico */}
      {!cargando && lista.length > 0 && (
        <GraficoGastosRecurrentes gastos={lista} />
      )}

      {/* Header sección */}
      <div className={styles.seccionHeader}>
        <span className={styles.seccionTitulo}>Mis gastos recurrentes</span>
        <button className={styles.btnNuevo} onClick={() => { setEdit(null); setForm(true); }}>
          + Nuevo
        </button>
      </div>

      {cargando ? (
        <div className={styles.cargando}>Cargando...</div>
      ) : lista.length === 0 ? (
        <div className={styles.vacio}>
          <span className={styles.vacioEmoji}>🔄</span>
          <p>No tenés gastos recurrentes registrados</p>
          <button className={styles.btnVacio} onClick={() => setForm(true)}>
            Agregar primero
          </button>
        </div>
      ) : (
        /* Secciones agrupadas por tipo */
        Object.entries(grupos).map(([tipo, items]) => {
          const tipoInfo = TIPOS_GASTO_RECURRENTE.find(t => t.value === tipo);
          return (
            <div key={tipo} className={styles.grupo}>
              <div className={styles.grupoHeader}>
                <span>{tipoInfo?.emoji}</span>
                <span className={styles.grupoLabel}>{tipoInfo?.label ?? tipo}</span>
                <span className={styles.grupoCant}>{items!.length}</span>
              </div>
              <div className={styles.lista}>
                {items!.map(g => (
                  <GastoRecurrenteCard
                    key       ={g.id}
                    gasto     ={g}
                    onEditar  ={() => { setEdit(g); setForm(true); }}
                    onDarDeBaja={() => darDeBaja(g.id)}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {mostrarForm && (
        <GastoRecurrenteForm
          inicial  ={editando ?? undefined}
          onGuardado={onGuardado}
          onCerrar ={cerrar}
        />
      )}
    </div>
  );
}
