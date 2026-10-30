import team from '../team.json';

export const BOTS = team.bots;
export const FLOOR = { x0: -18, x1: 18, z0: -14, z1: 14 };
export const COLS = [-13.5, -4.5, 4.5, 13.5];
export const ROWS = [-10.5, -3.5, 3.5, 10.5];
export const DOME_R = 27, DOME_SY = 0.5;

const byDept = d => BOTS.filter(b => b.dept === d);
const deptCell = { 'Finance & Health': [0, 1], 'Business': [1, 1], 'Food': [2, 1], 'Trading': [3, 1], 'Family': [0, 2], 'Home': [1, 2], 'Media': [2, 2], 'Lounge Advisors': [3, 2] };

// zones: used for carpet tint + lettering (text sits at the FRONT of each zone, nothing is placed over it)
export const zones = [
  { name: 'EXECUTIVE', x0: -18, x1: -9, z0: -14, z1: -7, lx: -14.2, lz: -8.4, maxW: 6.6, color: '#e8761a' },
  { name: 'RESEARCH', x0: -9, x1: 9, z0: -14, z1: -7, lx: 0, lz: -8.4, maxW: 7, color: '#5fa8c8' },
  { name: 'SERVER ROOM', x0: 9, x1: 18, z0: -14, z1: -7, lx: 13.5, lz: -8.4, maxW: 7.4, color: '#6b7a8c' },
  { name: 'LOUNGE', x0: -18, x1: 0, z0: 7, z1: 14, lx: -9, lz: 13.2, maxW: 10, color: '#c0763a' },
  { name: 'BREAK ROOM', x0: 0, x1: 18, z0: 7, z1: 14, lx: 9, lz: 13.2, maxW: 10, color: '#6aa37a' },
];
export const desks = {}; // slug -> {desk:{x,z,w,d}, seat:{x,z,h}, approach:{x,z}}
for (const [dept, [ci, ri]] of Object.entries(deptCell)) {
  const cx = COLS[ci], cz = ROWS[ri];
  const bs = byDept(dept);
  const color = bs[0].color;
  zones.push({ name: dept.toUpperCase(), x0: cx - 4.5, x1: cx + 4.5, z0: cz - 3.5, z1: cz + 3.5, lx: cx, lz: cz + 2.1, maxW: 7.6, color, dept });
  bs.forEach((b, i) => {
    const dx = bs.length === 1 ? cx : cx + (i === 0 ? -2.2 : 2.2);
    desks[b.slug] = { desk: { x: dx, z: cz - 0.3, w: 2.4, d: 1.2 }, seat: { x: dx, z: cz - 1.9, h: 0 }, approach: { x: dx, z: cz - 2.8 } };
  });
}
desks['chief-of-staff'] = { desk: { x: -14.5, z: -10.1, w: 3.2, d: 1.4 }, seat: { x: -14.5, z: -11.9, h: 0 }, approach: { x: -12.3, z: -11.8 } };
export const LEAD_DELIVERY = { x: -14.5, z: -8.7 }; // where handoffs are carried (in front of the lead's desk)
export const LEAD_DOOR = { x: -11.2, z: -7 };

// idle seats: lounge + break room (15+)
export const idleSeats = [];
const S = (x, z, h, ax, az, kind) => idleSeats.push({ x, z, h, approach: { x: ax, z: az }, kind });
[-16.2, -14.8, -13.4].forEach(x => S(x, 8.8, 0, x, 10.0, 'sofa'));
[-8.2, -6.8, -5.4].forEach(x => S(x, 8.8, 0, x, 10.0, 'sofa'));
S(-11.6, 8.8, 0, -11.6, 9.9, 'chair'); S(-10.0, 8.8, 0, -10.0, 9.9, 'chair');
S(-17.0, 11.8, Math.PI / 2, -15.6, 11.8, 'chair'); S(-1.0, 11.8, -Math.PI / 2, -2.4, 11.8, 'chair');
[1.8, 3.0, 4.2, 5.4, 6.6, 7.8].forEach(x => S(x, 9.0, 0, x, 7.9, 'stool'));
S(11.9, 9.4, Math.PI / 2, 11.9, 8.0, 'chair'); S(14.1, 9.4, -Math.PI / 2, 14.1, 8.0, 'chair');
export const COFFEE_SPOT = { x: 12.8, z: 12.0 };

// furniture footprints (for walking); x/z centers
const R = (x, z, w, d) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
export const obstacles = [];
for (const k of Object.keys(desks)) { const d = desks[k].desk; obstacles.push(R(d.x, d.z, d.w, d.d)); }
export const furniture = {
  sofas: [{ x: -14.8, z: 8.5, w: 4.8, d: 1.6 }, { x: -6.8, z: 8.5, w: 4.8, d: 1.6 }],
  coffeeTable: { x: -10.8, z: 11.3, w: 1.8, d: 1.1 },
  counter: { x: 4.8, z: 10.6, w: 8, d: 1.0 },
  roundTable: { x: 13.0, z: 9.4, r: 0.55 },
  fridge: { x: 16.6, z: 8.3, w: 1.4, d: 1.2 },
  vending: { x: 15.0, z: 8.3, w: 1.3, d: 1.2 },
  researchTable: { x: 0, z: -10.2, w: 7, d: 1.3 },
  racks: [11, 12.4, 13.8, 15.2, 16.6].map(x => ({ x, z: -13.0, w: 1.1, d: 1.1 })),
  plants: [],
};
const plants = [];
for (const z of zones.filter(z => z.dept)) { plants.push({ x: z.x0 + 0.9, z: (z.z0 + z.z1) / 2 + 1.2 }); plants.push({ x: z.x1 - 0.9, z: (z.z0 + z.z1) / 2 + 1.2 }); }
plants.push({ x: -17.2, z: 7.9 }, { x: -0.8, z: 7.9 }, { x: 17.2, z: 12.6 }, { x: 8.2, z: -8.6 }, { x: -8.2, z: -8.6 }, { x: -16.9, z: -8.0 });
furniture.plants = plants;
furniture.sofas.forEach(s => obstacles.push(R(s.x, s.z, s.w, s.d)));
obstacles.push(R(-17, 11.8, 1.3, 1.3), R(-1, 11.8, 1.3, 1.3), R(-11.6, 8.8, 1.2, 1.2), R(-10, 8.8, 1.2, 1.2));
const c = furniture.coffeeTable; obstacles.push(R(c.x, c.z, c.w, c.d));
const k = furniture.counter; obstacles.push(R(k.x, k.z, k.w, k.d));
const rt = furniture.roundTable; obstacles.push(R(rt.x, rt.z, 1.3, 1.3));
obstacles.push(R(furniture.fridge.x, furniture.fridge.z, 1.4, 1.2), R(furniture.vending.x, furniture.vending.z, 1.3, 1.2));
const rs = furniture.researchTable; obstacles.push(R(rs.x, rs.z, rs.w, rs.d));
furniture.racks.forEach(r => obstacles.push(R(r.x, r.z, r.w, r.d)));
plants.forEach(p => obstacles.push(R(p.x, p.z, 0.8, 0.8)));
// walls: back wall + glass corner office (door gap x -12.2..-10.2)
obstacles.push({ x0: -18, x1: 18, z0: -14.1, z1: -13.7 });
obstacles.push({ x0: -18, x1: -12.2, z0: -7.1, z1: -6.9 }, { x0: -10.2, x1: -9, z0: -7.1, z1: -6.9 }, { x0: -9.1, x1: -8.9, z0: -14, z1: -7 });

// ---- path finding on a 0.5 grid ----
const GS = 0.5, GX0 = -19, GZ0 = -15, GW = 76, GH = 60, PAD = 0.42;
const blocked = new Uint8Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const x = GX0 + (i + 0.5) * GS, z = GZ0 + (j + 0.5) * GS;
  let b = x < -17.6 || x > 17.6 || z < -13.3 || z > 13.7;
  if (!b) for (const o of obstacles) if (x > o.x0 - PAD && x < o.x1 + PAD && z > o.z0 - PAD && z < o.z1 + PAD) { b = true; break; }
  blocked[j * GW + i] = b ? 1 : 0;
}
const cell = (x, z) => [Math.max(0, Math.min(GW - 1, Math.floor((x - GX0) / GS))), Math.max(0, Math.min(GH - 1, Math.floor((z - GZ0) / GS)))];
const free = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH && !blocked[j * GW + i];
function nearestFree(x, z) {
  const [ci, cj] = cell(x, z); if (free(ci, cj)) return [ci, cj];
  for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (Math.max(Math.abs(di), Math.abs(dj)) === r && free(ci + di, cj + dj)) return [ci + di, cj + dj];
  return [ci, cj];
}
function los(a, b) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2) + 1;
  for (let t = 0; t <= n; t++) { const i = Math.round(a[0] + (b[0] - a[0]) * t / n), j = Math.round(a[1] + (b[1] - a[1]) * t / n); if (!free(i, j)) return false; }
  return true;
}
export function findPath(from, to) {
  const s = nearestFree(from.x, from.z), g = nearestFree(to.x, to.z);
  const key = (i, j) => j * GW + i, open = [[0, ...s]], came = new Map(), gs = new Map([[key(...s), 0]]);
  const h = (i, j) => Math.hypot(i - g[0], j - g[1]);
  let found = false;
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [, i, j] = open.shift();
    if (i === g[0] && j === g[1]) { found = true; break; }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj;
      if (!free(ni, nj) || (di && dj && (!free(i + di, j) || !free(i, j + dj)))) continue;
      const ng = gs.get(key(i, j)) + Math.hypot(di, dj);
      if (ng < (gs.get(key(ni, nj)) ?? 1e9)) { gs.set(key(ni, nj), ng); came.set(key(ni, nj), [i, j]); open.push([ng + h(ni, nj), ni, nj]); }
    }
  }
  let cells = [];
  if (found) { let cur = g; cells.push(cur); while (came.has(key(...cur))) { cur = came.get(key(...cur)); cells.push(cur); } cells.reverse(); } else cells = [s, g];
  // string-pull
  const out = [cells[0]]; let a = 0;
  while (a < cells.length - 1) { let b = cells.length - 1; while (b > a + 1 && !los(cells[a], cells[b])) b--; out.push(cells[b]); a = b; }
  const pts = out.map(([i, j]) => ({ x: GX0 + (i + 0.5) * GS, z: GZ0 + (j + 0.5) * GS }));
  return [from, ...pts.slice(1, -1), to];
}
