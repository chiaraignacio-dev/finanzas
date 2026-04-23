import { useEffect, useState } from 'react';
import { getSuscripciones, actualizarSuscripcion } from '../../lib/suscripciones.service';
import type { SuscripcionConHistorial } from '../../lib/types';
import { usarSesion, usarToast } from '../../context/SesionContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { SuscripcionCard } from './SuscripcionCard';
import { SuscripcionForm } from './SuscripcionForm';
import { GraficoSuscripciones } from './GraficoSuscripciones';
import { fmt } from '../../lib/utils';
import styles from './Suscripciones.module.css';

export function Suscripciones() {
  const { usuario }               = usarSesion();
  const { mostrar: onToast }      = usarToast();
  const [lista, setLista]         = useState<SuscripcionConHistorial[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [mostrarForm, setForm]    = useState(false);
  const [editando, setEditando]   = useState<SuscripcionConHistorial | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      setLista(await getSuscripciones(usuario.id));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function darDeBaja(id: string) {
    await actualizarSuscripcion(id, { activa: false });
    onToast('Suscripción dada de baja', 'ok');
    cargar();
  }

  function abrirEditar(s: SuscripcionConHistorial) {
    setEditando(s);
    setForm(true);
  }

  function cerrarForm() {
    setForm(false);
    setEditando(null);
  }

  function onGuardado() {
    cerrarForm();
    cargar();
    onToast(editando ? 'Suscripción actualizada' : 'Suscripción creada', 'ok');
  }

  const totalMensual = lista.reduce((a, s) => a + s.ultimo_monto, 0);
  const pendientes   = lista.filter((s) => !s.pagado_este_mes).length;

  return (
    <div className={styles.page}>
      <PageHeader titulo="Suscripciones" />

      {/* Resumen rápido */}
      <div className={styles.resumen}>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Total mensual</span>
          <span className={styles.resumenValor}>{fmt(totalMensual)}</span>
        </div>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Activas</span>
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
        <GraficoSuscripciones suscripciones={lista} />
      )}

      {/* Lista */}
      <div className={styles.seccionHeader}>
        <span className={styles.seccionTitulo}>Mis suscripciones</span>
        <button className={styles.btnNueva} onClick={() => { setEditando(null); setForm(true); }}>
          + Nueva
        </button>
      </div>

      {cargando ? (
        <div className={styles.cargando}>Cargando...</div>
      ) : lista.length === 0 ? (
        <div className={styles.vacio}>
          <span className={styles.vacioEmoji}>📦</span>
          <p>No tenés suscripciones registradas</p>
          <button className={styles.btnVacio} onClick={() => setForm(true)}>
            Agregar primera
          </button>
        </div>
      ) : (
        <div className={styles.lista}>
          {lista.map((s) => (
            <SuscripcionCard
              key={s.id}
              suscripcion={s}
              onEditar={() => abrirEditar(s)}
              onDarDeBaja={() => darDeBaja(s.id)}
            />
          ))}
        </div>
      )}

      {mostrarForm && (
        <SuscripcionForm
          inicial={editando ?? undefined}
          onGuardado={onGuardado}
          onCerrar={cerrarForm}
        />
      )}
    </div>
  );
}
