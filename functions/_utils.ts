// functions/_utils.ts
// Shared helpers for Cloudflare Pages Functions

export type Env = {
  DB: D1Database;
  AUTH_COOKIE_SECRET: string; // kept for backwards compat; not used by DB sessions
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;

  // Optional for email sending (Resend)
  RESEND_API_KEY?: string;          // re_****************
  MAIL_FROM?: string;               // e.g. "Cyrptonvest <noreply@cyrptonvest.com>"
  REPLY_TO?: string;                // e.g. "support@cyrptonvest.com"
};

const COOKIE_NAME = "cv_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/* ─────────────── Response helpers ─────────────── */
export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
export function bad(message = "Bad request", status = 400) {
  return json({ ok: false, error: message }, status);
}

/* ─────────────── Cookie helpers ─────────────── */
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

/* ─────────────── Password / hashing helpers ─────────────── */

// Constant-time compare to avoid timing leaks
function tsc(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// sha256 hex
export async function sha256HexStr(s: string) {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Original (legacy) hash function: unsalted sha256$<hex> */
export async function hashPassword(plain: string) {
  const hex = await sha256HexStr(plain);
  return `sha256$${hex}`;
}

/** Stronger salted hash used by reset flow if bcrypt isn't available */
export async function hashPasswordS256(plain: string) {
  const saltBytes = new Uint8Array(12);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hex = await sha256HexStr(salt + plain);
  return `s256:${salt}$${hex}`;
}

/**
 * Tries multiple formats:
 * - bcrypt: "$2a$" / "$2b$"  (only if bcryptjs present)
 * - salted sha256: "s256:<salt>$<hex>"
 * - legacy sha256: "sha256$<hex>"
 * - plain: "plain:<pw>" or bare match
 */
export async function verifyPassword(plain: string, stored: string) {
  if (!stored || !plain) return false;

  try {
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$")) {
      // @ts-ignore dynamic import optional
      const bcrypt = (await import("bcryptjs")).default;
      return await bcrypt.compare(plain, stored);
    }
    if (stored.startsWith("s256:")) {
      const rest = stored.slice(5);
      const [salt, hex] = rest.split("$");
      if (!salt || !hex) return false;
      const digest = await sha256HexStr(salt + plain);
      return tsc(digest, hex);
    }
    if (stored.startsWith("sha256$")) {
      const want = stored.slice(7);
      const got = await sha256HexStr(plain);
      return tsc(got, want);
    }
    if (stored.startsWith("plain:")) return tsc(stored.slice(6), plain);
    return tsc(stored, plain);
  } catch (e) {
    console.error("verifyPassword error:", e);
    return false;
  }
}

/** Preferred hasher for resets: bcrypt if available; fallback to s256 */
export async function hashPasswordBcrypt(plain: string) {
  try {
    // @ts-ignore optional
    const bcrypt = (await import("bcryptjs")).default;
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(plain, salt);
  } catch {
    return await hashPasswordS256(plain);
  }
}

/** Minimal password strength rule (tweak if you want) */
export function isReasonablePassword(pw: string) {
  return typeof pw === "string" && pw.length >= 8;
}

/* ─────────────── Email helper (Resend) ─────────────── */
export async function sendEmail(env: Env, to: string, subject: string, html: string) {
  if (env.RESEND_API_KEY && env.MAIL_FROM) {
    const payload: Record<string, unknown> = {
      from: env.MAIL_FROM, // e.g. "Cyrptonvest <noreply@cyrptonvest.com>"
      to: [to],
      subject,
      html,
    };
    if (env.REPLY_TO) payload.reply_to = env.REPLY_TO;

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

/* ─────────────── D1 convenience ─────────────── */
export async function getUserByEmail(env: Env, email: string) {
  return await env.DB.prepare(
    `SELECT id, email, password_hash, created_at FROM users WHERE lower(email) = ? LIMIT 1`
  ).bind(email.toLowerCase()).first<{
    id: string; email: string; password_hash: string; created_at: number;
  }>();
}

/**
 * db – flexible export:
 *  - call like a function:   db(env).prepare("SELECT 1")
 *  - or legacy helper:       db.getUserByEmail(env, email)
 */
export const db: any = (env: Env) => env.DB;
db.getUserByEmail = (env: Env, email: string) => getUserByEmail(env, email);

/* ─────────────── Sessions (DB-backed) ─────────────── */

export type Session = { sub: string; email: string; role: "user" | "admin"; iat: number };

/**
 * Read session from D1 using the cookie SID.
 * Supports expires_at stored either as:
 *   - UNIX seconds (INTEGER)  → compare numerically
 *   - ISO datetime/text       → compare against current unix seconds if it's numeric-like,
 *                               otherwise treat as expired when < now via DATETIME.
 */
export async function getUserFromSession(req: Request, env: Env): Promise<Session | null> {
  try {
    const sid = parseCookies(req)[COOKIE_NAME];
    if (!sid) return null;

    // Join sessions → users
    const row = await env.DB.prepare(
      `SELECT s.id as sid, s.expires_at as exp, u.id as uid, u.email as email
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?
        LIMIT 1`
    ).bind(sid).first<{ sid: string; exp: any; uid: string; email: string }>();

    if (!row) return null;

    const nowSec = Math.floor(Date.now() / 1000);

    // Handle both integer and string expiry formats
    let valid = false;
    if (typeof row.exp === "number") {
      valid = row.exp > nowSec;
    } else if (row.exp && /^\d+$/.test(String(row.exp))) {
      valid = Number(row.exp) > nowSec;
    } else if (typeof row.exp === "string") {
      // If it's an ISO string, parse it; if parse fails, consider expired
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

/** Require a logged-in user (uses DB-backed sessions) */
export async function requireAuth(req: Request, env: Env): Promise<Session> {
  const sess = await getUserFromSession(req, env);
  if (!sess) throw json({ error: "Unauthorized" }, 401);
  return sess;
}

/** Alias – returns session or null */
export async function requireUser(req: Request, env: Env) {
  return getUserFromSession(req, env);
}

/** Admin guard based on ADMIN_EMAIL match */
export async function requireAdmin(req: Request, env: Env) {
  const sess = await getUserFromSession(req, env);
  if (!sess || sess.role !== "admin") throw json({ error: "Forbidden" }, 403);
  return sess;
}

/* ─────────────── Cookie builders (if you need to set from here) ─────────────── */
export function buildCookieFromSid(req: Request, sid: string, maxAgeSec = COOKIE_MAX_AGE) {
  const url = new URL(req.url);
  const host = url.hostname;
  const isPagesDev = /\.pages\.dev$/i.test(host);
  let domainAttr = "";
  if (!isPagesDev) {
    const parts = host.split(".");
    if (parts.length >= 2) {
      const registrable = parts.slice(-2).join(".");
      domainAttr = `; Domain=.${registrable}`;
    }
  }
  const secureAttr = url.protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${sid}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${secureAttr}${domainAttr}`;
}

/* ─────────────── Reset helpers (tokens) ─────────────── */
export function randomTokenHex(len = 32): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}
