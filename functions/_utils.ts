// functions/_utils.ts
// Shared helpers for Cloudflare Pages Functions

export type Env = {
  DB: D1Database;
  AUTH_COOKIE_SECRET: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;

  // Optional email (Resend)
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  REPLY_TO?: string;
};

const COOKIE_NAME = "cv_session";

/* ═════════ Response helpers ═════════ */
export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
export function bad(message = "Bad request", status = 400) {
  return json({ ok: false, error: message }, status);
}

/* ═════════ Cookies ═════════ */
export function parseCookies(req: Request | string): Record<string, string> {
  const raw = typeof req === "string" ? req : (req.headers.get("cookie") || "");
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

/** Build cookie string with domain/secure heuristics for Pages */
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
  } catch {
    // ignore
  }
  return `${COOKIE_NAME}=${sid}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${secureAttr}${domainAttr}`;
}

/** Build an expired cookie (for logout) */
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

/* ═════════ Password / hashing ═════════ */

// Constant-time compare
function tsc(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function sha256HexStr(s: string) {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(plain: string) {
  const hex = await sha256HexStr(plain);
  return `sha256$${hex}`;
}
export async function hashPasswordS256(plain: string) {
  const saltBytes = new Uint8Array(12);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hex = await sha256HexStr(salt + plain);
  return `s256:${salt}$${hex}`;
}

/**
 * Tries multiple formats:
 * - bcrypt: "$2a$" / "$2b$" (optional dep)
 * - salted sha256: "s256:<salt>$<hex>"
 * - legacy sha256: "sha256$<hex>"
 * - plain: "plain:<pw>" or bare match
 */
export async function verifyPassword(plain: string, stored: string) {
  if (!stored || !plain) return false;
  try {
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$")) {
      // @ts-ignore optional dep
      const bcrypt = (await import("bcryptjs")).default;
      return await bcrypt.compare(plain, stored);
    }
    if (stored.startsWith("s256:")) {
      const [salt, hex] = stored.slice(5).split("$");
      if (!salt || !hex) return false;
      const digest = await sha256HexStr(salt + plain);
      return tsc(digest, hex);
    }
    if (stored.startsWith("sha256$")) {
      const got = await sha256HexStr(plain);
      return tsc(got, stored.slice(7));
    }
    if (stored.startsWith("plain:")) return tsc(stored.slice(6), plain);
    return tsc(stored, plain);
  } catch (e) {
    console.error("verifyPassword error:", e);
    return false;
  }
}

export async function hashPasswordBcrypt(plain: string) {
  try {
    // @ts-ignore optional dep
    const bcrypt = (await import("bcryptjs")).default;
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(plain, salt);
  } catch {
    return await hashPasswordS256(plain);
  }
}
export function isReasonablePassword(pw: string) {
  return typeof pw === "string" && pw.length >= 8;
}

/* ═════════ Email (Resend) ═════════ */
export async function sendEmail(env: Env, to: string, subject: string, html: string) {
  if (env.RESEND_API_KEY && env.MAIL_FROM) {
    const payload: Record<string, unknown> = {
      from: env.MAIL_FROM,
      to: [to],
      subject,
      html,
      ...(env.REPLY_TO ? { reply_to: env.REPLY_TO } : {}),
    };
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.warn("sendEmail failed:", r.status, text);
    }
    return;
  }
  console.log(`[EMAIL][TEST] to=${to} subject="${subject}"\n${html}`);
}

/* ═════════ D1 convenience ═════════ */
export async function getUserByEmail(env: Env, email: string) {
  return await env.DB.prepare(
    `SELECT id, email, password_hash, created_at FROM users WHERE lower(email) = ? LIMIT 1`
  )
    .bind(email.toLowerCase())
    .first<{ id: string; email: string; password_hash: string; created_at: number }>();
}

/** Flexible export: db(env) => env.DB */
export const db: any = (env: Env) => env.DB;
db.getUserByEmail = (env: Env, email: string) => getUserByEmail(env, email);

/* ═════════ Sessions (DB-backed) ═════════ */

export type Session = { sub: string; email: string; role: "user" | "admin"; iat: number };

/** Ensure sessions table exists with INTEGER timestamps (matches your PRAGMA). */
export async function ensureSessionsTable(env: Env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS sessions (
       id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL,
       created_at INTEGER NOT NULL,
       expires_at INTEGER NOT NULL
     )`
  ).run();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`
  ).run();
}

/** Create a new session (uses UNIX seconds for created_at / expires_at). */
export async function createSession(
  env: Env,
  session: { sub: string; email: string; role: "user" | "admin" },
  reqOrUrl?: Request | string | URL,
  maxAgeSec = 60 * 60 * 24 * 14
): Promise<string> {
  await ensureSessionsTable(env);

  const sidBytes = new Uint8Array(32);
  crypto.getRandomValues(sidBytes);
  const sid = btoa(String.fromCharCode(...sidBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + maxAgeSec;

  // IMPORTANT: created_at INTEGER via strftime('%s','now')
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at)
     VALUES (?, ?, strftime('%s','now'), ?)`
  )
    .bind(sid, session.sub, expSec)
    .run();

  return buildCookieFromSid(reqOrUrl, sid, maxAgeSec);
}

/** Read session; returns null if missing/expired */
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
    )
      .bind(sid)
      .first<{ sid: string; exp: any; uid: string; email: string }>();

    if (!row) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    let valid = false;

    if (typeof row.exp === "number") valid = row.exp > nowSec;
    else if (row.exp && /^\d+$/.test(String(row.exp))) valid = Number(row.exp) > nowSec;
    else if (typeof row.exp === "string") {
      const t = Date.parse(row.exp);
      valid = !Number.isNaN(t) && t / 1000 > nowSec;
    }

    if (!valid) return null;

    const email = (row.email || "").toLowerCase();
    const role: "user" | "admin" =
      env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.toLowerCase() ? "admin" : "user";

    return { sub: row.uid, email, role, iat: nowSec };
  } catch (e) {
    console.warn("getUserFromSession error:", e);
    return null;
  }
}

/** Require a logged-in user */
export async function requireAuth(req: Request, env: Env): Promise<Session> {
  const sess = await getUserFromSession(req, env);
  if (!sess) throw json({ ok: false, error: "Unauthorized" }, 401);
  return sess;
}
export async function requireAdmin(req: Request, env: Env) {
  const sess = await getUserFromSession(req, env);
  if (!sess || sess.role !== "admin") throw json({ ok: false, error: "Forbidden" }, 403);
  return sess;
}
/** Optional nullable session */
export async function requireUser(req: Request, env: Env) {
  return getUserFromSession(req, env);
}

/** Destroy the *record* (DB) for a cookie SID */
export async function destroySessionRecord(env: Env, sid: string) {
  try {
    await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sid).run();
  } catch (e) {
    console.warn("destroySessionRecord error:", e);
  }
}

/** Destroy cookie on the client */
export function destroySession(resOrHeaders: Response | Headers, reqOrUrl?: Request | string | URL) {
  const expired = buildExpiredCookie(reqOrUrl);
  headerSetCookie(resOrHeaders, expired);
}

/* ═════════ Misc ═════════ */
export function randomTokenHex(len = 32): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
