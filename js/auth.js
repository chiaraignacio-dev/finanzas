// ══════════════════════════════════════════════════════
//  auth.js — Login, sesión, logout
// ══════════════════════════════════════════════════════

async function doLogin() {
  const u   = document.getElementById('lu').value.trim().toLowerCase();
  const p   = document.getElementById('lp').value;
  if (!u || !p) { toast('Completá usuario y contraseña', 'err'); return; }

  const btn = document.getElementById('lbtn');
  btn.disabled  = true;
  btn.textContent = 'Ingresando…';

  try {
    const users = await sbGet('usuarios', `username=eq.${u}&select=*`);
    hide('lerr');

    if (!users.length) {
      toast('Usuario no encontrado', 'err');
      btn.disabled = false; btn.textContent = 'Ingresar';
      return;
    }

    const usr = users[0];
    const h   = hash(p);

    // Primera vez: guardar contraseña
    if (!usr.password_hash) {
      await sbPatch('usuarios', usr.id, { password_hash: h });
      usr.password_hash = h;
    }

    if (usr.password_hash !== h) {
      show('lerr');
      btn.disabled = false; btn.textContent = 'Ingresar';
      return;
    }

    CU = usr;
    localStorage.setItem('fin_s', JSON.stringify({ id: usr.id, username: usr.username }));
    await initApp();

  } catch (e) {
    toast('Error: ' + e.message, 'err');
    btn.disabled = false; btn.textContent = 'Ingresar';
  }
}

async function restoreSession() {
  const s = localStorage.getItem('fin_s');
  if (!s) return false;
  try {
    const j  = JSON.parse(s);
    const us = await sbGet('usuarios', `id=eq.${j.id}&select=*`);
    if (!us.length) return false;
    CU = us[0];
    return true;
  } catch {
    return false;
  }
}

function doLogout() {
  localStorage.removeItem('fin_s');
  CU = null;
  if (WS) { WS.close(); WS = null; }
  hide('app-wrap');
  show('login-screen');
  document.getElementById('lu').value = '';
  document.getElementById('lp').value = '';
}

async function changePass() {
  const p = document.getElementById('np1').value;
  const c = document.getElementById('np2').value;
  if (!p)        { toast('Ingresá contraseña', 'err');     return; }
  if (p !== c)   { toast('No coinciden', 'err');            return; }
  if (p.length < 4) { toast('Mínimo 4 caracteres', 'err'); return; }
  try {
    await sbPatch('usuarios', CU.id, { password_hash: hash(p) });
    toast('Contraseña actualizada ✓');
    document.getElementById('np1').value = '';
    document.getElementById('np2').value = '';
  } catch {
    toast('Error', 'err');
  }
}
