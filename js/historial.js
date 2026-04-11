// ══════════════════════════════════════════════════════
//  historial.js — Tab Historial: movimientos,
//                 pendientes y servicios por vencer
// ══════════════════════════════════════════════════════

const ICONS = { gasto: '🛒', deuda: '💳', ahorro: '🎯', ingreso: '💰', servicio: '🔌' };
let histMode = 'yo';

function setHistMode(m) {
  histMode = m;
  document.getElementById('ht-yo').classList.toggle('active',    m === 'yo');
  document.getElementById('ht-hogar').classList.toggle('active', m === 'hogar');
  document.getElementById('hist-mov-label').textContent =
    m === 'yo' ? 'Mis movimientos' : 'Movimientos del hogar';
  loadHist();
}

async function loadHist() {
  const el = document.getElementById('hist-lista');
  el.innerHTML = '<div class="lw"><div class="spin"></div></div>';
  checkPend();
  checkSrvVcto();

  try {
    let all;

    if (histMode === 'yo') {
      const [mios, comp] = await Promise.all([
        sbGet('movimientos', `user_id=eq.${CU.id}&estado=eq.confirmado&order=fecha.desc&limit=30`),
        sbGet('movimientos', `es_compartido=eq.true&estado=eq.confirmado&user_id=neq.${CU.id}&order=fecha.desc&limit=20`)
      ]);
      all = [...mios, ...comp].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 40);
    } else {
      const rows  = await sbGet('movimientos', `es_compartido=eq.true&estado=eq.confirmado&order=fecha.desc&limit=50`);
      const seen  = new Set();
      all = rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
    }

    document.getElementById('hist-sub').textContent = all.length + ' movimientos';

    if (!all.length) {
      el.innerHTML = '<div style="font-size:13px;color:var(--tx3);padding:8px 0;">Sin movimientos aún</div>';
      return;
    }

    el.innerHTML = all.map(r => {
      const isMine = r.user_id === CU.id;
      const mShow  = r.es_compartido && !isMine ? (r.parte_contraparte || r.mi_parte) : r.mi_parte;
      const esPos  = r.tipo === 'ingreso';
      const esNeu  = r.tipo === 'ahorro';
      const cls    = esPos ? 'pos' : esNeu ? 'neu' : 'neg';
      const signo  = esPos ? '+' : '-';
      const quien  = !isMine
        ? ' · de ' + (r.user_id === AU.ignacio?.id ? 'Ignacio' : 'Abril')
        : '';

      return `<div class="mi">
        <div class="mico ${r.tipo}">${ICONS[r.tipo] || '•'}</div>
        <div class="minfo">
          <div class="mdesc">${r.descripcion || '—'}${r.es_compartido ? '<span class="cbadge">compartido</span>' : ''}</div>
          <div class="mmeta">${r.fecha} · ${r.categoria || r.tipo}${quien}</div>
        </div>
        <div class="mamt ${cls}">${signo}${fmtK(mShow)}</div>
      </div>`;
    }).join('');

  } catch (e) {
    el.innerHTML = `<div class="alert ab">Error: ${e.message}</div>`;
  }
}

// ── Pendientes compartidos ────────────────────────────
async function checkPend() {
  try {
    const rows = await sbGet(
      'movimientos',
      `es_compartido=eq.true&estado=eq.pendiente&user_id=neq.${CU.id}&select=*&order=created_at.desc`
    );
    const srv   = await sbGet('servicios', `estado=eq.pendiente&user_id=eq.${CU.id}&select=*`);
    const total = rows.length + srv.length;
    const badge = document.getElementById('nbadge');

    if (total > 0) {
      badge.textContent = total;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    if (!rows.length) {
      hide('pend-sec');
    } else {
      show('pend-sec');
      document.getElementById('pend-lista').innerHTML = rows.map(r => {
        const quien = r.user_id === AU.ignacio?.id ? 'Ignacio' : 'Abril';
        return `<div class="pcard">
          <div class="ptop">
            <div>
              <div class="pdesc">${r.descripcion || '—'}</div>
              <div class="pmeta">${r.fecha} · de ${quien}</div>
            </div>
            <span class="pbadge">Pendiente</span>
          </div>
          <div class="pparts">
            <div class="ppart"><div class="ppl">Total</div><div class="ppv" style="color:var(--tx);">${fmt(r.monto_total)}</div></div>
            <div class="ppart"><div class="ppl">Tu parte</div><div class="ppv" style="color:var(--ac2);">${fmt(r.parte_contraparte || r.mi_parte)}</div></div>
          </div>
          <div class="pacts">
            <button class="btn bg" style="flex:1;" onclick="confirmGasto('${r.id}')">✓ Confirmar</button>
            <button class="btn br" style="flex:1;" onclick="rechazarGasto('${r.id}')">✕ Rechazar</button>
          </div>
        </div>`;
      }).join('');
    }
  } catch { /* silencioso */ }
}

// ── Servicios vencidos / por vencer ─────────────────
async function checkSrvVcto() {
  try {
    const hoyStr = HOY.toISOString().split('T')[0];
    const srv    = await sbGet(
      'servicios',
      `user_id=eq.${CU.id}&estado=eq.pendiente&fecha_vencimiento=lte.${hoyStr}&select=*`
    );

    if (!srv.length) { hide('srv-pend-sec'); return; }

    show('srv-pend-sec');
    const el     = document.getElementById('srv-pend-lista');
    const ICONS2 = { luz: '⚡', agua: '💧', gas: '🔥', internet: '📡', expensas: '🏢' };

    el.innerHTML = srv.map(s => `<div class="srv-item">
      <div style="width:36px;height:36px;border-radius:9px;background:rgba(139,92,246,0.12);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">
        ${ICONS2[s.servicio] || '🔌'}
      </div>
      <div class="srv-info">
        <div class="srv-name">${s.servicio.charAt(0).toUpperCase() + s.servicio.slice(1)}</div>
        <div class="srv-meta">Vcto: ${new Date(s.fecha_vencimiento).toLocaleDateString('es-AR')}${s.es_compartido ? ' · Compartido' : ''}</div>
      </div>
      <div class="srv-right">
        <div class="srv-amt">${fmt(s.mi_parte)}</div>
        <button class="btn bs bsm" onclick="pagarServicio('${s.id}')"
          style="margin-top:4px;color:var(--gn);border-color:rgba(16,185,129,0.4);padding:4px 8px;">Pagar ✓</button>
      </div>
    </div>`).join('');
  } catch { /* silencioso */ }
}

async function pagarServicio(id) {
  try {
    await sbPatch('servicios', id, { estado: 'pagado', pagado_en: new Date().toISOString(), quien_pago: 'yo' });
    toast('Servicio marcado como pagado ✓');
    checkPend();
    checkSrvVcto();
    if (!document.getElementById('screen-dash').classList.contains('hidden')) loadDash();
  } catch {
    toast('Error', 'err');
  }
}

async function confirmGasto(id) {
  try {
    await sbPatch('movimientos', id, { estado: 'confirmado', confirmado_por: CU.id });
    toast('Gasto confirmado ✓');
    checkPend();
    if (!document.getElementById('screen-hist').classList.contains('hidden')) loadHist();
  } catch {
    toast('Error', 'err');
  }
}

async function rechazarGasto(id) {
  if (!confirm('¿Rechazás este gasto?')) return;
  try {
    await sbPatch('movimientos', id, { estado: 'rechazado' });
    toast('Rechazado');
    checkPend();
  } catch {
    toast('Error', 'err');
  }
}
