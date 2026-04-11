// ══════════════════════════════════════════════════════
//  config.js — Tab Configuración: medios de pago,
//              metas, ingresos, cambio de contraseña
// ══════════════════════════════════════════════════════

// ── Carga inicial del tab Config ──────────────────────
async function loadCfgScreen() {
  renderMetasCfg();
  renderMediosCfg();
}

// ══ MEDIOS DE PAGO ════════════════════════════════════

async function loadMedios() {
  try {
    UM = await sbGet('medios_pago', `user_id=eq.${CU.id}&activo=eq.true&order=created_at.asc`);

    // Poblar selector de medio en form de Gasto
    const sel = document.getElementById('g-medio');
    sel.innerHTML = '<option value="">— Elegí —</option>';
    UM.forEach(m => {
      const o = document.createElement('option');
      o.value   = m.id;
      o.textContent = m.nombre;
      sel.appendChild(o);
    });

    renderMediosCfg();
  } catch (e) {
    console.error(e);
  }
}

// Listener: mostrar campo de cuotas si es tarjeta crédito
// (Los scripts se cargan al final del body, el DOM ya existe)
document.getElementById('g-medio')?.addEventListener('change', () => {
  const m = UM.find(x => x.id === document.getElementById('g-medio').value);
  tog('g-cuotas-wrap', m?.tipo === 'credito');
});

function renderMediosCfg() {
  const el = document.getElementById('cfg-medios');
  if (!UM.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--tx3);">Sin medios configurados</div>';
    return;
  }
  el.innerHTML = UM.map(m => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--bd);">
      <div>
        <div style="font-size:14px;">${m.nombre}</div>
        <div style="font-size:11px;color:var(--tx3);">
          ${m.tipo || '—'} · ${m.banco || '—'}${m.dia_cierre ? ' · ' + m.dia_cierre : ''}
        </div>
        ${m.saldo_deuda ? `<div style="font-size:11px;color:var(--rd);">Deuda: ${fmt(m.saldo_deuda)}</div>` : ''}
      </div>
      <button class="btn bs bsm" onclick="delMedio('${m.id}')"
        style="color:var(--rd);border-color:rgba(239,68,68,0.3);padding:4px 8px;">✕</button>
    </div>`).join('');
}

// Campo extra para medio de pago
function addExtra() {
  EC++;
  const w = document.getElementById('nm-extra');
  const d = document.createElement('div');
  d.className = 'field';
  d.innerHTML = `
    <label>Campo extra ${EC}</label>
    <div style="display:flex;gap:8px;">
      <input type="text" placeholder="Nombre" id="ek${EC}" style="flex:1;">
      <input type="text" placeholder="Valor"  id="ev${EC}" style="flex:1;">
    </div>`;
  w.appendChild(d);
}

async function saveMedio() {
  const n = document.getElementById('nm-n').value.trim();
  if (!n) { toast('Ingresá un nombre', 'err'); return; }

  // Recolectar campos extra
  const ex = {};
  for (let i = 1; i <= EC; i++) {
    const k = document.getElementById(`ek${i}`)?.value.trim();
    const v = document.getElementById(`ev${i}`)?.value.trim();
    if (k) ex[k] = v;
  }

  try {
    await sbPost('medios_pago', {
      user_id    : CU.id,
      nombre     : n,
      tipo       : document.getElementById('nm-t').value || null,
      banco      : document.getElementById('nm-b').value || null,
      dia_cierre : document.getElementById('nm-c').value || null,
      limite     : parseFloat(document.getElementById('nm-l').value) || null,
      saldo_deuda: parseFloat(document.getElementById('nm-d').value) || 0,
      datos_extra: ex
    });

    toast('Medio agregado ✓');
    hide('add-medio');
    EC = 0;
    document.getElementById('nm-extra').innerHTML = '';
    ['nm-n', 'nm-b', 'nm-c', 'nm-l', 'nm-d'].forEach(id => (document.getElementById(id).value = ''));
    await loadMedios();
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

async function delMedio(id) {
  if (!confirm('¿Eliminar?')) return;
  try {
    await sbPatch('medios_pago', id, { activo: false });
    toast('Eliminado');
    await loadMedios();
  } catch {
    toast('Error', 'err');
  }
}

// ══ METAS DE AHORRO ═══════════════════════════════════

async function loadMetas() {
  try {
    UMetas = await sbGet('metas', `user_id=eq.${CU.id}&activa=eq.true&order=created_at.asc`);

    const sel = document.getElementById('a-meta');
    sel.innerHTML = '<option value="">— Elegí una meta —</option>';
    UMetas.forEach(m => {
      const o = document.createElement('option');
      o.value       = m.id;
      o.textContent = (m.emoji || '🎯') + ' ' + m.nombre + ' — ' + fmtK(m.monto_objetivo);
      sel.appendChild(o);
    });
  } catch { /* silencioso */ }
}

async function saveMeta() {
  const n    = document.getElementById('mn').value.trim();
  const monto = parseFloat(document.getElementById('mm').value) || 0;
  const comp = document.querySelector('[name="m-comp"]:checked')?.value === 'si';

  if (!n || !monto) { toast('Completá nombre y monto', 'err'); return; }

  try {
    await sbPost('metas', {
      user_id       : CU.id,
      nombre        : n,
      emoji         : document.getElementById('me').value || '🎯',
      monto_objetivo: monto,
      monto_actual  : 0,
      fecha_objetivo: document.getElementById('mf').value || null,
      es_compartida : comp
    });

    toast('Meta creada ✓');
    hide('add-meta');
    ['mn', 'me', 'mm', 'mf'].forEach(id => (document.getElementById(id).value = ''));
    await loadMetas();
    renderMetasCfg();
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

async function delMeta(id) {
  if (!confirm('¿Eliminar esta meta?')) return;
  try {
    await sbPatch('metas', id, { activa: false });
    toast('Meta eliminada');
    await loadMetas();
    renderMetasCfg();
  } catch {
    toast('Error', 'err');
  }
}

function renderMetasCfg() {
  const el = document.getElementById('cfg-metas');
  if (!UMetas.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--tx3);">Sin metas creadas aún</div>';
    return;
  }
  el.innerHTML = UMetas.map(m => {
    const p = m.monto_objetivo ? Math.min(100, (m.monto_actual / m.monto_objetivo * 100)) : 0;
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <div>
            <div style="font-size:14px;font-weight:600;">${m.emoji || '🎯'} ${m.nombre}
              ${m.es_compartida
                ? '<span style="font-size:10px;color:var(--ac2);background:rgba(59,130,246,0.1);padding:1px 5px;border-radius:4px;">compartida</span>'
                : ''}
            </div>
            ${m.fecha_objetivo
              ? `<div style="font-size:11px;color:var(--tx3);">${new Date(m.fecha_objetivo).toLocaleDateString('es-AR')}</div>`
              : ''}
          </div>
          <button class="btn bs bsm" onclick="delMeta('${m.id}')"
            style="color:var(--rd);border-color:rgba(239,68,68,0.3);">✕</button>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--tx3);margin-bottom:5px;">
          <span>${fmt(m.monto_actual)}</span><span>de ${fmt(m.monto_objetivo)}</span>
        </div>
        <div class="btr"><div class="bfi" style="width:${p.toFixed(0)}%;background:var(--gn);"></div></div>
        <div style="font-size:11px;color:var(--tx3);margin-top:4px;">${p.toFixed(1)}%</div>
      </div>`;
  }).join('');
}

// ── Modal de detalle de meta ──────────────────────────
function openMetaModal(metaId) {
  const meta = UMetas.find(m => m.id === metaId);
  if (!meta) return;

  sbGet('movimientos', `es_ahorro=eq.true&user_id=eq.${CU.id}&notas=like.*${meta.nombre}*&order=fecha.desc&limit=30`)
    .then(rows => {
      const pct  = meta.monto_objetivo ? Math.min(100, (meta.monto_actual / meta.monto_objetivo * 100)) : 0;
      const html = `
        <div class="modal-title">${meta.emoji || '🎯'} ${meta.nombre}</div>
        <div class="modal-sub">${meta.es_compartida ? 'Meta compartida con tu pareja' : 'Meta personal'}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <div>
            <div style="font-size:11px;color:var(--tx3);">Ahorrado</div>
            <div style="font-size:22px;font-weight:600;font-family:'DM Mono',monospace;color:var(--gn);">${fmt(meta.monto_actual)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:var(--tx3);">Objetivo</div>
            <div style="font-size:22px;font-weight:600;font-family:'DM Mono',monospace;">${fmt(meta.monto_objetivo)}</div>
          </div>
        </div>
        <div class="btr" style="height:8px;margin-bottom:8px;">
          <div class="bfi" style="width:${pct.toFixed(0)}%;background:var(--gn);"></div>
        </div>
        <div style="font-size:13px;color:var(--tx3);margin-bottom:16px;">${pct.toFixed(1)}% completado</div>
        <div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Historial de depósitos</div>
        ${rows.length
          ? rows.map(r => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd);">
                <div>
                  <div style="font-size:13px;font-weight:500;">Depósito</div>
                  <div style="font-size:11px;color:var(--tx3);">${r.fecha}${r.notas ? ' · ' + r.notas : ''}</div>
                </div>
                <div style="font-size:14px;font-weight:600;font-family:'DM Mono',monospace;color:var(--gn);">+${fmt(r.mi_parte)}</div>
              </div>`).join('')
          : '<div style="font-size:13px;color:var(--tx3);">Sin depósitos aún</div>'}
      `;
      openModal(html);
    })
    .catch(() => openModal('<div>Error al cargar depósitos</div>'));
}

// ══ INGRESOS ══════════════════════════════════════════

async function loadCfgIngresos() {
  const u = AU[CU.username] || {};

  if (u.ingreso_q1 || u.ingreso_q2) {
    const el = document.querySelector('[name="ci-t"][value="q"]')?.closest('.ro');
    if (el) { selR('ci-t', 'q', el); show('ci-q'); hide('ci-fijo'); }
    document.getElementById('ci-q1').value = u.ingreso_q1 || '';
    document.getElementById('ci-q2').value = u.ingreso_q2 || '';
  } else {
    document.getElementById('ci-f').value = u.ingreso_fijo || '';
  }

  // Actualizar label de proporción
  document.getElementById('g-prop-sub').textContent =
    `~${(getProp() * 100).toFixed(0)}% mío según ingresos`;
}

async function saveIngresos() {
  const t = document.querySelector('[name="ci-t"]:checked')?.value || 'fijo';
  const d = t === 'fijo'
    ? { ingreso_fijo: parseFloat(document.getElementById('ci-f').value) || 0, ingreso_q1: 0, ingreso_q2: 0 }
    : { ingreso_q1: parseFloat(document.getElementById('ci-q1').value) || 0,
        ingreso_q2: parseFloat(document.getElementById('ci-q2').value) || 0,
        ingreso_fijo: 0 };

  try {
    await sbPatch('usuarios', CU.id, d);
    AU[CU.username] = { ...AU[CU.username], ...d };
    toast('Ingresos guardados ✓');
    document.getElementById('g-prop-sub').textContent =
      `~${(getProp() * 100).toFixed(0)}% mío según ingresos`;
  } catch {
    toast('Error', 'err');
  }
}
