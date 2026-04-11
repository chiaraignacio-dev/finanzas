// ══════════════════════════════════════════════════════
//  core.js — Estado global, Supabase, utilidades
// ══════════════════════════════════════════════════════

const SB  = 'https://wwhjwowkxwvnthmpvkjm.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3aGp3b3dreHd2bnRobXB2a2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjA1OTMsImV4cCI6MjA5MTMzNjU5M30.CTXqLIuc_Q9e4g1sijWIwYnlRo3daHAnDOq1TMDMh5Y';
const H   = {
  'apikey'       : KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type' : 'application/json',
  'Prefer'       : 'return=representation'
};

// ── Estado global ──────────────────────────────────────
let CU     = null;   // Current User
let AU     = {};     // All Users keyed by username
let UM     = [];     // User Medios de pago
let UMetas = [];     // User Metas
let EC     = 0;      // Extra-campos counter (add-medio form)
let WS     = null;   // WebSocket Realtime

// ── Constantes de fecha ────────────────────────────────
const HOY      = new Date();
const FISO     = HOY.toISOString().split('T')[0];
const FLAB     = HOY.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const MES_ACTUAL = (HOY.getMonth() + 1).toString().padStart(2, '0');
const DESDE_MES  = `${HOY.getFullYear()}-${MES_ACTUAL}-01`;

// ── Supabase helpers ───────────────────────────────────
async function sbGet(table, query = '') {
  const r = await fetch(`${SB}/rest/v1/${table}?${query}`, { headers: H });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbPost(table, data) {
  const r = await fetch(`${SB}/rest/v1/${table}`, {
    method: 'POST', headers: H, body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbPatch(table, id, data) {
  const r = await fetch(`${SB}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── Utilidades UI ──────────────────────────────────────
let _toastTimer;
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast t${type} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function show(id) { const e = document.getElementById(id); if (e) e.classList.remove('hidden'); }
function hide(id) { const e = document.getElementById(id); if (e) e.classList.add('hidden'); }
function tog(id, val) { const e = document.getElementById(id); if (e) e.classList.toggle('hidden', !val); }

function selR(name, val, el) {
  document.querySelectorAll(`[name="${name}"]`).forEach(r => r.closest('.ro')?.classList.remove('sel'));
  el?.classList.add('sel');
}

function fmt(n)  { return '$' + Math.round(n || 0).toLocaleString('es-AR'); }
function fmtK(n) {
  n = Math.round(n || 0);
  if (n >= 1_000_000) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1000) + 'k';
  return '$' + n;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h.toString(16);
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) hide('modal-overlay');
}
function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  show('modal-overlay');
}

// ── Proporciones hogar ─────────────────────────────────
function getProp() {
  const ui = AU.ignacio, ua = AU.abril;
  if (!ui || !ua) return 0.5435;
  const ii  = (ui.ingreso_fijo || 0) || ((ui.ingreso_q1 || 0) + (ui.ingreso_q2 || 0));
  const ia  = (ua.ingreso_fijo || 0) || ((ua.ingreso_q1 || 0) + (ua.ingreso_q2 || 0));
  const tot = ii + ia;
  if (!tot) return 0.5;
  const uc  = AU[CU.username];
  const mi  = (uc?.ingreso_fijo || 0) || ((uc?.ingreso_q1 || 0) + (uc?.ingreso_q2 || 0));
  return mi / tot;
}

function myIng() {
  const u = AU[CU?.username];
  if (!u) return 0;
  return (u.ingreso_fijo || 0) || ((u.ingreso_q1 || 0) + (u.ingreso_q2 || 0));
}

function partePorDiv(monto, div) {
  const p = getProp();
  if (div === 'personal' || div === 'novia') return monto;
  if (div === 'prop')  return monto * p;
  if (div === 'mitad') return monto * 0.5;
  return monto;
}
