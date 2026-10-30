'use strict';
// Bot Office server: static frontend + status/usage API. Basic auth via OFFICE_PASSWORD (never logged).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const team = require('./team.json');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'state.json');
const DIST = path.join(__dirname, 'dist');
const PASSWORD = process.env.OFFICE_PASSWORD;
if (!PASSWORD) { console.error('OFFICE_PASSWORD is not set; refusing to start.'); process.exit(1); }
const PW_HASH = crypto.createHash('sha256').update(PASSWORD).digest();

const WORKING_STALE_MS = 10 * 60 * 1000;   // a working status goes stale after 10 minutes
const HEARTBEAT_MS = 5 * 60 * 1000;        // heartbeat every 5 minutes
const STATES = new Set(['working', 'waiting', 'error', 'done', 'idle']);
const SLUGS = new Map(team.bots.map(b => [b.slug, b]));

function loadState() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return { bots: {}, usage: null, heartbeatAt: null }; }
}
let state = loadState();
state.bots = state.bots || {};
function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
function heartbeat() {
  const now = Date.now();
  for (const [slug, b] of Object.entries(state.bots)) {
    if (b.state === 'working' && now - b.updatedAt > WORKING_STALE_MS) {
      state.bots[slug] = { state: 'idle', line: '', updatedAt: now, stale: true };
    }
  }
  state.heartbeatAt = now;
  save();
}
heartbeat();
setInterval(heartbeat, HEARTBEAT_MS).unref();

function authed(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Basic ')) return false;
  let decoded;
  try { decoded = Buffer.from(h.slice(6), 'base64').toString('utf8'); } catch { return false; }
  const i = decoded.indexOf(':');
  const given = i >= 0 ? decoded.slice(i + 1) : decoded;
  const gh = crypto.createHash('sha256').update(given).digest();
  return crypto.timingSafeEqual(gh, PW_HASH);
}
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > 20000) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const normSlug = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cleanLine = s => String(s || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80); // short, generic lines only

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  console.log(new Date().toISOString(), req.method, url.pathname);   // method + path only
  if (!authed(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Bot Office", charset="UTF-8"', 'Content-Type': 'text/plain' });
    return res.end('Authentication required');
  }
  try {
    if (url.pathname === '/api/state' && req.method === 'GET') {
      return send(res, 200, { now: Date.now(), team: team.bots.map(b => b.slug), ...state });
    }
    if (url.pathname === '/api/status' && req.method === 'POST') {
      let j; try { j = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'invalid json' }); }
      const slug = normSlug(j.slug || j.bot);
      if (!SLUGS.has(slug)) return send(res, 400, { error: 'unknown bot slug', valid: [...SLUGS.keys()] });
      const st = String(j.state || '').toLowerCase();
      if (!STATES.has(st)) return send(res, 400, { error: 'invalid state', valid: [...STATES] });
      const line = cleanLine(j.line);
      state.bots[slug] = { state: st, line, updatedAt: Date.now() };
      save();
      return send(res, 200, { ok: true, slug, state: st });
    }
    if (url.pathname === '/api/usage' && req.method === 'POST') {
      let j; try { j = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'invalid json' }); }
      let left = j.percentLeft ?? j.percent_left;
      const used = j.percentUsed ?? j.percent_used;
      if (left == null && used != null) left = 100 - Number(used);
      left = Number(left);
      if (!Number.isFinite(left)) return send(res, 400, { error: 'need percentLeft or percentUsed (0-100)' });
      let resetsAt = j.resetsAt ?? j.resets_at ?? null;
      if (resetsAt != null) { const t = typeof resetsAt === 'number' ? resetsAt : Date.parse(resetsAt); if (!Number.isFinite(t)) return send(res, 400, { error: 'resetsAt must be ISO date or epoch ms' }); resetsAt = t < 1e12 ? t * 1000 : t; }
      state.usage = { percentLeft: Math.max(0, Math.min(100, left)), resetsAt, plan: j.plan ? String(j.plan).slice(0, 40) : null, updatedAt: Date.now() };
      save();
      return send(res, 200, { ok: true, usage: state.usage });
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'not found' });
    // static
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });
    let p = decodeURIComponent(url.pathname); if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(DIST, p));
    if (!file.startsWith(DIST + path.sep)) return send(res, 403, 'forbidden', 'text/plain');
    fs.readFile(file, (err, buf) => {
      if (err) return send(res, 404, 'not found', 'text/plain');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': file.includes('/assets/') ? 'public, max-age=3600' : 'no-store' });
      res.end(buf);
    });
  } catch (e) { send(res, 500, { error: 'server error' }); }
});
server.listen(PORT, HOST, () => console.log(`Bot Office listening on ${HOST}:${PORT}`));
