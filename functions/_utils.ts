// Shared helpers for Cloudflare Pages Functions

export type Env = {
  DB: D1Database;
  AUTH_COOKIE_SECRET: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  REPLY_TO?: string;
};

const COOKIE_NAME = "cv_session";

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
export function bad(message = "Bad request", status = 400) {
  return json({ ok: false, error: message }, status);
}

export function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  raw.split(/;\s*/).forEach((p) => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
  });
  return out;
}
export const cookieName = COOKIE_NAME;

export function headerSetCookie(resOrHeaders: Response | Headers, value: string) {
  if (resOrHeaders instanceof Response) resOrHeaders.headers.append("set-cookie", value);
  else resOrHeaders.append("set-cookie", value);
}

export function buildCookieFromSid(
  reqOrUrl: Request | string | URL | undefined,
  sid: string,
  maxAgeSec = 60 * 60 * 24 * 14
) {
  let domainAttr = "";
  let secureAttr = "; Secure";
  try {
    const url =
      typeof reqOrUrl === "string"
        ? new URL(reqOrUrl)
        : reqOrUrl instanceof URL
        ? reqOrUrl
        : new URL((reqOrUrl as Request)?.url || "https://x.example");
    const host = url.hostname;
    secureAttr = url.protocol === "https:" ? "; Secure" : "";
    const isPagesDev = /\.pages\.dev$/i.test(host);
    const isLocal = host === "localhost" || /^[0-9.]+$/.test(host) || host.endsWith(".localhost");
    if (!isPagesDev && !isLocal) {
      const parts = host.split(".");
      if (parts.length >= 2) {
        const registrable = parts.slice(-2).join(".");
        domainAttr = `; Domain=.${registrable}`;
      }
    }
  } catch {}
  return `${COOKIE_NAME}=${sid}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${secureAttr}${domainAttr}`;
}

function buildExpiredCookie(reqOrUrl: Request | string | URL | undefined) {
  let domainAttr = "";
  let secureAttr = "; Secure";
  try {
    const url =
      typeof reqOrUrl === "string"
        ? new URL(reqOrUrl)
        : reqOrUrl instanceof URL
        ? reqOrUrl
        : new URL((reqOrUrl as Request)?.url || "https://x.example");
    const host = url.hostname;
    secureAttr = url.protocol === "https:" ? "; Secure" : "";
    const isPagesDev = /\.pages\.dev$/i.test(host);
    const isLocal = host === "localhost" || /^[0-9.]+$/.test(host) || host.endsWith(".localhost");
    if (!isPagesDev && !isLocal) {
      const parts = host.split(".");
      if (parts.length >= 2) domainAttr = `; Domain=.${parts.slice(-2).join(".")}`;
    }
  } catch {}
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureAttr}${domainAttr}`;
}

/* hashing */
function tsc(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0; for (let i=0;i<a.length;i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
export async function sha256HexStr(s: string) {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function hashPassword(plain: string) {
  const hex = await sha256HexStr(plain);
  return `sha256$${hex}`;
}
export async function hashPasswordS256(plain: string) {
  const saltBytes = new Uint8Array(12); crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes).map(b=>b.toString(16).padStart(2,"0")).join("");
  const hex = await sha256HexStr(salt + plain);
  return `s256:${salt}$${hex}`;
}
export async function verifyPassword(plain: string, stored: string) {
  if (!stored || !plain) return false;
  try {
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$")) {
      // @ts-ignore optional
      const bcrypt = (await import("bcryptjs")).default;
      return await bcrypt.compare(plain, stored);
    }
    if (stored.startsWith("s256:")) {
      const [salt, hex] = stored.slice(5).split("$");
      if (!salt || !hex) return false;
      return tsc(await sha256HexStr(salt + plain), hex);
    }
    if (stored.startsWith("sha256$")) {
      return tsc(await sha256HexStr(plain), stored.slice(7));
    }
    if (stored.startsWith("plain:")) return tsc(stored.slice(6), plain);
    return tsc(stored, plain);
  } catch { return false; }
}
export async function hashPasswordBcrypt(plain: string) {
  try {
    // @ts-ignore optional
    const bcrypt = (await import("bcryptjs")).default;
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(plain, salt);
  } catch { return await hashPasswordS256(plain); }
}
export function isReasonablePassword(pw: string) { return typeof pw === "string" && pw.length >= 8; }

/* db */
export async function getUserByEmail(env: Env, email: string) {
  return await env.DB.prepare(
    `SELECT id, email, password_hash, created_at FROM users WHERE lower(email) = ? LIMIT 1`
  ).bind(email.toLowerCase()).first<{
    id: string; email: string; password_hash: string; created_at: number;
  }>();
}

/* sessions */
export type Session = { sub: string; email: string; role: "user" | "admin"; iat: number };

export async function getUserFromSession(req: Request, env: Env): Promise<Session | null> {
  try {
    const sid = parseCookies(req)[COOKIE_NAME];
    if (!sid) return null;
    const row = await env.DB.prepare(
      `SELECT s.id as sid, s.expires_at as exp, u.id as uid, u.email as email
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?
        LIMIT 1`
    ).bind(sid).first<{ sid: string; exp: any; uid: string; email: string }>();
    if (!row) return null;

    const nowSec = Math.floor(Date.now()/1000);
    let valid = false;
    if (typeof row.exp === "number") valid = row.exp > nowSec;
    else if (row.exp && /^\d+$/.test(String(row.exp))) valid = Number(row.exp) > nowSec;
    else if (typeof row.exp === "string") {
      const t = Date.parse(row.exp);
      valid = !Number.isNaN(t) && t/1000 > nowSec;
    }
    if (!valid) return null;

    const email = (row.email || "").toLowerCase();
    const role: "user" | "admin" =
      (env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.toLowerCase()) ? "admin" : "user";
    return { sub: row.uid, email, role, iat: nowSec };
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, env: Env): Promise<Session> {
  const sess = await getUserFromSession(req, env);
  if (!sess) throw json({ ok:false, error: "Unauthorized" }, 401);
  return sess;
}
export async function requireAdmin(req: Request, env: Env): Promise<Session> {
  const sess = await getUserFromSession(req, env);
  if (!sess || sess.role !== "admin") throw json({ ok:false, error: "Forbidden" }, 403);
  return sess;
}
export async function requireUser(req: Request, env: Env): Promise<Session | null> {
  return getUserFromSession(req, env);
}

/* session creation */
export async function createSession(
  env: Env,
  session: { sub: string; email: string; role: "user" | "admin" },
  reqOrUrl?: Request | string | URL,
  maxAgeSec = 60 * 60 * 24 * 14
): Promise<string> {
  const sidBytes = new Uint8Array(32);
  crypto.getRandomValues(sidBytes);
  const sid = btoa(String.fromCharCode(...sidBytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  const expSec = Math.floor(Date.now()/1000) + maxAgeSec;
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at)
     VALUES (?, ?, datetime('now'), ?)`
  ).bind(sid, session.sub, expSec).run();
  return buildCookieFromSid(reqOrUrl, sid, maxAgeSec);
}
export function setCookie(
  resOrHeaders: Response | Headers,
  arg2: string | Env,
  session?: { sub: string; email: string; role: "user" | "admin" } | Request | string | URL,
  reqOrUrl?: Request | string | URL | number,
  maybeMaxAge?: number
) {
  if (typeof arg2 === "string") return headerSetCookie(resOrHeaders, arg2);
  const env = arg2 as Env;
  let sess: { sub: string; email: string; role: "user" | "admin" } | undefined;
  let urlLike: Request | string | URL | undefined;
  let maxAge: number | undefined;

  if (session && typeof (session as any).sub === "string") {
    sess = session as any;
    if (typeof reqOrUrl === "number") maxAge = reqOrUrl as number;
    else { urlLike = reqOrUrl as any; maxAge = typeof maybeMaxAge === "number" ? maybeMaxAge : undefined; }
  } else {
    console.warn("setCookie: expected a session object as 3rd argument");
    return;
  }
  createSession(env, sess, urlLike, maxAge).then((cookie) => headerSetCookie(resOrHeaders, cookie));
}
export function destroySession(resOrHeaders: Response | Headers, reqOrUrl?: Request | string | URL) {
  headerSetCookie(resOrHeaders, buildExpiredCookie(reqOrUrl));
}
