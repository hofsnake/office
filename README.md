# Bot Office (underwater research station)
Local 3D office for Rick's 15 bots. Server: Node on :8787, Basic auth (any username, password = $OFFICE_PASSWORD).

- Start/stop: `./run.sh start|stop|restart|status` (needs OFFICE_PASSWORD in env; logs in server.log, only method+path)
- Rebuild frontend: `npm run build`
- Status: `./status.sh <slug> <working|waiting|error|done|idle> "short line"`  (OFFICE_URL optional)
- Usage: POST /api/usage  `{"percentLeft":62,"resetsAt":"2026-11-02T10:00:00Z"}` (or percentUsed)
- POST /api/status `{"slug":"trader","state":"working","line":"..."}`; GET /api/state
- Slugs: chief-of-staff med-bills health biz pe-reviewer san-angelo-eats foodie trader day-trade mom-guard slides housey vid 007 mentor
- Working status older than 10 min decays to idle (stale) via the 5-min heartbeat.
- `?simulate=1` runs browser-only Simulate Work; `?team=1` opens the team panel.
- Screenshots: `node scripts/shoot.mjs <url> <out.png> <w> <h> <dpr> <waitSec> [out2 gapSec]`

## Live hosted version
- Page: https://hofsnake.github.io/office/ (static build on GitHub Pages, password prompt in the page)
- Backend: Supabase project `bot-office` (ref zfwgucpkekllkpzvykwh), Edge Function `office` (source in supabase/functions/office; hash/salt placeholders here, real values only in the deployed function)
- Endpoints (header `x-office-password`): GET /state, POST /status, POST /usage at https://zfwgucpkekllkpzvykwh.supabase.co/functions/v1/office
- Build for Pages: `npx vite build --mode pages --outDir dist-pages`, then publish dist-pages to the gh-pages branch.
- `./status.sh` posts to the hosted function by default; set OFFICE_URL=http://localhost:8787 for the local server.
