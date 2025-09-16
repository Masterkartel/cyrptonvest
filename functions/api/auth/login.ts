// functions/api/auth/login.ts
import { verifyPassword, cookieName, type Env } from "../../_utils";

/* ────────────────────────── Helpers ────────────────────────── */
function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

function bad(message: string, req: Request, status = 400) {
  return json({ ok: false, error: message }, { status, headers: corsHeaders(req) });
}

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/* ────────────────────────── Handler ────────────────────────── */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  // Parse body
  let email = "";
  let password = "";
  try {
    const body = await request.json<any>();
    email = String(body?.email || "").trim().toLowerCase();
    password = String(body?.password || "");
    if (!email || !password) return bad("Email and password are required", request);
  } catch {
    return bad("Invalid JSON body", request);
  }

  try {
    // 1) Lookup user
    const userRow = await env.DB.prepare(
      `SELECT id, email, password_hash FROM users WHERE lower(email) = ? LIMIT 1`
    )
      .bind(email)
      .first<{ id: string; email: string; password_hash: string }>();

    if (!userRow) return bad("Invalid credentials", request);

    // 2) Verify password (supports sha256$, s256:, bcrypt, etc.)
    const ok = await verifyPassword(password, userRow.password_hash);
    if (!ok) return bad("Invalid credentials", request);

    // 3) Create DB session (SID + ISO expiry that _utils can read)
    const sidBytes = new Uint8Array(32);
    crypto.getRandomValues(sidBytes);
    const sid = b64url(sidBytes);

    const maxAge = 60 * 60 * 24 * 14; // 14 days
    const expiresAtISO = new Date(Date.now() + maxAge * 1000).toISOString();

    await env.DB.prepare(
      `INSERT INTO sessions (id, user_id, created_at, expires_at)
       VALUES (?, ?, datetime('now'), ?)`
    )
      .bind(sid, userRow.id, expiresAtISO)
      .run();

    // 4) Craft cookie (include Domain so cookie works on apex + subdomains)
    const url = new URL(request.url);
    const host = url.hostname;
    // Derive a sane cookie domain like ".example.com" (skip if localhost or single-label)
    let domainAttr = "";
    if (host.includes(".") && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      const parts = host.split(".");
      const base = parts.slice(-2).join("."); // example.com
      domainAttr = `; Domain=.${base}`;
    }
    const cookie = `${cookieName}=${sid}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Secure${domainAttr}`;

    const headers = new Headers(corsHeaders(request));
    headers.append("Set-Cookie", cookie);

    // 5) Return minimal user info
    return json(
      { ok: true, user: { id: userRow.id, email: userRow.email } },
      { headers }
    );
  } catch (err: any) {
    console.error("login error:", err?.message || err);
    return bad("service_unavailable", request, 503);
  }
};
