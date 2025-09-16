// functions/_utils.ts
// Shared helpers for Cloudflare Pages Functions

export type Env = {
  DB: D1Database;
  AUTH_COOKIE_SECRET: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;

  // Email (Resend)
  RESEND_API_KEY?: string;          // re_****************
  MAIL_FROM?: string;               // e.g. "Cyrptonvest <noreply@cyrptonvest.com>"
  REPLY_TO?: string;                // e.g. "support@cyrptonvest.com"
};

const COOKIE_NAME = "cv_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/* ───────────────────────── Response helpers ──────────────────────────── */
export function json(
  data: unknown,
  status: number = 200,
  headers: HeadersInit = {}
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
export function bad(message = "Bad request", status = 400) {
  return json({ ok: false, error: message }, status);
}

/* ───────────────────────── Cookie helpers ────────────────────────────── */
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
  if (resOrHeaders instanceof Response) {
    resOrHeaders.headers.append("set-cookie", value);
  } else {
    resOrHeaders.append("set-cookie", value);
  }
}

/* ───────────────────── Token (HMAC, URL-safe b64) ───────────────────── */
function toBase64(u8: Uint8Array) {
  let str = "";
  u8.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const bin = atob(s + "=".repeat(pad));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return toBase64(new Uint8Array(sig));
}

/* ───────────────────────── Sessions (two formats) ────────────────────── */
// 1) Legacy signed cookie (payload.signature)
export type Session = { sub: string; email: string; role: "user" | "admin"; iat: number };

export async function signSession(env: Env, session: Session) {
  const payload = toBase64(new TextEncoder().encode(JSON.stringify(session)));
  const sig = await hmac(env.AUTH_COOKIE_SECRET, payload);
  return `${payload}.${sig}`;
}
export async function verifySession(env: Env, token: string): Promise<Session | null> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expSig = await hmac(env.AUTH_COOKIE_SECRET, payload);
  if (sig !== expSig) return null;
  try {
    const jsonStr = new TextDecoder().decode(fromBase64(payload));
    const sess = JSON.parse(jsonStr) as Session;
    if (!sess?.sub || !sess?.email || !sess?.role) return null;
    return sess;
  } catch {
    return null;
  }
}
function buildCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}
export async function setCookie(res: Response, env: Env, session: Session) {
  const token = await signSession(env, session);
  headerSetCookie(res, buildCookie(token));
}
export function clearCookie(res: Response) {
  headerSetCookie(res, `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
export async function createSession(env: Env, session: Session) {
  const token = await signSession(env, session);
  return buildCookie(token);
}
export function destroySession(res: Response) {
  clearCookie(res);
}

// 2) New DB session cookie (opaque SID stored in D1 `sessions`)
type DbSessionRow = {
  id: string;          // SID
  user_id: string;
  expires_at: string;  // ISO
};
type DbUserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  role?: string | null; // optional role column
};

/** Look up SID in D1 and join user */
async function loadSessionFromDB(env: Env, sid: string): Promise<Session | null> {
  const row = await env.DB.prepare(
    `SELECT id, user_id, expires_at FROM sessions WHERE id = ? LIMIT 1`
  ).bind(sid).first<DbSessionRow | null>();

  if (!row) return null;
  // Expiry check (defensive; DB may already purge)
  if (row.expires_at) {
    const expMs = Date.parse(row.expires_at);
    if (Number.isFinite(expMs) && Date.now() > expMs) return null;
  }

  const user = await env.DB.prepare(
    `SELECT id, email, password_hash, COALESCE(role,'user') AS role FROM users WHERE id = ? LIMIT 1`
  ).bind(row.user_id).first<DbUserRow | null>();

  if (!user) return null;

  // Build Session shape expected by the app
  return {
    sub: user.id,
    email: user.email,
    role: (user.role === "admin" ? "admin" : "user"),
    iat: Math.floor(Date.now() / 1000),
  };
}

/* ────────────────────── Auth guards / accessors ──────────────────────── */
/**
 * Accepts BOTH:
 *  - legacy token (contains a ".") → verifySession
 *  - DB SID (opaque, no ".") → lookup in D1 `sessions` and `users`
 */
export async function getUserFromSession(req: Request, env: Env) {
  const sidOrToken = parseCookies(req)[COOKIE_NAME];
  if (!sidOrToken) return null;

  if (sidOrToken.includes(".")) {
    // legacy signed cookie
    return await verifySession(env, sidOrToken);
  } else {
    // new DB session id
    return await loadSessionFromDB(env, sidOrToken);
  }
}

export async function requireAuth(req: Request, env: Env): Promise<Session> {
  const sess = await getUserFromSession(req, env);
  if (!sess) throw json({ error: "Unauthorized" }, 401);
  return sess;
}
export async function requireUser(req: Request, env: Env) {
  return getUserFromSession(req, env);
}
export async function requireAdmin(req: Request, env: Env) {
  const sess = await getUserFromSession(req, env);
  if (!sess || sess.role !== "admin") throw json({ error: "Forbidden" }, 403);
  return sess;
}

/* ───────────────────── Password / hashing helpers ────────────────────── */
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
  const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2,"0")).join("");
  const hex = await sha256HexStr(salt + plain);
  return `s256:${salt}$${hex}`;
}
export async function verifyPassword(plain: string, stored: string) {
  if (!stored || !plain) return false;
  try {
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$")) {
      // @ts-ignore
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
export async function hashPasswordBcrypt(plain: string) {
  try {
    // @ts-ignore
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

/* ───────────────────────── Email helper (Resend) ─────────────────────── */
export async function sendEmail(env: Env, to: string, subject: string, html: string) {
  if (env.RESEND_API_KEY && env.MAIL_FROM) {
    const payload: Record<string, unknown> = {
      from: env.MAIL_FROM,
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

/* ─────────────────────────── D1 helpers ──────────────────────────────── */
export async function getUserByEmail(env: Env, email: string) {
  return await env.DB.prepare(
    `SELECT id, email, password_hash, created_at FROM users WHERE lower(email) = ? LIMIT 1`
  ).bind(email.toLowerCase()).first<{
    id: string; email: string; password_hash: string; created_at: number;
  }>();
}
export const db: any = (env: Env) => env.DB;
db.getUserByEmail = (env: Env, email: string) => getUserByEmail(env, email);

/* ───────────────────────── Reset helpers (tokens) ────────────────────── */
export function randomTokenHex(len = 32): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}
