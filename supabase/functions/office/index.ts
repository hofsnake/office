import { createClient } from "npm:@supabase/supabase-js@2";

// Bot Office API. Auth: header `x-office-password` checked against a salted PBKDF2 hash (the password itself is never stored here).
const SALT_HEX = "<set at deploy: random 16-byte salt, hex>";
const HASH_HEX = "<set at deploy: PBKDF2-SHA256 hash of the password, hex>";
const ITER = 100000;
const SLUGS = ["chief-of-staff","med-bills","health","biz","pe-reviewer","san-angelo-eats","foodie","trader","day-trade","mom-guard","slides","housey","vid","007","mentor"];
const STATES = ["working","waiting","error","done","idle"];
const STALE_MS = 10 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-office-password, authorization, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (code: number, body: unknown) =>
  new Response(JSON.stringify(body), { status: code, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fromHex = (h: string) => new Uint8Array(h.match(/../g)!.map((b) => parseInt(b, 16)));

async function checkPassword(given: string): Promise<boolean> {
  if (!given || given.length > 200) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(given), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(SALT_HEX), iterations: ITER }, key, 256));
  const want = fromHex(HASH_HEX);
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= bits[i] ^ want[i];
  return diff === 0;
}
const normSlug = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cleanLine = (s: unknown) => String(s ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 80);

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (!(await checkPassword(req.headers.get("x-office-password") ?? ""))) return json(401, { error: "unauthorized" });
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const route = path.split("/").pop() || "";   // .../office/state | status | usage
  try {
    if (req.method === "GET" && (route === "state" || route === "office")) {
      const [s, u] = await Promise.all([db.from("bot_status").select("*"), db.from("office_usage").select("*").eq("id", 1).maybeSingle()]);
      if (s.error) throw s.error;
      if (u.error) throw u.error;
      const now = Date.now();
      const bots: Record<string, unknown> = {};
      for (const r of s.data ?? []) {
        const t = Date.parse(r.updated_at);
        if (r.state === "working" && now - t > STALE_MS) bots[r.slug] = { state: "idle", line: "", updatedAt: now, stale: true };
        else bots[r.slug] = { state: r.state, line: r.line, updatedAt: t };
      }
      const usage = u.data ? { percentLeft: Number(u.data.percent_left), resetsAt: u.data.resets_at ? Date.parse(u.data.resets_at) : null, plan: u.data.plan, updatedAt: Date.parse(u.data.updated_at) } : null;
      return json(200, { now, team: SLUGS, bots, usage, heartbeatAt: now });
    }
    if (req.method === "POST" && route === "status") {
      let j: any; try { j = await req.json(); } catch { return json(400, { error: "invalid json" }); }
      const slug = normSlug(j.slug ?? j.bot);
      if (!SLUGS.includes(slug)) return json(400, { error: "unknown bot slug", valid: SLUGS });
      const st = String(j.state ?? "").toLowerCase();
      if (!STATES.includes(st)) return json(400, { error: "invalid state", valid: STATES });
      const { error } = await db.from("bot_status").upsert({ slug, state: st, line: cleanLine(j.line), updated_at: new Date().toISOString() });
      if (error) throw error;
      return json(200, { ok: true, slug, state: st });
    }
    if (req.method === "POST" && route === "usage") {
      let j: any; try { j = await req.json(); } catch { return json(400, { error: "invalid json" }); }
      let left = j.percentLeft ?? j.percent_left;
      const used = j.percentUsed ?? j.percent_used;
      if (left == null && used != null) left = 100 - Number(used);
      left = Number(left);
      if (!Number.isFinite(left)) return json(400, { error: "need percentLeft or percentUsed (0-100)" });
      let resets: string | null = null;
      const ra = j.resetsAt ?? j.resets_at;
      if (ra != null) {
        let t = typeof ra === "number" ? ra : Date.parse(ra);
        if (!Number.isFinite(t)) return json(400, { error: "resetsAt must be ISO date or epoch ms" });
        if (t < 1e12) t *= 1000;
        resets = new Date(t).toISOString();
      }
      const row = { id: 1, percent_left: Math.max(0, Math.min(100, left)), resets_at: resets, plan: j.plan ? String(j.plan).slice(0, 40) : null, updated_at: new Date().toISOString() };
      const { error } = await db.from("office_usage").upsert(row);
      if (error) throw error;
      return json(200, { ok: true, usage: { percentLeft: row.percent_left, resetsAt: resets, plan: row.plan } });
    }
    return json(404, { error: "not found" });
  } catch (_e) {
    return json(500, { error: "server error" });
  }
});
