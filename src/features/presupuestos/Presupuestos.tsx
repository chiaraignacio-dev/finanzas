import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Select, Badge } from '../../components/ui';
import { PageHeader }                          from '../../components/ui/PageHeader';
import { ConfirmDialog }                       from '../../components/ui/ConfirmDialog';
import { usarSesion, usarToast }               from '../../context/SesionContext';
import { sbGet, sbPost, sbPatch }              from '../../lib/supabase';
import { fmt, num, obtenerDesdeMes }           from '../../lib/utils';
import { CATEGORIAS }                          from '../../lib/types';
import type { Presupuesto, Movimiento }        from '../../lib/types';
import styles                                  from './Presupuestos.module.css';

interface PresupuestoConGasto extends Presupuesto {
  gastado : number;
  pct     : number;
  estado  : 'ok' | 'alerta' | 'excedido';
}

export function Presupuestos() {
  const { usuario }               = usarSesion();
  const { mostrar: mostrarToast } = usarToast();

  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[]>([]);
  const [cargando,     setCargando]     = useState(true);
  const [mostrarForm,  setMostrarForm]  = useState(false);
  const [confirmando,  setConfirmando]  = useState<string | null>(null);

  // Form nuevo presupuesto
  const [nuevaCat,    setNuevaCat]    = useState('');
  const [nuevoLimite, setNuevoLimite] = useState('');
  const [guardando,   setGuardando]   = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const desdeMes = obtenerDesdeMes();

      const [presupsBD, movsBD] = await Promise.all([
        sbGet<Presupuesto>('presupuestos', {
          user_id: `eq.${usuario.id}`,
          activo : 'eq.true',
        }, 30_000),
        sbGet<Movimiento>('movimientos', {
          user_id: `eq.${usuario.id}`,
          tipo   : 'eq.gasto',
          estado : 'eq.confirmado',
          fecha  : `gte.${desdeMes}`,
        }, 0),
      ]);

      // Calcular gasto real por categoría este mes
      const gastoPorCategoria: Record<string, number> = {};
      movsBD.forEach(m => {
        if (m.categoria) {
          gastoPorCategoria[m.categoria] =
            (gastoPorCategoria[m.categoria] || 0) + num(m.mi_parte);
        }
      });

      const presupuestosConGasto: PresupuestoConGasto[] = presupsBD.map(p => {
        const gastado = gastoPorCategoria[p.categoria] || 0;
        const limite  = num(p.monto_limite);
        const pct     = limite > 0 ? (gastado / limite) * 100 : 0;
        const estado  = pct >= 100 ? 'excedido' : pct >= 80 ? 'alerta' : 'ok';
        return { ...p, gastado, pct, estado };
      });

      // Ordenar: excedidos primero, después alertas, después ok
      presupuestosConGasto.sort((a, b) => {
        const orden = { excedido: 0, alerta: 1, ok: 2 };
        return orden[a.estado] - orden[b.estado];
      });

      setPresupuestos(presupuestosConGasto);
    } catch {
      mostrarToast('Error al cargar presupuestos', 'err');
    } finally { setCargando(false); }
  }, [usuario.id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardarPresupuesto() {
    if (!nuevaCat || !nuevoLimite) {
      mostrarToast('Completá categoría y límite', 'err'); return;
    }
    setGuardando(true);
    try {
      // Verificar si ya existe un presupuesto para esa categoría
      const existente = presupuestos.find(p => p.categoria === nuevaCat);
      if (existente) {
        await sbPatch('presupuestos', existente.id, {
          monto_limite: num(nuevoLimite),
          activo      : true,
        });
        mostrarToast('Presupuesto actualizado ✓');
      } else {
        await sbPost('presupuestos', {
          user_id     : usuario.id,
          categoria   : nuevaCat,
          monto_limite: num(nuevoLimite),
          activo      : true,
        });
        mostrarToast('Presupuesto creado ✓');
      }
      setNuevaCat(''); setNuevoLimite('');
      setMostrarForm(false);
      cargar();
    } catch { mostrarToast('Error', 'err');
    } finally { setGuardando(false); }
  }

  async function eliminarPresupuesto(id: string) {
    await sbPatch('presupuestos', id, { activo: false });
    mostrarToast('Presupuesto eliminado');
    setConfirmando(null);
    cargar();
  }

  // Categorías disponibles (las que no tienen presupuesto aún)
  const categoriasDisponibles = CATEGORIAS
    .filter(c => !presupuestos.some(p => p.categoria === c))
    .map(c => ({ value: c, label: c }));

  const totalLimite  = presupuestos.reduce((a, p) => a + num(p.monto_limite), 0);
  const totalGastado = presupuestos.reduce((a, p) => a + p.gastado, 0);
  const pctTotal     = totalLimite > 0 ? (totalGastado / totalLimite) * 100 : 0;

  return (
    <div>
      <ConfirmDialog
        abierto    ={!!confirmando}
        mensaje    ="¿Eliminás este presupuesto?"
        peligroso
        labelConfirmar="Sí, eliminar"
        onConfirmar={() => confirmando && eliminarPresupuesto(confirmando)}
        onCancelar ={() => setConfirmando(null)}
      />

      <PageHeader title="Presupuestos" subtitle="Límites de gasto por categoría" />

      {/* Resumen global */}
      {presupuestos.length > 0 && (
        <Card className={styles.cardResumen}>
          <div className={styles.resumenFila}>
            <span className={styles.resumenEtiqueta}>Gastado este mes</span>
            <span className={styles.resumenMonto}>{fmt(totalGastado)}</span>
          </div>
          <div className={styles.resumenFila}>
            <span className={styles.resumenEtiqueta}>Límite total presupuestado</span>
            <span className={styles.resumenMonto}>{fmt(totalLimite)}</span>
          </div>
          <div className={styles.barraWrap}>
            <div className={styles.barra}>
              <div
                className={styles.barraRelleno}
                style={{
                  width     : `${Math.min(pctTotal, 100).toFixed(0)}%`,
                  background: pctTotal >= 100 ? 'var(--rd)' : pctTotal >= 80 ? 'var(--am)' : 'var(--gn)',
                }}
              />
            </div>
            <div className={styles.barraPct}>{pctTotal.toFixed(0)}% del presupuesto total</div>
          </div>
        </Card>
      )}

      {/* Lista de presupuestos */}
      {cargando && <div className={styles.cargando}><div className={styles.spinner} /></div>}

      {!cargando && presupuestos.length === 0 && !mostrarForm && (
        <div className={styles.vacio}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div>Sin presupuestos configurados.</div>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4 }}>
            Agregá límites por categoría para controlar tus gastos.
          </div>
        </div>
      )}

      {!cargando && presupuestos.map(p => {
        const limite  = num(p.monto_limite);
        const restante = Math.max(0, limite - p.gastado);
        const excedido = p.gastado > limite;

        return (
          <Card key={p.id} className={styles.cardPresupuesto}>
            <div className={styles.encabezado}>
              <div>
                <div className={styles.categoria}>{p.categoria}</div>
                <div className={styles.montos}>
                  <span style={{ color: excedido ? 'var(--rd)' : 'var(--tx2)' }}>
                    {fmt(p.gastado)}
                  </span>
                  <span style={{ color: 'var(--tx3)' }}> / {fmt(limite)}</span>
                </div>
              </div>
              <div className={styles.encabezadoDerecha}>
                <Badge
                  variant={
                    p.estado === 'excedido' ? 'danger' :
                    p.estado === 'alerta'   ? 'warning' : 'success'
                  }
                >
                  {p.estado === 'excedido' ? 'Excedido' :
                   p.estado === 'alerta'   ? 'Atención' : 'OK'}
                </Badge>
                <button
                  className={styles.botonEliminar}
                  onClick={() => setConfirmando(p.id)}
                >✕</button>
              </div>
            </div>

            <div className={styles.barraWrap}>
              <div className={styles.barra}>
                <div
                  className={styles.barraRelleno}
                  style={{
                    width     : `${Math.min(p.pct, 100).toFixed(0)}%`,
                    background: p.estado === 'excedido' ? 'var(--rd)' :
                                p.estado === 'alerta'   ? 'var(--am)' : 'var(--gn)',
                  }}
                />
              </div>
            </div>

            <div className={styles.piePie}>
              {excedido
                ? <span style={{ color: 'var(--rd)' }}>
                    Excedido por {fmt(p.gastado - limite)}
                  </span>
                : <span style={{ color: 'var(--tx3)' }}>
                    Disponible: {fmt(restante)}
                  </span>
              }
              <span style={{ color: 'var(--tx3)' }}>{p.pct.toFixed(0)}%</span>
            </div>
          </Card>
        );
      })}

      {/* Form nuevo presupuesto */}
      {mostrarForm && (
        <Card className={styles.cardForm}>
          <div className={styles.formTitulo}>Nuevo presupuesto</div>
          <Select
            label   ="Categoría *"
            options ={categoriasDisponibles}
            value   ={nuevaCat}
            onChange={e => setNuevaCat(e.target.value)}
            placeholder="— Elegí una categoría —"
            fullWidth
          />
          {categoriasDisponibles.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--tx3)' }}>
              Ya tenés presupuesto para todas las categorías.
            </div>
          )}
          <Input
            label      ="Límite mensual ($) *"
            type       ="number"
            placeholder="0"
            value      ={nuevoLimite}
            onChange   ={e => setNuevoLimite(e.target.value)}
            fullWidth
          />
          <Button variant="primary" fullWidth loading={guardando} onClick={guardarPresupuesto}>
            Guardar presupuesto
          </Button>
          <Button variant="secondary" fullWidth onClick={() => { setMostrarForm(false); setNuevaCat(''); setNuevoLimite(''); }}>
            Cancelar
          </Button>
        </Card>
      )}

      <div style={{ margin: '0 16px 16px' }}>
        <Button variant="secondary" fullWidth onClick={() => setMostrarForm(v => !v)}>
          + Agregar presupuesto
        </Button>
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}
