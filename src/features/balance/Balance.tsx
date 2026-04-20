import { useState, useEffect, useCallback } from 'react';
import { Card, Badge }             from '../../components/ui';
import { PageHeader }              from '../../components/ui/PageHeader';
import { usarSesion, usarToast }   from '../../context/SesionContext';
import { sbGet }                   from '../../lib/supabase';
import { fmt, num }                from '../../lib/utils';
import type { DeudaInterpersonal } from '../../lib/types';
import styles                      from './Balance.module.css';

export function Balance() {
  const { usuario, pareja } = usarSesion();
  const { mostrar: mostrarToast }          = usarToast();

  const [deudasMeDebenAMi,  setDeudasMeDebenAMi]  = useState<DeudaInterpersonal[]>([]);
  const [deudasLeDebYo,     setDeudasLeDebYo]      = useState<DeudaInterpersonal[]>([]);
  const [cargando,          setCargando]            = useState(true);

  const cargar = useCallback(async () => {
    if (!pareja) { setCargando(false); return; }
    setCargando(true);
    try {
      const [aMiFavor, queDebemos] = await Promise.all([
        sbGet<DeudaInterpersonal>('deudas_interpersonales', {
          acreedor_id: `eq.${usuario.id}`,
          estado     : 'neq.pagado',
        }, 0),
        sbGet<DeudaInterpersonal>('deudas_interpersonales', {
          deudor_id: `eq.${usuario.id}`,
          estado   : 'neq.pagado',
        }, 0),
      ]);
      setDeudasMeDebenAMi(aMiFavor);
      setDeudasLeDebYo(queDebemos);
    } catch {
      mostrarToast('Error al cargar el balance', 'err');
    } finally { setCargando(false); }
  }, [usuario.id, pareja]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Cálculo del neto ─────────────────────────────────
  const totalAMiFavor = deudasMeDebenAMi.reduce(
    (a, d) => a + num(d.monto_total) - num(d.monto_pagado), 0
  );
  const totalQueDebYo = deudasLeDebYo.reduce(
    (a, d) => a + num(d.monto_total) - num(d.monto_pagado), 0
  );
  const neto = totalAMiFavor - totalQueDebYo;

  // quién le debe a quién en términos netos
  const yoSoyAcreedor = neto > 0;
  const estaIgual     = neto === 0;

  if (!pareja) {
    return (
      <div>
        <PageHeader title="Balance" subtitle="Estado financiero entre ustedes" />
        <div className={styles.vacio}>Sin pareja configurada en el sistema.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Balance" subtitle={`${usuario.nombre} y ${pareja.nombre}`} />

      {cargando && <div className={styles.cargando}><div className={styles.spinner} /></div>}

      {!cargando && (
        <>
          {/* Neto principal */}
          <Card className={styles.cardNeto}>
            {estaIgual ? (
              <>
                <div className={styles.netoIcono}>⚖️</div>
                <div className={styles.netoTitulo}>¡Están al día!</div>
                <div className={styles.netoSub}>No hay deudas pendientes entre ustedes.</div>
              </>
            ) : (
              <>
                <div className={styles.netoIcono}>{yoSoyAcreedor ? '💚' : '🔴'}</div>
                <div className={styles.netoTitulo}>
                  {yoSoyAcreedor
                    ? `${pareja.nombre} te debe`
                    : `Le debés a ${pareja.nombre}`}
                </div>
                <div className={`${styles.netoMonto} ${yoSoyAcreedor ? styles.aFavor : styles.enContra}`}>
                  {fmt(Math.abs(neto))}
                </div>
                <div className={styles.netoSub}>saldo neto entre todas las deudas</div>
              </>
            )}
          </Card>

          {/* Desglose: lo que me deben */}
          {deudasMeDebenAMi.length > 0 && (
            <>
              <div className={styles.seccion} style={{ color: 'var(--gn)' }}>
                💚 {pareja.nombre} te debe — {fmt(totalAMiFavor)}
              </div>
              <Card className={styles.cardLista}>
                {deudasMeDebenAMi.map(d => {
                  const saldo = num(d.monto_total) - num(d.monto_pagado);
                  return (
                    <div key={d.id} className={styles.filaDeuda}>
                      <div className={styles.filaInfo}>
                        <div className={styles.filaDesc}>{d.descripcion}</div>
                        <div className={styles.filaMeta}>
                          {new Date(d.created_at).toLocaleDateString('es-AR')}
                          {' · '}
                          <span className={styles.origen}>{etiquetaOrigen(d.origen)}</span>
                        </div>
                      </div>
                      <div className={styles.filaDerecha}>
                        <div className={styles.filaMonto} style={{ color: 'var(--gn)' }}>{fmt(saldo)}</div>
                        {d.estado === 'parcial' && (
                          <Badge variant="warning">Parcial</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className={styles.filaTotalizadora}>
                  <span>Total a tu favor</span>
                  <span style={{ color: 'var(--gn)', fontFamily: 'var(--font-mono)' }}>{fmt(totalAMiFavor)}</span>
                </div>
              </Card>
            </>
          )}

          {/* Desglose: lo que le debo yo */}
          {deudasLeDebYo.length > 0 && (
            <>
              <div className={styles.seccion} style={{ color: 'var(--rd)' }}>
                🔴 Le debés a {pareja.nombre} — {fmt(totalQueDebYo)}
              </div>
              <Card className={styles.cardLista}>
                {deudasLeDebYo.map(d => {
                  const saldo = num(d.monto_total) - num(d.monto_pagado);
                  return (
                    <div key={d.id} className={styles.filaDeuda}>
                      <div className={styles.filaInfo}>
                        <div className={styles.filaDesc}>{d.descripcion}</div>
                        <div className={styles.filaMeta}>
                          {new Date(d.created_at).toLocaleDateString('es-AR')}
                          {' · '}
                          <span className={styles.origen}>{etiquetaOrigen(d.origen)}</span>
                        </div>
                      </div>
                      <div className={styles.filaDerecha}>
                        <div className={styles.filaMonto} style={{ color: 'var(--rd)' }}>{fmt(saldo)}</div>
                        {d.estado === 'parcial' && (
                          <Badge variant="warning">Parcial</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className={styles.filaTotalizadora}>
                  <span>Total en tu contra</span>
                  <span style={{ color: 'var(--rd)', fontFamily: 'var(--font-mono)' }}>{fmt(totalQueDebYo)}</span>
                </div>
              </Card>
            </>
          )}

          {deudasMeDebenAMi.length === 0 && deudasLeDebYo.length === 0 && (
            <div className={styles.vacio}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div>No hay deudas pendientes entre ustedes.</div>
            </div>
          )}
        </>
      )}
      <div style={{ height: 16 }} />
    </div>
  );
}

function etiquetaOrigen(origen: string): string {
  if (origen === 'gasto')   return 'Gasto compartido';
  if (origen === 'resumen') return 'Resumen tarjeta';
  return 'Manual';
}
