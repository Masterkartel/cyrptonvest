// functions/_utils.ts
export type Env = {
  DB: D1Database;
  ADMIN_EMAIL?: string;
  SESSION_COOKIE_NAME?: string;
  SESSION_TTL_SECONDS?: string;
};

/* ---------------- HTTP helpers ---------------- */
export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
export function bad(message = "Bad Request", status = 400) {
  return json({ error: message }, status);
}

/* ---------------- Cookies ---------------- */
export function parseCookies(req: Request): Record<string, string> {
  const cookie = req.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  cookie.split(";").forEach((kv) => {
    const i = kv.indexOf("=");
    if (i > -1) out[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1));
  });
  return out;
}
export function setCookie(
  name: string,
  value: string,
  opts: { httpOnly?: boolean; secure?: boolean; path?: string; sameSite?: "Lax"|"Strict"|"None"; maxAge?: number } = {}
) {
  const p = opts.path ?? "/";
  const httpOnly = opts.httpOnly !== false;
  const secure = opts.secure !== false;
  const same = opts.sameSite ?? "Lax";
  const max = opts.maxAge ? `; Max-Age=${opts.maxAge}` : "";
  return `${name}=${encodeURIComponent(value)}; Path=${p}${max}; SameSite=${same}${secure ? "; Secure" : ""}${httpOnly ? "; HttpOnly" : ""}`;
}
export function clearCookie(name: string, path = "/") {
  return `${name}=; Path=${path}; Max-Age=0; SameSite=Lax`;
}

/* ---------------- Passwords ---------------- */
async function sha256(txt: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const SALT = "cv_static_salt_v1";
export async function hashPassword(pw: string) {
  return await sha256(SALT + ":" + pw);
}
export async function verifyPassword(pw: string, hashed: string) {
  return (await hashPassword(pw)) === hashed;
}

/* ---------------- Sessions ---------------- */
function cookieName(env: Env) {
  return env.SESSION_COOKIE_NAME || "cv_sid";
}
function ttl(env: Env) {
  return parseInt(env.SESSION_TTL_SECONDS || "2592000", 10) || 2592000;
}
export async function createSession(env: Env, userId: string) {
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO sessions (id,user_id,created_at) VALUES (?,?,?)`)
    .bind(id, userId, Date.now())
    .run();
  return id;
}
export async function destroySession(env: Env, sid: string) {
  await env.DB.prepare(`DELETE FROM sessions WHERE id=?`).bind(sid).run();
}
export async function getUserFromSession(env: Env, req: Request) {
  const sid = parseCookies(req)[cookieName(env)];
  if (!sid) return null;
  const row = await env.DB.prepare(
    `SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? LIMIT 1`
  ).bind(sid).first<{ id: string; email: string }>();
  return row || null;
}

/* ---------------- Guards ---------------- */
export async function requireAuth(env: Env, req: Request) {
  const user = await getUserFromSession(env, req);
  if (!user) return { ok: false as const, res: json({ error: "Unauthorized" }, 401) };
  return { ok: true as const, user };
}
export async function requireAdmin(env: Env, req: Request) {
  const g = await requireAuth(env, req);
  if (!g.ok) return g;
  const adminEmail = (env.ADMIN_EMAIL || "support@cyrptonvest.com").toLowerCase();
  if (g.user.email?.toLowerCase() !== adminEmail) {
    return { ok: false as const, res: json({ error: "Forbidden" }, 403) };
  }
  return g;
}

/* ---------------- Header util ---------------- */
export function headerSetCookie(res: Response, setCookieValue: string) {
  const h = new Headers(res.headers);
  h.append("Set-Cookie", setCookieValue);
  return new Response(res.body, { status: res.status, headers: h });
}
