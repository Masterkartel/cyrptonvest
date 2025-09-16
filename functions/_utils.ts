// Cloudflare Pages Functions shared helpers
// Works without extra deps. Keeps the same cookie + JSON style used by the app.

export type Env = {
  DB: D1Database;
  AUTH_COOKIE_SECRET: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
};

const COOKIE_NAME = "cv_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/* ------------------------ Small response helpers ------------------------ */
export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
export function bad(message = "Bad request", status = 400) {
  return json({ error: message }, status);
}

/* ----------------------------- Cookies & auth ---------------------------- */
export function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  raw.split(/;\s*/).forEach((p) => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
  });
  return out;
}

function toBase64(u8: Uint8Array) {
  // atob/btoa need strings; use URL-safe base64
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

export async function setCookie(res: Response, env: Env, session: Session) {
  const token = await signSession(env, session);
  res.headers.append(
    "set-cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
  );
}
export function clearCookie(res: Response) {
  res.headers.append(
    "set-cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

export async function requireUser(req: Request, env: Env) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  return await verifySession(env, token);
}
export async function requireAdmin(req: Request, env: Env) {
  const sess = await requireUser(req, env);
  if (!sess || sess.role !== "admin") return null;
  return sess;
}

/* ----------------------------- Password utils ---------------------------- */
// Supports either plain compare, or sha256$<hex> stored hashes (for D1 rows).
export async function hashPassword(plain: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256$${hex}`;
}
export async function verifyPassword(plain: string, stored: string) {
  if (!stored || !plain) return false;
  if (stored.startsWith("sha256$")) {
    const want = stored.slice("sha256$".length);
    const gotBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
    const got = Array.from(new Uint8Array(gotBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return got === want;
  }
  // fallback to plain equality
  return plain === stored;
}

/* ----------------------------- D1 convenience ---------------------------- */
export async function getUserByEmail(env: Env, email: string) {
  return await env.DB.prepare(
    `SELECT id, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1`
  )
    .bind(email.toLowerCase())
    .first<{ id: string; email: string; password_hash: string; created_at: number }>();
}

// Some code was importing `db` earlier. Export a tiny façade so imports don't break.
export const db = {
  getUserByEmail: (env: Env, email: string) => getUserByEmail(env, email),
};
