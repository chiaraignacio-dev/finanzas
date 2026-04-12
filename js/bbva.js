// ══════════════════════════════════════════════════════
//  bbva.js — Importación de resumen PDF BBVA con Claude
// ══════════════════════════════════════════════════════

let bbvaItems = [];

const DIVLABELS = { personal: 'Solo mío', prop: 'Proporcional', mitad: '50/50', novia: 'Es de mi novia' };
const CATS = [
  'Alquiler', 'Supermercado', 'Transporte', 'Servicios', 'Internet/Cable',
  'Expensas', 'Delivery', 'Salidas/Ocio', 'Ropa y calzado', 'Tecnología',
  'Gym', 'Salud', 'Educación', 'Regalo', 'Suscripciones', 'Viajes', 'Otro'
];

// ── Procesar PDF con Claude API ─────────────────────────
async function procesarBBVA() {
  const file = document.getElementById('bbva-file').files[0];
  if (!file) { toast('Seleccioná un archivo PDF', 'err'); return; }

  hide('bbva-upload-step');
  show('bbva-loading');

  try {
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

    const prompt = `Sos un asistente financiero. Analizá este resumen de tarjeta Visa BBVA de Argentina y extraé SOLO los consumos propios (no intereses, no punitorios, no impuestos, no Plan V consolidado).

Para cada consumo extraé:
- fecha (formato YYYY-MM-DD)
- descripcion (nombre del comercio limpio)
- monto_pesos (número sin signos, 0 si es solo en dolares)
- monto_dolares (número sin signos, 0 si no aplica)
- es_cuota (true si dice C.XX/XX en la descripción)
- cuota_actual y cuota_total (números si es_cuota es true)
- categoria_sugerida: uno de estos exactos: Delivery, Suscripciones, Supermercado, Salidas/Ocio, Tecnología, Ropa y calzado, Salud, Transporte, Educación, Regalo, Servicios, Otro
- division_sugerida: uno de estos: personal, prop, mitad, novia — basate en el comercio (Spotify/Netflix=personal, Pedidos Ya/Rappi=personal, MERPAGO con nombre de persona=novia)
- es_ambiguo: true si no podés determinar claramente la categoría o división

También extraé:
- periodo: el período del resumen (ej: "Marzo 2026")
- saldo_total: el saldo total en pesos
- total_intereses: suma de intereses + punitorios + impuestos
- fecha_vencimiento: fecha límite de pago del resumen (formato YYYY-MM-DD)

Respondé SOLO con JSON válido sin markdown, con esta estructura:
{"periodo":"...","saldo_total":0,"total_intereses":0,"fecha_vencimiento":"...","consumos":[{"fecha":"...","descripcion":"...","monto_pesos":0,"monto_dolares":0,"es_cuota":false,"cuota_actual":0,"cuota_total":0,"categoria_sugerida":"...","division_sugerida":"...","es_ambiguo":false}]}`;

    const GEMINI_KEY = 'AIzaSyCbpl-hez5GF5NSAEIQSQ4FOd2FeM3Ody8';

    const resp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: base64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192
          }
        })
      }
    );

    if (!resp.ok) {
      const err = await resp.json();
      console.error('Gemini error:', err);
      hide('bbva-loading');
      show('bbva-upload-step');
      toast('Error al procesar el PDF: ' + (err.error?.message || 'intentá de nuevo'), 'err');
      return;
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      hide('bbva-loading');
      show('bbva-upload-step');
      toast('Gemini no devolvió respuesta. Intentá de nuevo.', 'err');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      parsed = null;
    }

    if (!parsed || !parsed.consumos) {
      hide('bbva-loading');
      show('bbva-upload-step');
      toast('No se pudo interpretar el resumen. Intentá de nuevo.', 'err');
      return;
    }

    mostrarRevisionBBVA(parsed);

  } catch (e) {
    console.error(e);
    hide('bbva-loading');
    show('bbva-upload-step');
    toast('Error inesperado al procesar el PDF.', 'err');
  }
}

// ── Mostrar revisión de consumos ──────────────────────
function mostrarRevisionBBVA(data) {
  window._bbvaVcto = data.fecha_vencimiento || null;
  bbvaItems = data.consumos.map((c, i) => ({
    ...c,
    idx            : i,
    divSeleccionada: c.division_sugerida,
    catSeleccionada: c.categoria_sugerida,
    guardado       : false
  }));

  hide('bbva-loading');
  document.getElementById('bbva-titulo').textContent      = 'Resumen ' + data.periodo;
  document.getElementById('bbva-resumen-sub').textContent = bbvaItems.length + ' consumos encontrados';
  document.getElementById('bbva-total').textContent       = fmt(data.saldo_total);
  document.getElementById('bbva-intereses-info').textContent =
    `⚠️ Intereses y cargos: ${fmt(data.total_intereses)} — no se cargan como gastos pero forman parte del total que debés pagar.`;

  renderBBVAItems();
  show('bbva-review-step');
}

// ── Render lista de items ─────────────────────────────
function renderBBVAItems() {
  const lista = document.getElementById('bbva-items-lista');
  lista.innerHTML = bbvaItems.map(item => {
    if (item.es_cuota) {
      return `<div class="import-item done" style="opacity:0.45;">
        <div class="import-item-top">
          <div>
            <div class="import-desc">${item.descripcion}</div>
            <div class="import-meta">${item.fecha} · Cuota ${item.cuota_actual}/${item.cuota_total}</div>
          </div>
          <div class="import-amt">${item.monto_pesos ? fmt(item.monto_pesos) : ('U$S ' + item.monto_dolares)}</div>
        </div>
        <div style="font-size:11px;color:var(--gn);">✓ Es una compra en cuotas — ya registrada en Cuotas, no se duplica</div>
      </div>`;
    }

    const guardadoCls = item.guardado ? 'done' : '';
    const catOpts     = CATS
      .map(c => `<option value="${c}" ${c === item.catSeleccionada ? 'selected' : ''}>${c}</option>`)
      .join('');

    return `<div class="import-item ${guardadoCls}" id="bbva-item-${item.idx}">
      <div class="import-item-top">
        <div>
          <div class="import-desc">${item.descripcion}</div>
          <div class="import-meta">${item.fecha}${item.es_ambiguo
            ? ' · <span style="color:var(--am);">⚠️ Clasificar</span>'
            : ' · <span style="color:var(--gn);">✓ Auto</span>'}</div>
        </div>
        <div class="import-amt">${item.monto_pesos ? fmt(item.monto_pesos) : ('U$S ' + item.monto_dolares)}</div>
      </div>
      <div style="margin-bottom:8px;">
        <label style="font-size:10px;color:var(--tx3);text-transform:uppercase;display:block;margin-bottom:4px;">Categoría</label>
        <select onchange="bbvaSetCat(${item.idx},this.value)"
                style="width:100%;padding:7px 10px;background:var(--sf2);border:1px solid var(--bd2);border-radius:var(--rs);color:var(--tx);font-size:13px;">
          ${catOpts}
        </select>
      </div>
      <div class="div-btns">
        <button class="div-btn ${item.divSeleccionada === 'personal' ? 'sel' : ''}" onclick="bbvaSetDiv(${item.idx},'personal',this)">Solo mío</button>
        <button class="div-btn ${item.divSeleccionada === 'prop'     ? 'sel' : ''}" onclick="bbvaSetDiv(${item.idx},'prop',this)">Proporcional</button>
        <button class="div-btn ${item.divSeleccionada === 'mitad'    ? 'sel' : ''}" onclick="bbvaSetDiv(${item.idx},'mitad',this)">50/50</button>
        <button class="div-btn ${item.divSeleccionada === 'novia'    ? 'sel' : ''}" onclick="bbvaSetDiv(${item.idx},'novia',this)">De mi novia</button>
      </div>
      ${item.guardado ? '<div style="font-size:11px;color:var(--gn);margin-top:6px;">✓ Guardado</div>' : ''}
    </div>`;
  }).join('');
}

function bbvaSetCat(idx, cat) { bbvaItems[idx].catSeleccionada = cat; }

function bbvaSetDiv(idx, div, el) {
  bbvaItems[idx].divSeleccionada = div;
  const item = document.getElementById('bbva-item-' + idx);
  item.querySelectorAll('.div-btn').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
}

// ── Guardar todos los clasificados ───────────────────
async function guardarBBVA() {
  const vcto = window._bbvaVcto;
  if (!vcto) { toast('No se encontró fecha de vencimiento en el resumen', 'err'); return; }

  const toSave = bbvaItems.filter(i => !i.es_cuota && !i.guardado);
  if (!toSave.length) { toast('Todos los consumos ya fueron guardados', 'warn'); return; }

  let saved = 0;
  const medio = UM.find(m => m.nombre.toLowerCase().includes('bbva')) || UM[0];

  for (const item of toSave) {
    const esComp   = ['prop', 'mitad'].includes(item.divSeleccionada);
    const monto    = item.monto_pesos || (item.monto_dolares * 1420);
    const mi_parte = Math.round(partePorDiv(monto, item.divSeleccionada));

    try {
      await sbPost('movimientos', {
        fecha             : item.fecha,
        tipo              : 'gasto',
        descripcion       : item.descripcion,
        categoria         : item.catSeleccionada,
        medio_pago        : medio?.nombre || 'Visa BBVA',
        division          : item.divSeleccionada,
        tipo_division     : item.divSeleccionada,
        monto_total       : monto,
        mi_parte,
        parte_usuario     : mi_parte,
        parte_contraparte : Math.round(monto - mi_parte),
        es_deuda          : false,
        es_ahorro         : false,
        en_cuotas         : false,
        notas             : 'Importado de resumen BBVA',
        user_id           : CU.id,
        es_compartido     : esComp,
        estado            : esComp ? 'pendiente' : 'confirmado'
      });
      bbvaItems[item.idx].guardado = true;
      saved++;
    } catch (e) {
      console.error(e);
    }
  }

  renderBBVAItems();
  toast(saved + ' consumos guardados ✓');

  if (saved > 0) {
    mostrarExito(
      '📄', '¡Resumen importado!',
      `${saved} consumos guardados desde el resumen BBVA.`,
      [
        ['Consumos importados',    String(saved)],
        ['Pendientes de pareja',   String(toSave.filter(i => ['prop', 'mitad'].includes(i.divSeleccionada)).length)]
      ]
    );
  }
}
