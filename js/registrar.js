// ══════════════════════════════════════════════════════
//  registrar.js — Tab Registrar: selección de tipo,
//                 cálculos de división y todos los
//                 handlers de submit.
// ══════════════════════════════════════════════════════

// ── Selección de tipo de movimiento ───────────────────
function selTipo(t, el) {
  document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  ['gasto', 'deuda', 'ahorro', 'ingreso', 'servicio', 'bbva'].forEach(x => hide('flujo-' + x));
  show('flujo-' + t);
  hide('exito-screen');
}

// ── Cálculo parte por división ────────────────────────
function calcParte() {
  const m   = parseFloat(document.getElementById('g-monto').value) || 0;
  const div = document.querySelector('[name="g-div"]:checked');
  if (!div || !m) { hide('g-parte-pill'); return; }
  document.getElementById('g-parte-val').textContent = fmt(partePorDiv(m, div.value));
  show('g-parte-pill');
}

function calcMetaPct() {
  const m   = parseFloat(document.getElementById('a-monto').value) || 0;
  const mid = document.getElementById('a-meta').value;
  const meta = UMetas.find(x => x.id === mid);
  if (!meta || !m) { hide('a-pct-pill'); return; }
  document.getElementById('a-pct-val').textContent =
    ((m / meta.monto_objetivo) * 100).toFixed(2) + '%';
  show('a-pct-pill');
}

// ── Reset formulario ───────────────────────────────────
function resetReg() {
  document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('sel'));
  ['gasto', 'deuda', 'ahorro', 'ingreso', 'servicio', 'bbva'].forEach(t => hide('flujo-' + t));
  hide('exito-screen');

  document.querySelectorAll('input[type=text], input[type=number], textarea')
    .forEach(e => (e.value = ''));
  document.querySelectorAll('select').forEach(e => {
    if (e.id !== 's-mes') e.selectedIndex = 0;
  });
  document.querySelectorAll('.ro').forEach(e => e.classList.remove('sel'));
  document.querySelectorAll('input[type=radio]').forEach(e => (e.checked = false));

  ['g-cuotas-wrap', 'g-cant-wrap', 'g-comp-info', 'g-parte-pill',
    'a-pct-pill', 'd-alerta', 'd-otra-wrap'].forEach(id => hide(id));

  ['g-fecha', 'd-fecha', 'a-fecha', 'i-fecha'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.value = FISO;
  });

  // Reset BBVA upload
  show('bbva-upload-step');
  hide('bbva-loading');
  hide('bbva-review-step');
  const fi = document.getElementById('bbva-file');
  if (fi) fi.value = '';
  bbvaItems = [];

  document.getElementById('screen-reg').scrollTo(0, 0);
}

// ── Pantalla de éxito ──────────────────────────────────
function mostrarExito(icon, title, sub, items) {
  ['flujo-gasto', 'flujo-deuda', 'flujo-ahorro',
    'flujo-ingreso', 'flujo-servicio', 'flujo-bbva'].forEach(f => hide(f));

  document.getElementById('ex-icon').textContent  = icon;
  document.getElementById('ex-title').textContent = title;
  document.getElementById('ex-sub').textContent   = sub;
  document.getElementById('ex-res').innerHTML      = items
    .map(([k, v]) =>
      `<div class="mi">
        <div class="minfo"><div class="mdesc">${k}</div></div>
        <div class="mamt neu">${v}</div>
      </div>`)
    .join('');

  hide('exito-screen');
  setTimeout(() => show('exito-screen'), 10);
  document.getElementById('screen-reg').scrollTo(0, 0);
}

// ══ SUBMIT: Gasto ══════════════════════════════════════
async function submitGasto() {
  const fecha  = document.getElementById('g-fecha').value || FISO;
  const desc   = document.getElementById('g-desc').value.trim();
  const cat    = document.getElementById('g-cat').value;
  const mid    = document.getElementById('g-medio').value;
  const monto  = parseFloat(document.getElementById('g-monto').value) || 0;
  const div    = document.querySelector('[name="g-div"]:checked');
  const cuotas = document.querySelector('[name="g-cuotas"]:checked');
  const cant   = document.getElementById('g-cant').value;
  const notas  = document.getElementById('g-notas').value;

  if (!desc || !cat || !mid || !monto || !div) {
    toast('Completá los campos obligatorios', 'err');
    return;
  }

  const esComp   = ['prop', 'mitad'].includes(div.value);
  const mi_parte = partePorDiv(monto, div.value);
  const medio    = UM.find(m => m.id === mid);

  try {
    await sbPost('movimientos', {
      fecha,
      tipo           : 'gasto',
      descripcion    : desc,
      categoria      : cat,
      medio_pago     : medio?.nombre || mid,
      division       : div.value,
      tipo_division  : div.value,
      monto_total    : monto,
      mi_parte       : Math.round(mi_parte),
      parte_usuario  : Math.round(mi_parte),
      parte_contraparte: Math.round(monto - mi_parte),
      es_deuda       : false,
      es_ahorro      : false,
      en_cuotas      : cuotas?.value === 'si',
      cant_cuotas    : cant ? parseInt(cant) : null,
      notas,
      user_id        : CU.id,
      es_compartido  : esComp,
      estado         : esComp ? 'pendiente' : 'confirmado'
    });

    toast(esComp ? '⚡ Enviado a tu pareja' : 'Gasto guardado ✓');
    mostrarExito(
      esComp ? '⚡' : '✅',
      esComp ? '¡Enviado a tu pareja!' : '¡Gasto guardado!',
      esComp ? 'Tu pareja debe confirmarlo.' : '',
      [['Descripción', desc], ['Monto total', fmt(monto)], ['Tu parte', fmt(mi_parte)]]
    );
    if (esComp) checkPend();
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

// ══ SUBMIT: Deuda ══════════════════════════════════════
async function submitDeuda() {
  const fecha = document.getElementById('d-fecha').value || FISO;
  const cual  = document.querySelector('[name="d-cual"]:checked');
  const monto = parseFloat(document.getElementById('d-monto').value) || 0;
  const tipo  = document.querySelector('[name="d-tipo"]:checked');
  const notas = document.getElementById('d-notas').value;

  if (!cual || !monto) { toast('Completá los campos obligatorios', 'err'); return; }

  const lab = cual.value === 'otra'
    ? document.getElementById('d-otra').value
    : cual.value.toUpperCase();

  try {
    await sbPost('movimientos', {
      fecha,
      tipo           : 'deuda',
      descripcion    : 'Pago deuda: ' + lab,
      categoria      : 'Deuda',
      medio_pago     : cual.value,
      division       : 'personal',
      tipo_division  : 'personal',
      monto_total    : monto,
      mi_parte       : monto,
      es_deuda       : true,
      es_ahorro      : false,
      en_cuotas      : false,
      notas          : (tipo?.value || '') + (notas ? ' · ' + notas : ''),
      user_id        : CU.id,
      es_compartido  : false,
      estado         : 'confirmado'
    });
    toast('Pago guardado ✓');
    mostrarExito('💳', '¡Pago registrado!', '', [['Deuda', lab], ['Monto', fmt(monto)]]);
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

// ══ SUBMIT: Ahorro ════════════════════════════════════
async function submitAhorro() {
  const mid   = document.getElementById('a-meta').value;
  const fecha = document.getElementById('a-fecha').value || FISO;
  const monto = parseFloat(document.getElementById('a-monto').value) || 0;
  const dest  = document.querySelector('[name="a-dest"]:checked');
  const notas = document.getElementById('a-notas').value;
  const meta  = UMetas.find(m => m.id === mid);

  if (!mid || !monto) { toast('Elegí una meta y completá el monto', 'err'); return; }

  try {
    await sbPost('movimientos', {
      fecha,
      tipo          : 'ahorro',
      descripcion   : 'Ahorro: ' + (meta?.nombre || '—'),
      categoria     : 'Ahorro',
      medio_pago    : dest?.value || '—',
      division      : 'personal',
      tipo_division : 'personal',
      monto_total   : monto,
      mi_parte      : monto,
      es_deuda      : false,
      es_ahorro     : true,
      en_cuotas     : false,
      notas         : notas || meta?.nombre,
      user_id       : CU.id,
      es_compartido : false,
      estado        : 'confirmado'
    });

    if (meta) await sbPatch('metas', mid, { monto_actual: (meta.monto_actual || 0) + monto });
    await loadMetas();

    const pct = meta ? ((monto / meta.monto_objetivo) * 100).toFixed(2) + '%' : '—';
    toast('Ahorro guardado ✓');
    mostrarExito(
      '🎯', '¡Ahorro guardado!',
      `Aportaste ${pct} a "${meta?.nombre || ''}"`,
      [['Meta', meta?.nombre || '—'], ['Monto', fmt(monto)]]
    );
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

// ══ SUBMIT: Ingreso ═══════════════════════════════════
async function submitIngreso() {
  const fecha = document.getElementById('i-fecha').value || FISO;
  const desc  = document.getElementById('i-desc').value.trim();
  const monto = parseFloat(document.getElementById('i-monto').value) || 0;
  const notas = document.getElementById('i-notas').value;

  if (!desc || !monto) { toast('Completá descripción y monto', 'err'); return; }

  try {
    await sbPost('movimientos', {
      fecha,
      tipo          : 'ingreso',
      descripcion   : 'INGRESO: ' + desc,
      categoria     : 'Ingreso extra',
      medio_pago    : 'transferencia',
      division      : 'personal',
      tipo_division : 'personal',
      monto_total   : monto,
      mi_parte      : monto,
      es_deuda      : false,
      es_ahorro     : false,
      en_cuotas     : false,
      notas,
      user_id       : CU.id,
      es_compartido : false,
      estado        : 'confirmado'
    });
    toast('Ingreso guardado ✓');
    mostrarExito('💰', '¡Ingreso guardado!', '', [['Descripción', desc], ['Monto', fmt(monto)]]);
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

// ══ SUBMIT: Servicio ══════════════════════════════════
async function submitServicio() {
  const tipo  = document.querySelector('[name="s-tipo"]:checked');
  const monto = parseFloat(document.getElementById('s-monto').value) || 0;
  const vcto  = document.getElementById('s-vcto').value;
  const cons  = document.getElementById('s-consumo').value;
  const comp  = document.querySelector('[name="s-comp"]:checked')?.value === 'si';
  const notas = document.getElementById('s-notas').value;

  if (!tipo || !monto || !vcto) {
    toast('Completá tipo, importe y vencimiento', 'err');
    return;
  }

  const mi_parte = Math.round(comp ? monto * getProp() : monto);

  try {
    await sbPost('servicios', {
      mes             : new Date(vcto).toLocaleString('es-AR', { month: 'long' }),
      anio            : new Date(vcto).getFullYear(),
      servicio        : tipo.value,
      monto_total     : monto,
      consumo         : cons || null,
      quien_pago      : 'pendiente',
      mi_parte,
      notas,
      user_id         : CU.id,
      estado          : 'pendiente',
      fecha_vencimiento: vcto,
      es_compartido   : comp
    });

    schedulePushForService(tipo.value, monto, vcto);
    toast('Servicio registrado ✓');
    mostrarExito(
      '🔌', '¡Servicio registrado!',
      'Recibirás una notificación el día del vencimiento.',
      [
        ['Servicio',    tipo.value],
        ['Importe',     fmt(monto)],
        ['Vencimiento', new Date(vcto).toLocaleDateString('es-AR')],
        ['Tu parte',    fmt(mi_parte)]
      ]
    );
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}
