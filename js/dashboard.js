// ══════════════════════════════════════════════════════
//  dashboard.js — Tab Dashboard: stats, gráficos,
//                 metas y semáforo financiero
// ══════════════════════════════════════════════════════

let dashMode   = 'yo';
let mainChart  = null;
let chartMode  = 'cat';
let chartRange = 3;
let chartData  = { rows: [], mode: 'yo' };

const CHART_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
];

// ── Toggle Yo / Hogar ─────────────────────────────────
function setDash(m) {
  dashMode = m;
  document.getElementById('t-yo').classList.toggle('active',    m === 'yo');
  document.getElementById('t-hogar').classList.toggle('active', m === 'hogar');
  loadDash();
}

// ── Carga principal ───────────────────────────────────
async function loadDash() {
  try {
    let rows, srv, ing;

    if (dashMode === 'yo') {
      const [mios, comp, s] = await Promise.all([
        sbGet('movimientos', `user_id=eq.${CU.id}&estado=eq.confirmado&fecha=gte.${DESDE_MES}`),
        sbGet('movimientos', `es_compartido=eq.true&estado=eq.confirmado&user_id=neq.${CU.id}&fecha=gte.${DESDE_MES}`),
        sbGet('servicios',   `user_id=eq.${CU.id}&estado=eq.pendiente`)
      ]);
      rows = [...mios, ...comp];
      srv  = s;
      ing  = myIng();
      document.getElementById('d-ing-sub').textContent = 'mi ingreso mensual';
    } else {
      const [all, s] = await Promise.all([
        sbGet('movimientos', `estado=eq.confirmado&fecha=gte.${DESDE_MES}`),
        sbGet('servicios',   `estado=eq.pendiente`)
      ]);
      const seen = new Set();
      rows = all.filter(r => {
        if (r.es_compartido) { if (seen.has(r.id)) return false; seen.add(r.id); }
        return true;
      });
      srv = s;
      const ia = (AU.abril?.ingreso_fijo || 0) || ((AU.abril?.ingreso_q1 || 0) + (AU.abril?.ingreso_q2 || 0));
      ing = myIng() + ia;
      document.getElementById('d-ing-sub').textContent = 'ingreso hogar total';
    }

    document.getElementById('d-ing').textContent = fmtK(ing);

    // Gastos
    const gas = rows
      .filter(r => r.tipo === 'gasto' && !r.es_ahorro)
      .reduce((acc, r) => {
        // Comparar como string para evitar mismatch de tipos UUID vs number
        const esMio = String(r.user_id) === String(CU.id);
        const v = dashMode === 'yo' && r.es_compartido && !esMio
          ? (r.parte_contraparte || r.mi_parte)
          : r.mi_parte;
        return acc + (v || 0);
      }, 0);

    // Servicios pendientes del mes actual
    const hoyStr = HOY.toISOString().split('T')[0];
    const srvMes = srv.filter(s => {
      if (!s.fecha_vencimiento) return false;
      const mesV      = s.fecha_vencimiento.substring(0, 7);
      const mesActual = DESDE_MES.substring(0, 7);
      return mesV === mesActual || s.fecha_vencimiento <= hoyStr;
    });
    const faltaPagar = srvMes.reduce((a, s) => a + (s.mi_parte || 0), 0);

    const dis = ing - gas - faltaPagar;
    const pct = ing ? gas / ing : 0;

    document.getElementById('d-gas').textContent     = fmtK(gas);
    document.getElementById('d-gas-sub').textContent = (pct * 100).toFixed(0) + '% del ingreso';
    document.getElementById('d-falta').textContent   = fmtK(faltaPagar);
    document.getElementById('d-falta-sub').textContent =
      srvMes.length + ' servicio' + (srvMes.length !== 1 ? 's' : '');
    document.getElementById('d-dis').textContent = fmtK(dis);
    document.getElementById('d-dis').className   = 'sv ' + (dis >= 0 ? 'g' : 'r');

    // Metas
    await loadMetas();
    const mel           = document.getElementById('metas-dash');
    const metasMostrar  = dashMode === 'yo' ? UMetas : UMetas.filter(m => m.es_compartida);

    if (!metasMostrar.length) {
      mel.innerHTML = `<div style="font-size:13px;color:var(--tx3);">
        ${dashMode === 'yo' ? 'Sin metas personales. Creá una en Config.' : 'Sin metas compartidas aún.'}
      </div>`;
    } else {
      mel.innerHTML = metasMostrar.map(m => {
        const p  = m.monto_objetivo ? Math.min(100, (m.monto_actual / m.monto_objetivo * 100)) : 0;
        const ms = m.monto_actual >= m.monto_objetivo
          ? '🎉 ¡Alcanzada!'
          : Math.ceil((m.monto_objetivo - m.monto_actual) / 400000) + ' meses est.';

        return `<div class="mc" onclick="openMetaModal('${m.id}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:6px;">
            <div>
              <div style="font-size:14px;font-weight:600;">${m.emoji || '🎯'} ${m.nombre}
                ${m.es_compartida ? '<span style="font-size:10px;color:var(--ac2);">compartida</span>' : ''}
              </div>
              <div style="font-size:11px;color:var(--tx3);">${ms} · Tocá para ver detalle</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:13px;font-weight:600;color:var(--gn);">${fmt(m.monto_actual)}</div>
              <div style="font-size:11px;color:var(--tx3);">de ${fmt(m.monto_objetivo)}</div>
            </div>
          </div>
          <div class="btr"><div class="bfi" style="width:${p.toFixed(0)}%;background:var(--gn);"></div></div>
          <div style="font-size:11px;color:var(--tx3);margin-top:3px;">${p.toFixed(1)}%</div>
        </div>`;
      }).join('');
    }

    // Semáforo
    let si, st, ss;
    if (pct < 0.65)      { si = '🟢'; st = 'Finanzas saludables';  ss = `Gastás el ${(pct * 100).toFixed(0)}% del ingreso.`; }
    else if (pct < 0.85) { si = '🟡'; st = 'Atención';             ss = `Gastás el ${(pct * 100).toFixed(0)}%. Reducí gastos variables.`; }
    else                  { si = '🔴'; st = 'Situación crítica';    ss = `Gastás el ${(pct * 100).toFixed(0)}%. Hay que ajustar urgente.`; }

    document.getElementById('sem-i').textContent = si;
    document.getElementById('sem-t').textContent = st;
    document.getElementById('sem-s').textContent = ss;

    renderChart(rows, dashMode);
  } catch (e) {
    toast('Error dashboard: ' + e.message, 'err');
  }
}

// ── Cambio de tab de gráfico ──────────────────────────
function setChart(m) {
  chartMode = m;
  ['cat', 'medio', 'mes'].forEach(t => document.getElementById('ct-' + t)?.classList.remove('active'));
  document.getElementById('ct-' + m)?.classList.add('active');
  tog('range-selector', m === 'mes');
  renderChart(chartData.rows, chartData.mode);
}

function setRange(n, el) {
  chartRange = n;
  document.querySelectorAll('.rs-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderChart(chartData.rows, chartData.mode);
}

// ── Render de gráfico ─────────────────────────────────
async function renderChart(rows, mode) {
  chartData = { rows, mode };
  const canvas = document.getElementById('main-chart');

  // Destruir gráfico anterior si existe
  if (mainChart) {
    mainChart.destroy();
    mainChart = null;
  }

  // ── Torta por categoría ───────────────────────────
  if (chartMode === 'cat') {
    const cm = {};
    rows
      .filter(r => r.tipo === 'gasto' && !r.es_ahorro)
      .forEach(r => {
        const v = mode === 'yo' && r.es_compartido && String(r.user_id) !== String(CU.id)
          ? (r.parte_contraparte || r.mi_parte)
          : r.mi_parte;
        if (r.categoria) cm[r.categoria] = (cm[r.categoria] || 0) + (v || 0);
      });

    const sorted = Object.entries(cm).sort((a, b) => b[1] - a[1]).slice(0, 8);

    if (!sorted.length) {
      document.getElementById('chart-legend').innerHTML = '';
      const container = canvas?.closest('.chart-container');
      if (container) container.innerHTML =
        '<div style="font-size:13px;color:var(--tx3);text-align:center;padding:40px 0;">Sin datos este mes</div>';
      return;
    }

    mainChart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels  : sorted.map(([k]) => k),
        datasets: [{
          data           : sorted.map(([, v]) => v),
          backgroundColor: CHART_COLORS,
          borderWidth    : 0
        }]
      },
      options: {
        responsive         : true,
        maintainAspectRatio: false,
        plugins: {
          legend : { display: false },
          tooltip: {
            callbacks: {
              label: c =>
                ' ' + fmtK(c.raw) +
                ' (' + ((c.raw / sorted.reduce((a, [, v]) => a + v, 0)) * 100).toFixed(0) + '%)'
            }
          }
        }
      }
    });

    document.getElementById('chart-legend').innerHTML = sorted
      .map(([k, v], i) =>
        `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--tx2);">
           <span style="width:10px;height:10px;border-radius:2px;background:${CHART_COLORS[i % CHART_COLORS.length]};flex-shrink:0;"></span>
           ${k} ${fmtK(v)}
         </div>`)
      .join('');
  }

  // ── Barras por medio de pago ──────────────────────
  else if (chartMode === 'medio') {
    const mm = {};
    rows
      .filter(r => r.tipo === 'gasto' && !r.es_ahorro)
      .forEach(r => {
        const v = mode === 'yo' && r.es_compartido && String(r.user_id) !== String(CU.id)
          ? (r.parte_contraparte || r.mi_parte)
          : r.mi_parte;
        if (r.medio_pago) mm[r.medio_pago] = (mm[r.medio_pago] || 0) + (v || 0);
      });

    const sorted = Object.entries(mm).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) { document.getElementById('chart-legend').innerHTML = ''; return; }

    mainChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels  : sorted.map(([k]) => k),
        datasets: [{
          data           : sorted.map(([, v]) => v),
          backgroundColor: CHART_COLORS,
          borderRadius   : 6,
          borderWidth    : 0
        }]
      },
      options: {
        responsive         : true,
        maintainAspectRatio: false,
        indexAxis          : 'y',
        plugins: {
          legend : { display: false },
          tooltip: { callbacks: { label: c => ' ' + fmtK(c.raw) } }
        },
        scales: {
          x: {
            grid : { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#475569', font: { size: 10 }, callback: v => fmtK(v) }
          },
          y: {
            grid : { display: false },
            ticks: { color: '#94A3B8', font: { size: 11 } }
          }
        }
      }
    });

    document.getElementById('chart-legend').innerHTML = '';
  }

  // ── Línea mes a mes ───────────────────────────────
  else if (chartMode === 'mes') {
    const labels       = [];
    const gastosPorMes = [];

    for (let i = chartRange - 1; i >= 0; i--) {
      const d     = new Date(HOY.getFullYear(), HOY.getMonth() - i, 1);
      const desde = d.toISOString().split('T')[0];
      const hasta = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      labels.push(d.toLocaleString('es-AR', { month: 'short', year: '2-digit' }));

      try {
        const r = await sbGet(
          'movimientos',
          `user_id=eq.${CU.id}&tipo=eq.gasto&estado=eq.confirmado&fecha=gte.${desde}&fecha=lte.${hasta}`
        );
        gastosPorMes.push(r.reduce((a, x) => a + (x.mi_parte || 0), 0));
      } catch {
        gastosPorMes.push(0);
      }
    }

    mainChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data               : gastosPorMes,
          borderColor        : '#3B82F6',
          backgroundColor    : 'rgba(59,130,246,0.1)',
          borderWidth        : 2,
          tension            : 0.4,
          fill               : true,
          pointBackgroundColor: '#3B82F6',
          pointRadius        : 4
        }]
      },
      options: {
        responsive         : true,
        maintainAspectRatio: false,
        plugins: {
          legend : { display: false },
          tooltip: { callbacks: { label: c => ' ' + fmtK(c.raw) } }
        },
        scales: {
          x: {
            grid : { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94A3B8', font: { size: 10 } }
          },
          y: {
            grid : { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#475569', font: { size: 10 }, callback: v => fmtK(v) }
          }
        }
      }
    });

    document.getElementById('chart-legend').innerHTML = '';
  }
}

// ── Export JSON ───────────────────────────────────────
async function exportJSON() {
  try {
    toast('Exportando…');
    const [movs, servs, metas] = await Promise.all([
      sbGet('movimientos', `user_id=eq.${CU.id}&order=fecha.desc`),
      sbGet('servicios',   `user_id=eq.${CU.id}&order=created_at.desc`),
      sbGet('metas',       `user_id=eq.${CU.id}`)
    ]);
    const data = {
      exportado  : new Date().toISOString(),
      usuario    : CU.nombre,
      movimientos: movs,
      servicios  : servs,
      metas
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `finanzas_${CU.username}_${FISO}.json`;
    a.click();
    toast('Exportado ✓');
  } catch {
    toast('Error al exportar', 'err');
  }
}
