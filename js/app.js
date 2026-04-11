// ══════════════════════════════════════════════════════
//  app.js — Inicialización, navegación, realtime
// ══════════════════════════════════════════════════════

async function initApp() {
  hide('login-screen');
  show('app-wrap');

  // Cargar todos los usuarios en memoria (para proporciones)
  const us = await sbGet('usuarios', 'select=*');
  us.forEach(u => (AU[u.username] = u));

  // Actualizar UI de cabecera
  document.getElementById('reg-av').textContent    = CU.nombre[0].toUpperCase();
  document.getElementById('reg-uname').textContent = CU.nombre;
  document.getElementById('cfg-sub').textContent   = '@' + CU.username;
  document.getElementById('reg-fecha').textContent = FLAB;
  document.getElementById('dash-sub').textContent  = FLAB;

  // Prellenar fechas de hoy
  ['g-fecha', 'd-fecha', 'a-fecha', 'i-fecha'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.value = FISO;
  });

  await loadMedios();
  await loadMetas();
  await loadCfgIngresos();

  initRT();
  checkPend();
  checkSrvVcto();
  showScreen('reg');
  checkPushStatus();
}

// ── Navegación ─────────────────────────────────────────
const SCR = ['reg', 'hist', 'dash', 'config'];

function showScreen(n) {
  SCR.forEach(s => {
    document.getElementById('screen-' + s).classList.toggle('hidden', s !== n);
    document.getElementById('nav-'    + s).classList.toggle('active', s === n);
  });
  if (n === 'hist')   loadHist();
  if (n === 'dash')   loadDash();
  if (n === 'config') loadCfgScreen();
}

// ── Realtime WebSocket ─────────────────────────────────
function initRT() {
  try {
    const ws = new WebSocket(
      `wss://wwhjwowkxwvnthmpvkjm.supabase.co/realtime/v1/websocket?apikey=${KEY}&vsn=1.0.0`
    );
    WS = ws;

    ws.onopen = () =>
      ws.send(JSON.stringify({
        topic: 'realtime:public:movimientos',
        event: 'phx_join',
        payload: {},
        ref: '1'
      }));

    ws.onmessage = e => {
      try {
        const m = JSON.parse(e.data);
        if ((m.event === 'INSERT' || m.event === 'UPDATE') && m.payload?.record) {
          const r = m.payload.record;
          if (r.es_compartido && r.user_id !== CU.id) {
            checkPend();
            toast('⚡ Nuevo gasto compartido recibido', 'warn');
          }
        }
      } catch { /* ignorar errores de parseo */ }
    };

    ws.onclose = () => setTimeout(initRT, 5000);
    ws.onerror = ()  => {};
  } catch { /* ignorar si no hay conexión */ }
}

// ── Boot ───────────────────────────────────────────────
async function boot() {
  const ok = await restoreSession();
  if (ok) await initApp();
}

boot();
