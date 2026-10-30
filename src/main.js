import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BOTS, idleSeats } from './layout.js';
import { buildWorld } from './world.js';
import { createBot, placeAtSeat, seatFor, updateBot } from './bots.js';

const STALE_MS = 10 * 60 * 1000, QUIET_MS = 45 * 60 * 1000, POLL_MS = 4000;
const params = new URLSearchParams(location.search);

// ---------- renderer: native resolution, no post effects ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(window.devicePixelRatio || 1);   // never below the screen's own resolution
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
app.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a6c8e); scene.fog = new THREE.FogExp2(0x1a6c8e, 0.0032);
const camera = new THREE.PerspectiveCamera(32, 1, 1, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = 1.42; controls.minDistance = 12; controls.maxDistance = 150; controls.screenSpacePanning = true;
function homeView() {
  const a = innerWidth / innerHeight, portrait = a < 0.9, polar = portrait ? 0.55 : 0.74, t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dh = (portrait ? 40 : 60) / 2 / (t * a), dv = (28 * Math.cos(polar) + 6 * Math.sin(polar) + 3) / (2 * t);
  const d = Math.max(dh, dv), tgt = new THREE.Vector3(0, 1.2, portrait ? 0 : 1.5);
  controls.target.copy(tgt); camera.position.set(0, tgt.y + d * Math.cos(polar), tgt.z + d * Math.sin(polar)); controls.update();
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setPixelRatio(window.devicePixelRatio || 1); renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; camera.aspect = w / h; camera.updateProjectionMatrix(); }
resize(); homeView(); let rsT; addEventListener('resize', () => { resize(); clearTimeout(rsT); rsT = setTimeout(homeView, 200); });

const world = buildWorld(scene, renderer);

// ---------- bots ----------
const tagsEl = document.getElementById('tags'), bots = {};
const dotCol = { working: '#4ad07a', waiting: '#e8b24a', error: '#e5675a', done: '#5aa8ff', idle: '#7d8a94' };
BOTS.forEach((def, i) => {
  const b = createBot(def, scene); placeAtSeat(b, seatFor(def.slug, 'idle'), 'idle'); b.eff = { state: 'idle', line: '' };
  const el = document.createElement('div'); el.className = 'tag';
  el.innerHTML = `<span class="short"><span class="dot"></span>${def.short}</span><span class="full"><b>${def.name}</b><i class="meta"></i></span>`;
  el.addEventListener('click', e => { e.stopPropagation(); openTag(def.slug); });
  tagsEl.appendChild(el); b.tag = el; b.dotEl = el.querySelector('.dot'); b.metaEl = el.querySelector('.meta'); bots[def.slug] = b;
});
let openTimer; function openTag(slug) { Object.values(bots).forEach(b => b.tag.classList.remove('open')); bots[slug].tag.classList.add('open'); clearTimeout(openTimer); openTimer = setTimeout(() => bots[slug].tag.classList.remove('open'), 5000); }
// tap a bot in the scene
const ray = new THREE.Raycaster(), pt = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  pt.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(pt, camera);
  const hits = ray.intersectObjects(Object.values(bots).map(b => b.root), true);
  if (hits.length) { for (const [slug, b] of Object.entries(bots)) { let o = hits[0].object; while (o) { if (o === b.root) return openTag(slug); o = o.parent; } } }
});

// ---------- state: live feed + simulation ----------
let live = { bots: {}, usage: null, heartbeatAt: null }, skew = 0, feedFails = 0, lastOk = 0, simOn = false;
const sim = {}, simLog = [], realLog = [], seenUpdate = {}; let firstLoad = true;
const hhmm = ms => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
const API = import.meta.env.VITE_OFFICE_API || '';   // set for the hosted build; empty = local server with basic auth
let pw = API ? (sessionStorage.getItem('office-pw') || '') : '', pollTimer = null;
function showLogin(msg) {
  let box = document.getElementById('login');
  if (!box) {
    box = document.createElement('div'); box.id = 'login';
    box.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(10,45,65,.92);font-family:system-ui,sans-serif;color:#e8f4f8';
    box.innerHTML = '<form style="background:#0e3a52;padding:24px;border-radius:14px;width:min(320px,86vw);box-shadow:0 8px 30px #0008"><h3 style="margin:0 0 6px">Bot Office</h3><p id="loginmsg" style="margin:0 0 12px;font-size:14px;opacity:.85">Enter the office password</p><input id="loginpw" type="password" autocomplete="current-password" placeholder="Password" style="width:100%;box-sizing:border-box;padding:10px;font-size:16px;border-radius:8px;border:0;margin-bottom:10px"><button style="width:100%;padding:10px;font-size:16px;border:0;border-radius:8px;background:#2fb7d4;color:#04202e;font-weight:600">Enter</button></form>';
    document.body.appendChild(box);
    box.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const v = box.querySelector('#loginpw').value; if (!v) return; pw = v; box.style.display = 'none'; clearTimeout(pollTimer); poll(); });
  }
  box.querySelector('#loginmsg').textContent = msg || 'Enter the office password';
  box.querySelector('#loginpw').value = ''; box.style.display = 'flex'; setTimeout(() => box.querySelector('#loginpw').focus(), 50);
}
async function poll() {
  if (API && !pw) { showLogin(); return; }
  try {
    const r = API ? await fetch(API + '/state', { cache: 'no-store', headers: { 'x-office-password': pw } }) : await fetch('/api/state', { cache: 'no-store', credentials: 'same-origin' });
    if (API && r.status === 401) { pw = ''; sessionStorage.removeItem('office-pw'); showLogin('Wrong password, try again'); return; }
    if (!r.ok) throw new Error(r.status);
    if (API) sessionStorage.setItem('office-pw', pw);
    const j = await r.json(); skew = j.now - Date.now(); live = j; feedFails = 0; lastOk = Date.now();
    for (const def of BOTS) { const rec = j.bots[def.slug]; if (rec && seenUpdate[def.slug] !== rec.updatedAt) { seenUpdate[def.slug] = rec.updatedAt; if (!firstLoad || rec.state !== 'idle') if (rec.line || rec.state !== 'idle') realLog.push(`${hhmm(rec.updatedAt)} ${def.short}: ${rec.line || rec.state}`); } }
    if (realLog.length > 60) realLog.splice(0, realLog.length - 60);
    firstLoad = false;
  } catch (e) { feedFails++; }
  renderWarn();
  pollTimer = setTimeout(poll, POLL_MS);
}
function renderWarn() {
  const w = document.getElementById('warn'); let msg = '';
  if (feedFails >= 2) msg = 'Status feed unreachable — showing last known state';
  else if (live.heartbeatAt && (Date.now() + skew - live.heartbeatAt) > QUIET_MS) msg = 'Status feed has been quiet for 45+ minutes';
  w.textContent = msg; w.style.display = msg ? 'block' : 'none';
}
poll();

const SIM_LINES = { working: ['Started a task', 'Working through a task', 'Reached a milestone'], waiting: ['Waiting on Rick'], error: ['Hit an error'], done: ['Finished a task'] };
const pick = a => a[Math.floor(Math.random() * a.length)], rr = (a, b) => a + Math.random() * (b - a);
function simSet(slug, st, dur) { const line = st === 'idle' ? '' : pick(SIM_LINES[st]); sim[slug].rec = { state: st, line, updatedAt: Date.now() }; sim[slug].until = performance.now() / 1000 + dur; sim[slug].st = st; if (line) { simLog.push(`${hhmm(Date.now())} ${BOTS.find(b => b.slug === slug).short}: ${line}`); if (simLog.length > 60) simLog.shift(); } }
function simNext(slug) {
  const s = sim[slug];
  switch (s.st) {
    case 'idle': return simSet(slug, 'working', rr(10, 20));
    case 'working': if (s.phase === 0 && Math.random() < 0.3) { s.phase = 1; return simSet(slug, 'waiting', rr(3, 5)); } if (s.phase === 0 && Math.random() < 0.15) { s.phase = 1; return simSet(slug, 'error', 3); } s.phase = 0; return simSet(slug, 'done', 2.5);
    case 'waiting': case 'error': return simSet(slug, 'working', rr(5, 9));
    case 'done': return simSet(slug, 'idle', rr(4, 9));
  }
}
function startSim() {
  simOn = true; const now = performance.now() / 1000;
  BOTS.forEach((b, i) => { sim[b.slug] = { st: 'idle', until: now + 0.3 + i * 0.5 + rr(0, 1.5), phase: 0, rec: { state: 'idle', line: '', updatedAt: Date.now() } }; });
  syncSimUI();
}
function stopSim() { simOn = false; syncSimUI(); }
function syncSimUI() { document.getElementById('simlabel').style.display = simOn ? 'block' : 'none'; const b = document.getElementById('simbtn'); b.classList.toggle('on', simOn); b.textContent = simOn ? 'Stop Simulation' : 'Simulate Work'; }
document.getElementById('simbtn').addEventListener('click', () => (simOn ? stopSim() : startSim()));
if (params.get('simulate') === '1') startSim();

// ---------- panel ----------
const panel = document.getElementById('panel'), teamBtn = document.getElementById('teambtn');
teamBtn.addEventListener('click', () => { panel.classList.toggle('show'); teamBtn.setAttribute('aria-expanded', panel.classList.contains('show')); });
if (params.get('team') === '1') panel.classList.add('show');
function renderPanel(eff) {
  let html = '', cur = '';
  for (const b of BOTS) {
    if (b.dept !== cur) { cur = b.dept; html += `<h4>${cur}</h4>`; }
    const e = eff[b.slug];
    html += `<div class="row" data-slug="${b.slug}"><span class="sw" style="background:${b.color}"></span><span class="nm">${b.name}<small>${b.accessory}</small></span><span class="st ${e.state}">${e.state}</span><span class="ln">${e.line ? escapeHtml(e.line) : ''}</span></div>`;
  }
  panel.innerHTML = html;
}
panel.addEventListener('click', e => { const row = e.target.closest('.row'); if (row) openTag(row.dataset.slug); });
const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- main loop ----------
let lastT = performance.now(); let T = 0, lastSig = '', lastUsageSig = '', handoffSeen = {}, prevState = {};
const v = new THREE.Vector3(), chip = document.getElementById('usage-chip');
const fmtReset = ms => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(ms));
function frame() {
  requestAnimationFrame(frame);
  const nowP = performance.now(), dt = Math.min((nowP - lastT) / 1000, 0.25); lastT = nowP; T += dt; const now = Date.now() + skew;
  // simulation clock
  if (simOn) { const s = performance.now() / 1000; for (const b of BOTS) { const o = sim[b.slug]; if (s >= o.until) simNext(b.slug); } }
  const eff = {};
  for (const b of BOTS) {
    let rec = simOn ? sim[b.slug].rec : live.bots[b.slug];
    if (!rec) rec = { state: 'idle', line: '' };
    if (!simOn && rec.state === 'working' && now - rec.updatedAt > STALE_MS) rec = { state: 'idle', line: '', stale: true };
    eff[b.slug] = rec;
  }
  for (const b of BOTS) {
    const bot = bots[b.slug], e = eff[b.slug], was = prevState[b.slug];
    const justDone = e.state === 'done' && was && was !== 'done' && !(was === 'idle' && !simOn && false);
    prevState[b.slug] = e.state;
    bot.working = e.state === 'working'; bot.eff = e;
    const desired = (e.state === 'working' || e.state === 'error') ? 'desk' : 'idle';
    updateBot(bot, dt, desired, justDone);
    world.setBotLed(b.slug, e.state === 'working' || e.state === 'error' || e.state === 'waiting', e.state === 'error' ? 0xe5675a : e.state === 'waiting' ? 0xe8b24a : b.color);
    const m = bot.marker; m.visible = e.state === 'waiting' || e.state === 'error'; if (m.visible) { m.material.color.set(e.state === 'error' ? 0xe5675a : 0xe8b24a); m.position.set(bot.root.position.x, (bot.sitting ? 2.3 : 2.62) + 0.3, bot.root.position.z); m.rotation.y = T * 1.2; }
    // tag (pinned to the bot's root, never bobs)
    v.set(bot.root.position.x, bot.root.position.y + 2.5, bot.root.position.z).project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    bot.tag.style.display = vis ? '' : 'none';
    if (vis) bot.tag.style.transform = `translate(-50%,-100%) translate(${Math.round((v.x * 0.5 + 0.5) * innerWidth)}px, ${Math.round((-v.y * 0.5 + 0.5) * innerHeight)}px)`;
    bot.dotEl.style.background = dotCol[e.state] || dotCol.idle;
    if (bot.tag.matches(':hover') || bot.tag.classList.contains('open')) { const age = e.updatedAt ? Math.max(0, Math.round((now - e.updatedAt) / 60000)) : null; bot.metaEl.textContent = `${b.dept} · ${e.state}${e.line ? ' — ' + e.line : ''}${age != null && !simOn ? ` (${age}m ago)` : ''}`; }
  }
  const sig = BOTS.map(b => eff[b.slug].state + '|' + eff[b.slug].line).join(';') + simOn;
  if (sig !== lastSig) { lastSig = sig; renderPanel(eff); }
  // usage (real readings only)
  const u = live.usage, us = u ? u.percentLeft + '|' + u.resetsAt + '|' + u.updatedAt : 'none';
  if (us !== lastUsageSig) { lastUsageSig = us; world.setUsage(u); chip.innerHTML = u ? `<b>${Math.round(u.percentLeft)}%</b> usage left${u.resetsAt ? '<br>resets ' + fmtReset(u.resetsAt) : ''}` : 'No usage reading yet'; }
  world.setTerminal(simOn ? simLog.map(l => '[sim] ' + l) : realLog);
  world.update(T, dt);
  controls.update();
  renderer.render(scene, camera);
}
frame();
window.__office = { bots, camera, controls, startSim, stopSim, homeView };
