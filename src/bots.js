import * as THREE from 'three';
import { BOTS, desks, idleSeats, LEAD_DELIVERY, findPath } from './layout.js';

const M = (c) => new THREE.MeshLambertMaterial({ color: c });
const box = (w, h, d, mat, x = 0, y = 0, z = 0, p) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); p && p.add(m); return m; };
const cyl = (r1, r2, h, mat, seg = 12, p) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); p && p.add(m); return m; };
const neutral = { white: M(0xd9d6cc), dark: M(0x23292f), gray: M(0x7d868d), gold: M(0xc9a23a), red: M(0xc0453a), green: M(0x4aa05a), wood: M(0x9a7448), yellow: M(0xe0a820), black: M(0x15191d) };

function accessory(kind, parent) {
  const n = neutral, g = new THREE.Group(); parent.add(g);
  switch (kind) {
    case 'clipboard': { g.position.set(0.52, 1.1, 0.28); box(0.34, 0.46, 0.04, n.wood, 0, 0, 0, g); box(0.26, 0.36, 0.05, n.white, 0, -0.02, 0.01, g); box(0.12, 0.06, 0.06, n.gray, 0, 0.2, 0.02, g); break; }
    case 'calculator': { g.position.set(-0.52, 1.1, 0.3); box(0.3, 0.42, 0.06, n.dark, 0, 0, 0, g); box(0.22, 0.1, 0.07, n.green, 0, 0.13, 0.01, g); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) box(0.055, 0.055, 0.07, n.gray, -0.08 + i * 0.08, 0.0 - j * 0.08, 0.01, g); break; }
    case 'stethoscope': { g.position.set(0, 1.5, 0.05); const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 16, Math.PI * 1.3), n.dark); t.rotation.set(0.2, 0, Math.PI * 0.85); t.position.set(0, -0.1, 0.12); g.add(t); const d = cyl(0.07, 0.07, 0.04, n.gray, 10, g); d.rotation.x = Math.PI / 2; d.position.set(0.12, -0.5, 0.24); break; }
    case 'briefcase': { g.position.set(0.58, 0.78, 0.15); box(0.14, 0.42, 0.56, M(0x5a3a22), 0, 0, 0, g); box(0.16, 0.05, 0.2, n.gold, 0, 0.1, 0, g); box(0.1, 0.06, 0.2, n.dark, 0, 0.24, 0, g); break; }
    case 'whistle': { g.position.set(0, 1.45, 0.22); box(0.04, 0.3, 0.02, n.dark, 0, 0.08, 0, g); box(0.2, 0.1, 0.08, n.gray, 0, -0.08, 0, g); const c = cyl(0.06, 0.06, 0.08, n.gray, 8, g); c.rotation.z = Math.PI / 2; c.position.set(0.1, -0.08, 0); break; }
    case 'map pin': { g.position.set(0, 1.3, 0.24); const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), n.red); s.position.y = 0.12; g.add(s); const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 8), n.red); c.rotation.x = Math.PI; c.position.y = -0.08; g.add(c); box(0.06, 0.06, 0.02, n.white, 0, 0.12, 0.12, g); break; }
    case 'chef hat': { g.position.set(0, 2.1, 0); cyl(0.26, 0.28, 0.2, n.white, 12, g).position.y = 0; for (const [x, z] of [[-0.14, -0.1], [0.14, -0.1], [0, 0.12], [0, -0.14]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), n.white); s.position.set(x, 0.24, z); g.add(s); } break; }
    case 'ticker': { g.position.set(0.5, 1.15, 0.3); box(0.42, 0.26, 0.05, n.dark, 0, 0, 0, g); box(0.32, 0.03, 0.06, n.green, 0, 0.05, 0.01, g); box(0.2, 0.03, 0.06, n.red, -0.06, -0.02, 0.01, g); box(0.28, 0.03, 0.06, n.gold, 0, -0.08, 0.01, g); break; }
    case 'stopwatch': { g.position.set(0, 1.3, 0.24); const c = cyl(0.14, 0.14, 0.06, n.gold, 14, g); c.rotation.x = Math.PI / 2; box(0.05, 0.08, 0.05, n.gold, 0, 0.17, 0, g); box(0.02, 0.1, 0.02, n.dark, 0, 0.02, 0.04, g); break; }
    case 'shield': { g.position.set(-0.56, 1.1, 0.2); box(0.08, 0.5, 0.4, n.gray, 0, 0.04, 0, g); const t = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 4), n.gray); t.rotation.set(Math.PI, Math.PI / 4, 0); t.scale.set(1, 1, 1); t.position.y = -0.3; g.add(t); box(0.1, 0.3, 0.1, n.gold, 0.03, 0.05, 0, g); break; }
    case 'apple': { g.position.set(0.55, 0.95, 0.3); const s = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), n.red); g.add(s); box(0.03, 0.1, 0.03, n.wood, 0, 0.18, 0, g); box(0.1, 0.02, 0.05, n.green, 0.06, 0.2, 0, g); break; }
    case 'hard hat': { g.position.set(0, 2.08, 0); const d = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 8, 0, 6.28, 0, Math.PI / 2), n.yellow); g.add(d); box(0.7, 0.04, 0.5, n.yellow, 0, 0, 0.12, g); box(0.1, 0.06, 0.5, n.yellow, 0, 0.3, 0, g); break; }
    case 'camera': { g.position.set(0.5, 1.15, 0.3); box(0.34, 0.24, 0.2, n.dark, 0, 0, 0, g); const l = cyl(0.08, 0.1, 0.14, n.gray, 10, g); l.rotation.x = Math.PI / 2; l.position.z = 0.15; box(0.1, 0.06, 0.08, n.red, 0.1, 0.15, 0, g); break; }
    case 'sunglasses': { g.position.set(0, 1.86, 0.27); box(0.1, 0.05, 0.03, n.black, 0, 0, 0, g); box(0.2, 0.12, 0.03, n.black, -0.14, 0, 0, g); box(0.2, 0.12, 0.03, n.black, 0.14, 0, 0, g); break; }
    case 'mug': { g.position.set(0.58, 0.95, 0.32); const c = cyl(0.11, 0.1, 0.2, n.white, 12, g); const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 10), n.white); h.position.x = 0.12; g.add(h); cyl(0.095, 0.095, 0.02, M(0x4a2a1a), 10, g).position.y = 0.09; break; }
  }
  return g;
}

export function createBot(def, scene) {
  const col = M(def.color);
  const root = new THREE.Group(); scene.add(root);
  const body = new THREE.Group(); root.add(body);
  box(0.74, 0.8, 0.42, col, 0, 1.18, 0, body);
  const head = box(0.52, 0.52, 0.5, col, 0, 1.84, 0, body);
  box(0.09, 0.09, 0.03, neutral.black, -0.12, 1.88, 0.26, body); box(0.09, 0.09, 0.03, neutral.black, 0.12, 1.88, 0.26, body);
  const mkLeg = x => { const hip = new THREE.Group(); hip.position.set(x, 0.78, 0); body.add(hip); box(0.3, 0.4, 0.32, col, 0, -0.2, 0, hip); const knee = new THREE.Group(); knee.position.y = -0.4; hip.add(knee); box(0.28, 0.38, 0.3, col, 0, -0.19, 0, knee); box(0.3, 0.1, 0.4, M(0x20262c), 0, -0.4, 0.05, knee); return { hip, knee }; };
  const legs = [mkLeg(-0.2), mkLeg(0.2)];
  const mkArm = x => { const sh = new THREE.Group(); sh.position.set(x, 1.52, 0); body.add(sh); box(0.22, 0.7, 0.24, col, 0, -0.32, 0, sh); return sh; };
  const arms = [mkArm(-0.48), mkArm(0.48)];
  accessory(def.accessory, def.accessory === 'chef hat' || def.accessory === 'hard hat' || def.accessory === 'sunglasses' ? body : body);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.05; root.add(shadow);
  // carried handoff folder
  const folder = new THREE.Group(); box(0.4, 0.04, 0.5, M(0xd8cfa8), 0, 0, 0, folder); box(0.32, 0.05, 0.4, M(0xb8aa7a), 0, 0.02, 0, folder); folder.position.set(0, 1.15, 0.5); folder.visible = false; body.add(folder);
  // waiting / error marker (static, no bob)
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.17), new THREE.MeshBasicMaterial({ color: 0xe8b24a })); marker.position.y = 2.65; marker.visible = false; scene.add(marker);
  return { def, root, body, legs, arms, folder, marker, shadow, head, sitting: false, phase: 0, path: null, pi: 0, pause: 0, target: null, place: null, handoff: false, handoffStage: 0, heading: 0, seatRef: null, hp: new THREE.Vector3() };
}

const idleSeatFor = {}; BOTS.forEach((b, i) => { idleSeatFor[b.slug] = idleSeats[i % idleSeats.length]; });
const deskSeat = slug => ({ ...desks[slug].seat, approach: desks[slug].approach, kind: 'desk' });
export const seatFor = (slug, kind) => (kind === 'desk' ? deskSeat(slug) : idleSeatFor[slug]);

export function placeAtSeat(bot, seat, kind) {
  bot.root.position.set(seat.x, 0, seat.z); bot.heading = seat.h; bot.root.rotation.y = seat.h; bot.sitting = true; bot.place = kind; bot.target = kind; bot.seatRef = seat; bot.path = null;
}
function route(bot, tKind) {
  const slug = bot.def.slug, seat = seatFor(slug, tKind), p = bot.root.position;
  const from = bot.sitting && bot.seatRef ? bot.seatRef.approach : { x: p.x, z: p.z };
  const pts = [];
  if (bot.sitting && bot.seatRef) pts.push({ x: p.x, z: p.z });
  pts.push(...findPath(from, seat.approach));
  pts.push({ x: seat.x, z: seat.z });
  bot.path = pts; bot.pi = 1; bot.target = tKind; bot.finalSeat = seat; bot.sitting = false; bot.place = 'transit'; bot.pause = 0;
}
function routeToLead(bot) {
  const p = bot.root.position, from = bot.sitting && bot.seatRef ? bot.seatRef.approach : { x: p.x, z: p.z };
  const pts = []; if (bot.sitting && bot.seatRef) pts.push({ x: p.x, z: p.z });
  pts.push(...findPath(from, LEAD_DELIVERY)); bot.path = pts; bot.pi = 1; bot.finalSeat = null; bot.sitting = false; bot.place = 'transit'; bot.handoffStage = 1; bot.folder.visible = true;
}
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * Math.min(1, t); };
const SPEED = 3.7;

// desired: 'desk' | 'idle'; call every frame
export function updateBot(bot, dt, desired, wantHandoff) {
  const r = bot.root;
  if (wantHandoff && !bot.handoff && bot.def.slug !== 'chief-of-staff') bot.handoff = true;
  if (bot.pause > 0) { bot.pause -= dt; bot.phase += 0; if (bot.pause <= 0 && bot.handoffStage === 2) { bot.folder.visible = false; bot.handoffStage = 0; bot.handoff = false; bot.place = 'transit'; } else { pose(bot, 'stand', dt); return; } }
  if (!bot.path) {
    if (bot.handoff && bot.handoffStage === 0) routeToLead(bot);
    else if (bot.place !== desired) route(bot, desired);
  } else if (bot.handoffStage === 0 && bot.target !== desired && bot.place === 'transit') route(bot, desired);
  if (bot.path) {
    const tgt = bot.path[bot.pi]; const dx = tgt.x - r.position.x, dz = tgt.z - r.position.z, d = Math.hypot(dx, dz);
    const step = SPEED * dt;
    if (d <= step) { r.position.x = tgt.x; r.position.z = tgt.z; bot.pi++; if (bot.pi >= bot.path.length) { bot.path = null; arrive(bot); } }
    else { r.position.x += dx / d * step; r.position.z += dz / d * step; bot.heading = Math.atan2(dx, dz); bot.phase += dt * 9; }
    r.rotation.y = lerpAngle(r.rotation.y, bot.heading, dt * 12);
    pose(bot, bot.path ? 'walk' : (bot.sitting ? 'sit' : 'stand'), dt);
  } else pose(bot, bot.sitting ? 'sit' : 'stand', dt);
}
function arrive(bot) {
  if (bot.handoffStage === 1) { bot.handoffStage = 2; bot.pause = 1.6; bot.heading = Math.PI * -0.5 + 0.6; bot.root.rotation.y = -Math.PI; return; }
  const s = bot.finalSeat; if (s) { bot.root.position.set(s.x, 0, s.z); bot.heading = s.h; bot.root.rotation.y = s.h; bot.sitting = true; bot.place = bot.target; bot.seatRef = s; }
}
function pose(bot, mode, dt) {
  const [L, R] = bot.legs, [AL, AR] = bot.arms, sw = Math.sin(bot.phase);
  if (mode === 'walk') {
    L.hip.rotation.x = sw * 0.7; R.hip.rotation.x = -sw * 0.7; L.knee.rotation.x = Math.max(0, -sw) * 0.7; R.knee.rotation.x = Math.max(0, sw) * 0.7;
    AL.rotation.x = -sw * 0.6; AR.rotation.x = sw * 0.6; if (bot.folder.visible) { AL.rotation.x = -1.2; AR.rotation.x = -1.2; }
    bot.body.position.y = Math.abs(sw) * 0.05; bot.root.position.y = 0;
  } else if (mode === 'sit') {
    L.hip.rotation.x = R.hip.rotation.x = -Math.PI / 2; L.knee.rotation.x = R.knee.rotation.x = Math.PI / 2;
    bot.body.position.y = 0; bot.root.position.y = ({ sofa: 0.68, stool: 0.62, chair: 0.56, desk: 0.56 }[bot.seatRef && bot.seatRef.kind] ?? 0.56) - 0.78;
    if (bot.place === 'desk' && bot.working) { const k = performance.now() / 1000; AL.rotation.x = -1.25 + Math.sin(k * 9) * 0.08; AR.rotation.x = -1.25 + Math.sin(k * 9 + 2) * 0.08; }
    else { AL.rotation.x = AR.rotation.x = bot.place === 'desk' ? -0.9 : -0.35; }
  } else { // stand (no bob)
    L.hip.rotation.x = R.hip.rotation.x = 0; L.knee.rotation.x = R.knee.rotation.x = 0; bot.body.position.y = 0; bot.root.position.y = 0;
    AL.rotation.x = AR.rotation.x = bot.folder.visible ? -1.2 : 0;
  }
  bot.shadow.position.y = 0.05 - bot.root.position.y;
}
