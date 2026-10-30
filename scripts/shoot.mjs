// Headless Chrome screenshots over CDP. Usage: node scripts/shoot.mjs <url> <out.png> <w> <h> <dpr> <waitSec> [secondOut gapSec]
// Password comes from env OFFICE_PASSWORD (never printed).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [url, out, W, H, DPR, WAIT, out2, GAP] = process.argv.slice(2);
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('/usr/bin/google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/chrome-shot-${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(m.params.args.map(a => a.value ?? a.description).join(' ')); else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || '')); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
const auth = 'Basic ' + Buffer.from(':' + process.env.OFFICE_PASSWORD).toString('base64');
await send('Network.setExtraHTTPHeaders', { headers: { Authorization: auth } });
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: +DPR, mobile: +W < 600 });
await send('Page.navigate', { url }); await sleep(+WAIT * 1000);
const shot = async f => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(f, Buffer.from(r.result.data, 'base64')); console.log('saved', f); };
await shot(out);
if (out2) { await sleep(+GAP * 1000); await shot(out2); }
const fps = await send('Runtime.evaluate', { expression: 'new Promise(r=>{let n=0;const t0=performance.now();(function f(){n++;performance.now()-t0<2000?requestAnimationFrame(f):r(n/2)})()})', awaitPromise: true });
console.log('approx fps', fps.result?.result?.value);
if (logs.length) console.log('console issues:', logs.slice(0, 8).join(' | '));
ws.close(); chrome.kill(); await sleep(300);
