import { useEffect, useState } from 'react';
import { sbGet }               from '../../lib/supabase';
import { usarSesion }          from '../../context/SesionContext';
import { fmt }                 from '../../lib/utils';
import type { Movimiento, Servicio, ResumenTarjeta } from '../../lib/types';
import styles from './CierreMes.module.css';

const STORAGE_KEY = 'myfi_cierre_visto';

function mesAnteriorISO(): { desde: string; hasta: string; label: string } {
  const hoy   = new Date();
  const anio  = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
  const mes   = hoy.getMonth() === 0 ? 12 : hoy.getMonth(); // mes anterior (1-based)
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-31`;
  const label = new Date(anio, mes - 1, 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  return { desde, hasta, label };
}

function mesActualKey(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

interface DatosCierre {
  label         : string;
  totalGastado  : number;
  totalAhorrado : number;
  deudasSaldadas: number;
  serviciosPend : number;
  tarjetasPend  : number;
  mesAnteriorGas: number;  // para comparar
}

export function CierreMes() {
  const { usuario }                 = usarSesion();
  const [datos, setDatos]           = useState<DatosCierre | null>(null);
  const [visible, setVisible]       = useState(false);
  

  useEffect(() => {
    // Mostrar solo una vez por mes-año de apertura
    const visto = localStorage.getItem(STORAGE_KEY);
    const claveActual = mesActualKey();
    if (visto === claveActual) return;

    // Solo mostrar si no es el primer día del mes (para no molestar siempre)
    const hoy = new Date();
    if (hoy.getDate() > 15) return; // solo primera quincena

    cargarDatos();
  }, [usuario.id]);

  async function cargarDatos() {
    
    try {
      const { desde, label } = mesAnteriorISO();

      const [movs, servicios, resumenes, movsAnterior] = await Promise.all([
        sbGet<Movimiento>('movimientos', {
          user_id: `eq.${usuario.id}`,
          estado : 'eq.confirmado',
          fecha  : `gte.${desde}`,
        }, 0),
        sbGet<Servicio>('servicios', {
          user_id: `eq.${usuario.id}`,
          estado : 'eq.pendiente',
        }, 0),
        sbGet<ResumenTarjeta>('resumenes_tarjeta', {
          user_id   : `eq.${usuario.id}`,
          estado    : 'neq.pagado',
          es_vigente: 'eq.true',
        }, 0),
        // mes anterior al anterior para comparar
        sbGet<Movimiento>('movimientos', {
          user_id: `eq.${usuario.id}`,
          estado : 'eq.confirmado',
          tipo   : 'eq.gasto',
        }, 0),
      ]);

      const gastos   = movs.filter(m => m.tipo === 'gasto' && !m.es_ahorro);
      const ahorros  = movs.filter(m => m.es_ahorro || m.tipo === 'ahorro');
      const deudas   = movs.filter(m => m.tipo === 'deuda' && m.estado === 'confirmado');

      const totalGastado   = gastos.reduce((a, m) => a + parseFloat(m.mi_parte || '0'), 0);
      const totalAhorrado  = ahorros.reduce((a, m) => a + parseFloat(m.mi_parte || '0'), 0);
      const deudasSaldadas = deudas.reduce((a, m) => a + parseFloat(m.mi_parte || '0'), 0);

      // Servicios pendientes del mes anterior
      const { desde: desdeAnt } = mesAnteriorISO();
      const serviciosPend = servicios.filter(s => s.fecha_vencimiento < desdeAnt.substring(0, 8) + '01').length;
      const tarjetasPend  = resumenes.reduce((a, r) =>
        a + parseFloat(r.monto_total) - parseFloat(r.monto_pagado), 0);

      // Gasto del mes anterior al que estamos cerrando (2 meses atrás)
      const hoy    = new Date();
      const dosAtras = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
      const desdeDA = `${dosAtras.getFullYear()}-${String(dosAtras.getMonth() + 1).padStart(2, '0')}-01`;
      const hastaDA = `${dosAtras.getFullYear()}-${String(dosAtras.getMonth() + 1).padStart(2, '0')}-31`;
      const movsDA  = movsAnterior.filter(m =>
        m.tipo === 'gasto' && m.fecha >= desdeDA && m.fecha <= hastaDA
      );
      const mesAnteriorGas = movsDA.reduce((a, m) => a + parseFloat(m.mi_parte || '0'), 0);

      // Solo mostrar si hay datos reales del mes anterior
      if (totalGastado === 0 && totalAhorrado === 0) return;

      setDatos({ label, totalGastado, totalAhorrado, deudasSaldadas, serviciosPend, tarjetasPend, mesAnteriorGas });
      setVisible(true);
    } catch { /* noop */ } finally {
      
    }
  }

  function cerrar() {
    localStorage.setItem(STORAGE_KEY, mesActualKey());
    setVisible(false);
  }

  if (!visible || !datos) return null;

  const diff    = datos.totalGastado - datos.mesAnteriorGas;
  const hasDiff = datos.mesAnteriorGas > 0;
  const mejoró  = diff < 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.emoji}>📅</span>
          <div>
            <div className={styles.titulo}>Cierre de {datos.label}</div>
            <div className={styles.subtitulo}>Así cerraste el mes</div>
          </div>
        </div>

        {/* Stats principales */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total gastado</div>
            <div className={`${styles.statVal} ${styles.rojo}`}>{fmt(datos.totalGastado)}</div>
            {hasDiff && (
              <div className={`${styles.statDiff} ${mejoró ? styles.verde : styles.rojo}`}>
                {mejoró ? '▼' : '▲'} {fmt(Math.abs(diff))} vs mes anterior
              </div>
            )}
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>Ahorrado</div>
            <div className={`${styles.statVal} ${styles.verde}`}>{fmt(datos.totalAhorrado)}</div>
          </div>

          {datos.deudasSaldadas > 0 && (
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Deudas saldadas</div>
              <div className={`${styles.statVal} ${styles.verde}`}>{fmt(datos.deudasSaldadas)}</div>
            </div>
          )}

          {datos.tarjetasPend > 0 && (
            <div className={`${styles.statCard} ${styles.alerta}`}>
              <div className={styles.statLabel}>⚠️ Tarjeta pendiente</div>
              <div className={`${styles.statVal} ${styles.amarillo}`}>{fmt(datos.tarjetasPend)}</div>
            </div>
          )}

          {datos.serviciosPend > 0 && (
            <div className={`${styles.statCard} ${styles.alerta}`}>
              <div className={styles.statLabel}>⚠️ Servicios sin pagar</div>
              <div className={`${styles.statVal} ${styles.amarillo}`}>{datos.serviciosPend} servicio{datos.serviciosPend > 1 ? 's' : ''}</div>
            </div>
          )}
        </div>

        {/* Comparación con mes anterior */}
        {hasDiff && (
          <div className={`${styles.comparacion} ${mejoró ? styles.comparacionBien : styles.comparacionMal}`}>
            {mejoró
              ? `✓ Gastaste ${fmt(Math.abs(diff))} menos que el mes anterior. ¡Bien!`
              : `Gastaste ${fmt(diff)} más que el mes anterior.`
            }
          </div>
        )}

        <button className={styles.btnCerrar} onClick={cerrar}>
          Entendido, arrancar {new Date().toLocaleString('es-AR', { month: 'long' })}
        </button>
      </div>
    </div>
  );
}
