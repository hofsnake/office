import * as THREE from 'three';
import { BOTS, FLOOR, zones, desks, furniture, DOME_R, DOME_SY, idleSeats } from './layout.js';

const M = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
const B = (w, h, d, color, x = 0, y = 0, z = 0, parent) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'object' ? color : M(color));
  m.position.set(x, y, z); if (parent) parent.add(m); return m;
};
const rand = (() => { let s = 1337; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const R = (a, b) => a + (b - a) * rand();

function canvasTex(w, h, renderer) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  return { c, ctx: c.getContext('2d'), tex: t };
}
const mix = (hex, to, a) => { const c = new THREE.Color(hex).lerp(new THREE.Color(to), a); return '#' + c.getHexString(); };

export function buildWorld(scene, renderer) {
  const upd = []; // per-frame updaters (t, dt)
  const ledMats = {}; // slug -> material (monitor activity LED)

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0x9fd4ea, 0x4f7480, 1.0));
  const sun = new THREE.DirectionalLight(0xbfe0f4, 0.55); sun.position.set(-20, 60, 25); scene.add(sun);
  const warm = [[-10, 7, -4, 240], [10, 7, -4, 240], [-10, 7, 7, 240], [10, 7, 7, 240], [0, 8, 1, 170]];
  for (const [x, y, z, i] of warm) { const l = new THREE.PointLight(0xffb870, i, 34, 1.4); l.position.set(x, y, z); scene.add(l); }

  // ---------- ocean floor ----------
  {
    const g = new THREE.PlaneGeometry(420, 420, 140, 140); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      const f = Math.min(1, Math.max(0, (r - 29) / 20));
      p.setY(i, f * (Math.sin(x * 0.07) * Math.cos(z * 0.06) * 1.6 + Math.sin(x * 0.19 + z * 0.13) * 0.5) - 0.12);
    }
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, M(0xd2bc8a, { flatShading: true })));
  }
  // ---------- dome ----------
  const dome = new THREE.Group(); dome.scale.set(1, DOME_SY, 1); scene.add(dome);
  {
    const glass = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 72, 28, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0x8fd4e4, { transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    glass.renderOrder = 5; dome.add(glass);
    const rib = M(0x7e95a3);
    for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(DOME_R, 0.09, 6, 64, Math.PI), rib); t.rotation.y = k * Math.PI / 4; dome.add(t); }
    for (const deg of [30, 55, 78]) {
      const th = deg * Math.PI / 180; const t = new THREE.Mesh(new THREE.TorusGeometry(DOME_R * Math.sin(th), 0.08, 6, 80), rib);
      t.rotation.x = Math.PI / 2; t.position.y = DOME_R * Math.cos(th); dome.add(t);
    }
    const base = new THREE.Mesh(new THREE.TorusGeometry(DOME_R, 0.55, 8, 96), M(0x6d7c88)); base.rotation.x = Math.PI / 2; dome.add(base);
    const skirt = new THREE.Mesh(new THREE.RingGeometry(DOME_R, DOME_R + 4, 96), M(0x8a959c)); skirt.rotation.x = -Math.PI / 2; skirt.position.y = 0.04; scene.add(skirt);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(DOME_R, 96), M(0x6b7780)); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; scene.add(floor);
    // exterior lamps on the base
    const lampM = new THREE.MeshBasicMaterial({ color: 0xffc27a });
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; const s = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), lampM); s.position.set(Math.cos(a) * (DOME_R + 1.6), 0.6, Math.sin(a) * (DOME_R + 1.6)); scene.add(s); const post = B(0.12, 0.6, 0.12, 0x3b4650, s.position.x, 0.3, s.position.z, scene); }
  }

  // ---------- carpet (full-res canvas with department names) ----------
  {
    const W = 4096, H = Math.round(4096 * 28 / 36), PX = W / 36;
    const { c, ctx, tex } = canvasTex(W, H, renderer);
    const X = x => (x - FLOOR.x0) * PX, Z = z => (z - FLOOR.z0) * PX;
    ctx.fillStyle = '#2b3944'; ctx.fillRect(0, 0, W, H);
    // subtle carpet weave (large-scale, no shimmer)
    ctx.fillStyle = 'rgba(255,255,255,0.018)'; for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 3);
    for (const z of zones) {
      ctx.fillStyle = mix('#2b3944', z.color, 0.11); ctx.fillRect(X(z.x0) + 8, Z(z.z0) + 8, (z.x1 - z.x0) * PX - 16, (z.z1 - z.z0) * PX - 16);
      ctx.strokeStyle = mix('#2b3944', z.color, 0.26); ctx.lineWidth = 6; ctx.strokeRect(X(z.x0) + 8, Z(z.z0) + 8, (z.x1 - z.x0) * PX - 16, (z.z1 - z.z0) * PX - 16);
    }
    for (const z of zones) {
      let size = 1.0 * PX; ctx.font = `800 ${size}px "Helvetica Neue", Arial, sans-serif`;
      const tw = ctx.measureText(z.name).width, maxW = z.maxW * PX; if (tw > maxW) size *= maxW / tw;
      ctx.font = `800 ${size}px "Helvetica Neue", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = mix('#c4d6e0', z.color, 0.12); ctx.globalAlpha = 0.8; ctx.fillText(z.name, X(z.lx), Z(z.lz)); ctx.globalAlpha = 1;
    }
    // lounge rug
    ctx.fillStyle = 'rgba(160,80,50,0.28)'; ctx.fillRect(X(-17.4), Z(8.3), 17 * PX - 20, 4.4 * PX);
    tex.needsUpdate = true;
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(36, 28), new THREE.MeshBasicMaterial({ map: tex }));
    carpet.material = new THREE.MeshLambertMaterial({ map: tex }); carpet.rotation.x = -Math.PI / 2; carpet.position.y = 0.03; scene.add(carpet);
  }

  // ---------- back wall + glass corner office ----------
  const wallM = M(0x31505f);
  B(36, 5, 0.3, wallM, 0, 2.5, -13.85, scene); B(36, 0.6, 0.34, 0x233a46, 0, 0.3, -13.83, scene);
  const glassM = () => M(0xa8e4ee, { transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const frameM = M(0x59666f);
  const gwall = (x0, x1, z0, z1) => { // vertical glass pane from rect
    const w = Math.max(x1 - x0, 0.12), d = Math.max(z1 - z0, 0.12);
    const m = B(w, 3.2, d, glassM(), (x0 + x1) / 2, 1.8, (z0 + z1) / 2, scene); m.renderOrder = 4;
    B(w + 0.04, 0.14, d + 0.04, frameM, (x0 + x1) / 2, 3.45, (z0 + z1) / 2, scene); B(w + 0.04, 0.14, d + 0.04, frameM, (x0 + x1) / 2, 0.2, (z0 + z1) / 2, scene);
  };
  gwall(-18, -12.2, -7.05, -6.95); gwall(-10.2, -9, -7.05, -6.95); gwall(-9.05, -8.95, -14, -7);
  for (const [x, z] of [[-18, -7], [-12.2, -7], [-10.2, -7], [-9, -7], [-9, -14]]) B(0.16, 3.6, 0.16, frameM, x, 1.8, z, scene);
  B(2.0, 0.12, 0.1, 0x4c5963, -11.2, 3.3, -7, scene); // door header

  // ---------- helpers: plants, chairs, desks ----------
  const potM = M(0x7a5a46), leafM = [M(0x3f8a52), M(0x2f7a48), M(0x4e9a5a)];
  const plant = (x, z, s = 1) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.5, 10), potM); pot.position.y = 0.25; g.add(pot);
    for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 5), leafM[k % 3]); const a = k / 6 * Math.PI * 2; l.position.set(Math.cos(a) * 0.18, 0.95, Math.sin(a) * 0.18); l.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); g.add(l); }
    scene.add(g);
  };
  furniture.plants.forEach(p => plant(p.x, p.z));
  const chairM = M(0x2c333b);
  const chair = (x, z) => { B(0.85, 0.12, 0.8, chairM, x, 0.48, z, scene); B(0.8, 0.9, 0.12, chairM, x, 0.98, z - 0.42, scene); B(0.12, 0.45, 0.12, 0x555f68, x, 0.24, z, scene); B(0.6, 0.06, 0.6, 0x555f68, x, 0.05, z, scene); };
  const deskWood = M(0x7a6048), deskLeg = M(0x4b4f55), monM = M(0x1e242a), lampM2 = new THREE.MeshBasicMaterial({ color: 0xffc27a });
  for (const b of BOTS) {
    const d = desks[b.slug], dk = d.desk, lead = b.lead;
    B(dk.w, 0.1, dk.d, deskWood, dk.x, 0.78, dk.z, scene);
    B(0.1, 0.74, dk.d - 0.1, deskLeg, dk.x - dk.w / 2 + 0.1, 0.37, dk.z, scene); B(0.1, 0.74, dk.d - 0.1, deskLeg, dk.x + dk.w / 2 - 0.1, 0.37, dk.z, scene);
    B(dk.w - 0.2, 0.5, 0.06, deskLeg, dk.x, 0.5, dk.z - dk.d / 2 + 0.2, scene);
    const mw = lead ? 1.5 : 1.1;
    B(0.12, 0.3, 0.1, 0x555f68, dk.x, 0.98, dk.z - 0.05, scene);
    B(mw, 0.66, 0.07, monM, dk.x, 1.4, dk.z - 0.1, scene);
    const led = new THREE.MeshBasicMaterial({ color: 0x2c3a44 }); ledMats[b.slug] = led;
    B(mw - 0.2, 0.07, 0.03, led, dk.x, 1.17, dk.z - 0.06, scene); // activity strip on the back of the monitor (lit in bot color while working)
    B(0.7, 0.03, 0.26, 0x3a4048, dk.x, 0.85, dk.z - 0.35, scene);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lampM2); lamp.position.set(dk.x + dk.w / 2 - 0.35, 1.1, dk.z + 0.1); scene.add(lamp); B(0.04, 0.3, 0.04, 0x30363c, lamp.position.x, 0.95, lamp.position.z, scene);
    chair(d.seat.x, d.seat.z);
  }
  // exec extras: bookshelf + rug
  B(0.5, 2.2, 3, M(0x6a5038), -17.6, 1.1, -10.5, scene); for (let k = 0; k < 6; k++) B(0.36, 0.3 + (k % 3) * 0.08, 0.14, [0xa84a3a, 0x3a6aa8, 0xc8a040, 0x4a8a58][k % 4], -17.35, 0.6 + (k % 2) * 0.7, -11.6 + k * 0.4, scene);
  B(3.4, 0.03, 2.2, M(0x6a3a2a), -14.5, 0.05, -10.1, scene).material.color.set(0x5a3328);

  // ---------- lounge ----------
  const sofaM = M(0x8a4f3a), cushM = M(0xa05a42);
  for (const s of furniture.sofas) { B(s.w, 0.5, 1.4, sofaM, s.x, 0.3, s.z, scene); B(s.w, 0.9, 0.35, sofaM, s.x, 0.9, s.z - 0.6, scene); B(0.4, 0.8, 1.4, sofaM, s.x - s.w / 2 + 0.2, 0.55, s.z, scene); B(0.4, 0.8, 1.4, sofaM, s.x + s.w / 2 - 0.2, 0.55, s.z, scene); B(s.w - 0.8, 0.12, 1.1, cushM, s.x, 0.62, s.z + 0.05, scene); }
  const armM = M(0x4f6a8a);
  for (const sx of [[-17, 11.8, Math.PI / 2], [-1, 11.8, -Math.PI / 2], [-11.6, 8.8, 0], [-10, 8.8, 0]]) {
    const g = new THREE.Group(); g.position.set(sx[0], 0, sx[1]); g.rotation.y = sx[2]; scene.add(g);
    B(1.1, 0.45, 1.1, armM, 0, 0.28, 0, g); B(1.1, 0.8, 0.25, armM, 0, 0.8, -0.45, g); B(0.22, 0.5, 1.0, armM, -0.5, 0.6, 0, g); B(0.22, 0.5, 1.0, armM, 0.5, 0.6, 0, g);
  }
  { const t = furniture.coffeeTable; B(t.w, 0.08, t.d, deskWood, t.x, 0.5, t.z, scene); B(0.1, 0.5, 0.1, deskLeg, t.x - 0.7, 0.25, t.z, scene); B(0.1, 0.5, 0.1, deskLeg, t.x + 0.7, 0.25, t.z, scene); }
  // floor lamps
  for (const [x, z] of [[-17.2, 9.4], [-0.9, 9.6]]) { B(0.06, 2.0, 0.06, 0x30363c, x, 1.0, z, scene); const g = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc27a })); g.position.set(x, 2.1, z); scene.add(g); }
  // ---------- break room ----------
  { const k = furniture.counter; B(k.w, 1.0, k.d, M(0x6f7f8a), k.x, 0.5, k.z, scene); B(k.w + 0.1, 0.08, k.d + 0.1, M(0x2b2f33), k.x, 1.04, k.z, scene);
    B(0.5, 0.5, 0.45, 0x3a3f45, 7.2, 1.33, k.z, scene); B(0.3, 0.12, 0.3, 0xb85a3a, 7.2, 1.62, k.z, scene);
    for (const x of [3, 4.1, 5.2]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.16, 8), M(0xd8d2c4)); m.position.set(x, 1.16, k.z); scene.add(m); }
    for (const x of idleSeats.filter(s => s.kind === 'stool').map(s => s.x)) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12), chairM); st.position.set(x, 0.55, 9.0); scene.add(st); B(0.08, 0.5, 0.08, 0x555f68, x, 0.28, 9.0, scene); } }
  B(1.4, 2.3, 1.2, M(0x9aa6ae), furniture.fridge.x, 1.15, furniture.fridge.z, scene); B(0.06, 0.8, 0.06, 0x30363c, furniture.fridge.x - 0.4, 1.35, furniture.fridge.z + 0.64, scene);
  B(1.3, 2.2, 1.2, M(0x3a6a9a), furniture.vending.x, 1.1, furniture.vending.z, scene); B(0.9, 1.1, 0.04, 0xffd9a0, furniture.vending.x, 1.4, furniture.vending.z + 0.62, scene).material = new THREE.MeshBasicMaterial({ color: 0xd8b078 });
  { const t = furniture.roundTable; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.08, 20), deskWood); m.position.set(t.x, 0.75, t.z); scene.add(m); B(0.1, 0.72, 0.1, deskLeg, t.x, 0.38, t.z, scene);
    for (const dx of [-1.1, 1.1]) { B(0.7, 0.1, 0.7, chairM, t.x + dx, 0.5, t.z, scene); B(0.1, 0.8, 0.7, chairM, t.x + dx * 1.32, 0.9, t.z, scene); B(0.1, 0.5, 0.1, 0x555f68, t.x + dx, 0.25, t.z, scene); } }

  // ---------- research area ----------
  { const t = furniture.researchTable; B(t.w, 0.1, t.d, M(0x9ba6ae), t.x, 0.8, t.z, scene); for (const dx of [-3.2, 3.2]) B(0.1, 0.78, t.d - 0.2, deskLeg, t.x + dx, 0.39, t.z, scene);
    for (const dx of [-2, 0, 2]) { B(0.9, 0.04, 0.6, 0x2a3036, t.x + dx, 0.87, t.z, scene); B(0.9, 0.55, 0.04, 0x1e242a, t.x + dx, 1.12, t.z - 0.35, scene).rotation.x = -0.2; } }
  // screens
  const screens = [];
  const mkScreen = (x, y, z, w, h, draw, cw = 1280, ch = 720) => {
    const { c, ctx, tex } = canvasTex(cw, ch, renderer);
    B(w + 0.3, h + 0.3, 0.1, 0x14191e, x, y, z, scene);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.position.set(x, y, z + 0.07); scene.add(m);
    screens.push({ c, ctx, tex, draw, cw, ch }); return screens[screens.length - 1];
  };
  const termLines = []; let usageState = null; let usageSim = false;
  const usageScreen = mkScreen(13.5, 3.75, -13.68, 7.4, 2.45, (s, t) => drawUsage(s), 2048, 678);
  mkScreen(-5.4, 3.25, -13.68, 4.8, 2.7, drawChart);
  mkScreen(0.2, 3.25, -13.68, 4.8, 2.7, drawMap);
  const termScreen = mkScreen(5.8, 3.25, -13.68, 4.8, 2.7, (s, t) => drawTerm(s, t));
  function drawChart(s, t) {
    const { ctx, cw: w, ch: h } = s; ctx.fillStyle = '#0c1a24'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1d3a4a'; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(60, i * h / 6); ctx.lineTo(w - 40, i * h / 6); ctx.stroke(); }
    for (let i = 0; i < 12; i++) { const bh = (0.25 + 0.2 * Math.sin(t * 0.8 + i * 0.7) + 0.15 * Math.sin(i * 1.9)) * h * 0.8; ctx.fillStyle = '#1f6f86'; ctx.fillRect(80 + i * 92, h - 60 - bh, 62, bh); }
    ctx.strokeStyle = '#e8a64a'; ctx.lineWidth = 6; ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const x = 60 + i * (w - 100) / 60, y = h * 0.45 + Math.sin(i * 0.25 + t * 0.9) * h * 0.14 + Math.sin(i * 0.11 - t * 0.4) * h * 0.1; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  }
  const US = [[-124.7, 48.4], [-124.1, 46.3], [-124, 43], [-124.4, 40.4], [-123.8, 39], [-122.5, 37.5], [-121.9, 36.6], [-120.6, 34.6], [-118.5, 34], [-117.1, 32.5], [-114.7, 32.7], [-111, 31.3], [-108.2, 31.3], [-106.5, 31.8], [-104.5, 29.6], [-103.1, 29], [-102.4, 29.8], [-101.4, 29.8], [-99.5, 27.5], [-97.4, 25.9], [-97.4, 27.8], [-95, 29.3], [-93.8, 29.7], [-91, 29.2], [-89.2, 29], [-89.4, 30.2], [-88, 30.3], [-85.5, 29.7], [-84, 30], [-82.8, 28], [-81.8, 26.1], [-80.4, 25.2], [-80.1, 26.8], [-81, 29.5], [-81.4, 30.7], [-80.9, 32], [-79, 33.7], [-76, 35], [-76, 37], [-75.1, 38.4], [-74, 39.5], [-74, 40.6], [-72, 41], [-70, 41.7], [-70.8, 42.9], [-70.2, 43.7], [-67, 44.8], [-67.8, 47.1], [-69.2, 47.4], [-70.5, 45.5], [-71.5, 45], [-74.8, 45], [-76.5, 44], [-79, 43.3], [-82.5, 42.6], [-83, 42.2], [-82.4, 45.3], [-84.5, 46.5], [-88, 48], [-89.6, 48], [-95.2, 49], [-123, 49]];
  const CITIES = [[-122.3, 47.6], [-118.2, 34], [-112, 33.4], [-104.9, 39.7], [-97, 32.8], [-95.4, 29.8], [-93.3, 45], [-87.6, 41.9], [-84.4, 33.7], [-80.2, 25.8], [-77, 38.9], [-74, 40.7], [-71, 42.4]];
  function drawMap(s, t) {
    const { ctx, cw: w, ch: h } = s; ctx.fillStyle = '#0c1a24'; ctx.fillRect(0, 0, w, h);
    const px = lon => 60 + (lon + 125) / 58 * (w - 120), py = lat => 40 + (50 - lat) / 26 * (h - 80) * 1.12;
    ctx.beginPath(); US.forEach(([lo, la], i) => i ? ctx.lineTo(px(lo), py(la)) : ctx.moveTo(px(lo), py(la))); ctx.closePath();
    ctx.fillStyle = '#17394a'; ctx.fill(); ctx.strokeStyle = '#4aa9c4'; ctx.lineWidth = 4; ctx.stroke();
    CITIES.forEach(([lo, la], i) => { const a = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.3); ctx.fillStyle = `rgba(255,190,100,${0.35 + a * 0.6})`; ctx.beginPath(); ctx.arc(px(lo), py(la), 7 + a * 7, 0, 7); ctx.fill(); });
  }
  function drawTerm(s, t) {
    const { ctx, cw: w, ch: h } = s; ctx.fillStyle = '#0a1410'; ctx.fillRect(0, 0, w, h);
    ctx.font = '600 38px "Courier New", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = '#7fd69a';
    const lines = termLines.slice(-14); let y = 28;
    if (!lines.length) { ctx.fillText('> awaiting status feed' + (Math.floor(t * 2) % 2 ? '_' : ' '), 40, y); return; }
    for (const l of lines) { ctx.fillText(l.length > 40 ? l.slice(0, 39) + '…' : l, 40, y); y += 46; }
    if (Math.floor(t * 2) % 2) ctx.fillText('> _', 40, y);
  }
  const fmtReset = ms => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(ms));
  function drawUsage(s) {
    const { ctx, cw: w, ch: h } = s; ctx.fillStyle = '#0f1f2a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2d5a70'; ctx.lineWidth = 8; ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#8fb6c8'; ctx.font = '700 64px Arial, sans-serif'; ctx.fillText('WEEKLY USAGE LEFT', 70, 120);
    const u = usageState;
    if (!u) { ctx.fillStyle = '#c9d8e0'; ctx.font = '800 220px Arial, sans-serif'; ctx.fillText('--%', 70, 360); ctx.fillStyle = '#8fb6c8'; ctx.font = '600 56px Arial, sans-serif'; ctx.fillText('No usage reading yet', 70, 480); return; }
    const p = u.percentLeft, col = p > 30 ? '#6fcf8e' : p > 15 ? '#e8b24a' : '#e5675a';
    ctx.fillStyle = col; ctx.font = '800 230px Arial, sans-serif'; ctx.fillText(Math.round(p) + '%', 70, 370);
    ctx.fillStyle = '#1b3342'; ctx.fillRect(900, 190, 1050, 120); ctx.fillStyle = col; ctx.fillRect(900, 190, 1050 * p / 100, 120);
    ctx.fillStyle = '#c9d8e0'; ctx.font = '600 58px Arial, sans-serif';
    ctx.fillText(u.resetsAt ? 'Resets ' + fmtReset(u.resetsAt) : 'Reset time unknown', 70, 480);
    ctx.fillStyle = '#8fb6c8'; ctx.font = '600 44px Arial, sans-serif';
    const ago = Math.max(0, Math.round((Date.now() - u.updatedAt) / 60000)); ctx.fillText('Updated ' + (ago < 1 ? 'just now' : ago < 90 ? ago + ' min ago' : Math.round(ago / 60) + ' h ago'), 70, 590);
  }
  // server racks with blinking LEDs
  const ledCols = [new THREE.MeshBasicMaterial({ color: 0x3ddc84 }), new THREE.MeshBasicMaterial({ color: 0xffb04a }), new THREE.MeshBasicMaterial({ color: 0x4aa8ff })];
  const dim = new THREE.MeshBasicMaterial({ color: 0x1a2128 });
  const leds = [];
  for (const r of furniture.racks) {
    B(r.w, 2.4, r.d, 0x242b32, r.x, 1.2, r.z, scene);
    for (let u = 0; u < 8; u++) { B(r.w - 0.14, 0.18, 0.04, 0x39424a, r.x, 0.35 + u * 0.27, r.z + r.d / 2 + 0.01, scene); for (let k = 0; k < 3; k++) { const l = B(0.07, 0.07, 0.03, ledCols[k], r.x - 0.28 + k * 0.14, 0.35 + u * 0.27, r.z + r.d / 2 + 0.04, scene); leds.push({ m: l, ph: rand() * 6, sp: 1 + rand() * 3, c: ledCols[(u + k) % 3] }); } }
  }
  upd.push((t) => { for (const l of leds) { const on = Math.sin(t * l.sp * 2 + l.ph) > 0.1; l.m.material = on ? l.c : dim; } });

  // ---------- sea life & decor outside ----------
  const frontSector = a => { const d = Math.abs(((a - Math.PI / 2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return d < 0.62; }; // keep tall stuff out of the camera sector
  // kelp
  const kelpM = [M(0x2f7a45), M(0x3a8a4a), M(0x48894a)], segG = new THREE.CylinderGeometry(0.16, 0.2, 1.1, 5);
  const kelps = [];
  for (let k = 0; k < 46; k++) {
    const a = rand() * Math.PI * 2, r = R(33, 78); if (frontSector(a) && r < 55) continue;
    const root = new THREE.Group(); root.position.set(Math.cos(a) * r, -0.1, Math.sin(a) * r); scene.add(root);
    let parent = root; const n = 6 + Math.floor(rand() * 5), segs = [];
    for (let i = 0; i < n; i++) { const g = new THREE.Group(); g.position.y = i ? 1.05 : 0; parent.add(g); const m = new THREE.Mesh(segG, kelpM[k % 3]); m.position.y = 0.55; m.scale.set(1 - i * 0.05, 1, 1 - i * 0.05); g.add(m); segs.push(g); parent = g; }
    kelps.push({ segs, ph: rand() * 6, sp: 0.5 + rand() * 0.4 });
  }
  upd.push(t => { for (const k of kelps) k.segs.forEach((g, i) => { g.rotation.z = Math.sin(t * k.sp + k.ph + i * 0.5) * 0.13; g.rotation.x = Math.cos(t * k.sp * 0.8 + k.ph + i * 0.4) * 0.09; }); });
  // coral + rocks
  const coralCols = [0xd9647a, 0xe8934a, 0x8d5bc0, 0xdcb84a, 0x4aa8a0];
  for (let k = 0; k < 70; k++) {
    const a = rand() * Math.PI * 2, r = R(30.5, 64), g = new THREE.Group(); g.position.set(Math.cos(a) * r, -0.05, Math.sin(a) * r); g.rotation.y = rand() * 6; scene.add(g);
    const m = M(coralCols[k % 5]), type = k % 4, sc = R(0.8, 1.7) * (frontSector(a) ? 0.7 : 1);
    if (type === 0) { for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, R(1, 2.2), 5), m); c.position.set(R(-0.6, 0.6), 0.8, R(-0.6, 0.6)); c.rotation.set(R(-0.4, 0.4), 0, R(-0.4, 0.4)); g.add(c); } }
    else if (type === 1) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), m); c.scale.y = 0.65; c.position.y = 0.4; g.add(c); }
    else if (type === 2) { for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, 0.12), m); c.position.set(0, 0.7, 0); c.rotation.y = i * 0.7; c.rotation.z = R(-0.2, 0.2); g.add(c); } }
    else { for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, R(0.8, 1.8), 6), m); c.position.set(R(-0.7, 0.7), 0.6, R(-0.7, 0.7)); g.add(c); } }
    g.scale.setScalar(sc);
  }
  const rockM = M(0x6f7a80); for (let k = 0; k < 26; k++) { const a = rand() * Math.PI * 2, r = R(31, 80), m = new THREE.Mesh(new THREE.DodecahedronGeometry(R(0.7, 2.4), 0), rockM); m.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r); m.rotation.set(rand() * 3, rand() * 3, rand() * 3); m.scale.y = 0.6; scene.add(m); }

  // fish
  const fishCols = [0xe8863a, 0xe0c24a, 0x4aa0b8, 0xb8c4cc, 0xd96a7a];
  const bodyG = new THREE.SphereGeometry(0.5, 10, 8); bodyG.scale(1.5, 0.8, 0.6); const tailG = new THREE.ConeGeometry(0.4, 0.8, 4); tailG.rotateZ(Math.PI / 2); tailG.translate(-0.95, 0, 0); tailG.scale(1, 1, 0.3);
  const fishes = [];
  for (let s = 0; s < 6; s++) {
    const cen = R(31, 40), y0 = R(3, 13), dir = s % 2 ? 1 : -1, a0 = rand() * 6.28, mat = M(fishCols[s % 5]);
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group(), body = new THREE.Mesh(bodyG, mat), tail = new THREE.Group(); tail.add(new THREE.Mesh(tailG, mat)); tail.position.x = 0; g.add(body, tail); g.scale.setScalar(R(1.3, 2.0)); scene.add(g);
      fishes.push({ g, tail, r: cen + R(-3, 3), y: y0 + R(-1.5, 1.5), a: a0 + R(-0.25, 0.25), w: dir * R(0.1, 0.14), ph: rand() * 6, yph: rand() * 6 });
    }
  }
  upd.push((t) => { for (const f of fishes) { const a = f.a + f.w * t; f.g.position.set(Math.cos(a) * f.r, f.y + Math.sin(t * 0.6 + f.yph) * 0.8, Math.sin(a) * f.r); { const sg = Math.sign(f.w); f.g.rotation.y = Math.atan2(-sg * Math.cos(a), -sg * Math.sin(a)); } f.tail.rotation.y = Math.sin(t * 7 + f.ph) * 0.5; } });
  // sea turtle
  const turtle = new THREE.Group(); scene.add(turtle);
  { const shell = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 8, 0, 6.28, 0, Math.PI / 2), M(0x5a7a3a)); shell.scale.set(1.2, 0.7, 1); turtle.add(shell);
    B(1.5, 0.15, 1.2, 0xc8b88a, 0, -0.02, 0, turtle); const head = B(0.5, 0.4, 0.5, M(0x8aa05a), 1.5, 0.05, 0, turtle);
    turtle.userData.fl = []; for (const [x, z, s] of [[0.7, 0.9, 1], [0.7, -0.9, -1], [-0.8, 0.8, 1], [-0.8, -0.8, -1]]) { const p = new THREE.Group(); p.position.set(x, 0, z); const f = B(0.5, 0.1, 1.2, M(0x8aa05a), 0, 0, s * 0.55, p); turtle.add(p); turtle.userData.fl.push([p, s]); } }
  // manta ray
  const ray = new THREE.Group(); scene.add(ray);
  { const bodyM = M(0x3f5968); B(1.2, 0.35, 1.6, bodyM, 0, 0, 0, ray); ray.userData.w = [];
    for (const s of [-1, 1]) { const p = new THREE.Group(); const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.5), bodyM); wing.position.x = s * 1.7; p.add(wing); ray.add(p); ray.userData.w.push([p, s]); }
    const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3.0, 4), bodyM); tl.rotation.x = Math.PI / 2; tl.position.z = -2.2; ray.add(tl); }
  upd.push(t => {
    let a = 0.5 + t * 0.065, r = 40; turtle.position.set(Math.cos(a) * r, 5.5 + Math.sin(t * 0.4) * 0.8, Math.sin(a) * r); turtle.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); // faces +x model axis along travel
    for (const [p, s] of turtle.userData.fl) p.rotation.x = s * Math.sin(t * 1.6) * 0.5;
    a = 2.2 - t * 0.05; r = 50; ray.position.set(Math.cos(a) * r, 9 + Math.sin(t * 0.3) * 1.2, Math.sin(a) * r); ray.rotation.y = Math.atan2(Math.sin(a), -Math.cos(a)); ray.scale.setScalar(1.8);
    for (const [p, s] of ray.userData.w) p.rotation.z = s * Math.sin(t * 1.3) * 0.35;
  });
  // turtle/ray heading fix (model faces +x / +z)
  turtle.userData.base = 0;

  // ---------- API ----------
  let last = 0;
  return {
    update(t, dt) {
      for (const u of upd) u(t, dt);
      if (t - last > 0.12) { last = t; for (const s of screens) { s.draw(s, t); s.tex.needsUpdate = true; } }
    },
    setUsage(u) { usageState = u; },
    setTerminal(lines) { termLines.length = 0; termLines.push(...lines); },
    setBotLed(slug, on, color) { const m = ledMats[slug]; if (m) m.color.set(on ? color : 0x2c3a44); },
    refreshUsageNow() { drawUsage(usageScreen); usageScreen.tex.needsUpdate = true; },
  };
}
