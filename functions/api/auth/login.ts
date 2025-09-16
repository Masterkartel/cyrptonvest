// functions/api/auth/login.ts
import { verifyPassword, cookieName, type Env } from "../../_utils";

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

function bad(message: string, req: Request) {
  return json({ ok: false, error: message }, { status: 400, headers: corsHeaders(req) });
}

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Build a cookie that works on apex+subdomains and HTTPS */
function buildSessionCookie(req: Request, sid: string, maxAgeSec: number) {
  const url = new URL(req.url);
  const host = url.hostname; // e.g. "www.cyrptonvest.com" or "cyrptonvest.pages.dev"

  // Decide if we should set a Domain attribute:
  // - For custom domains, scope to the registrable domain (".cyrptonvest.com")
  // - For *.pages.dev we skip Domain so it’s host-only (that’s safer there)
  let domainAttr = "";
  const isPagesDev = /\.pages\.dev$/i.test(host);
  if (!isPagesDev) {
    const parts = host.split(".");
    if (parts.length >= 2) {
      const registrable = parts.slice(-2).join("."); // "cyrptonvest.com"
      domainAttr = `; Domain=.${registrable}`;
    }
  }

  const secureAttr = url.protocol === "https:" ? "; Secure" : "";
  return `${cookieName}=${sid}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${secureAttr}${domainAttr}`;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

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
    // Lookup user
    const userRow = await env.DB.prepare(
      `SELECT id, email, password_hash FROM users WHERE lower(email) = ? LIMIT 1`
    ).bind(email).first<{ id: string; email: string; password_hash: string }>();

    if (!userRow) return bad("Invalid credentials", request);

    // Check password
    const ok = await verifyPassword(password, userRow.password_hash);
    if (!ok) return bad("Invalid credentials", request);

    // Create DB-backed session (SID)
    const sidBytes = new Uint8Array(32);
    crypto.getRandomValues(sidBytes);
    const sid = b64url(sidBytes);

    const nowSec = Math.floor(Date.now() / 1000);
    const maxAge = 60 * 60 * 24 * 14; // 14 days
    const expSec = nowSec + maxAge;

    await env.DB.prepare(
      `INSERT INTO sessions (id, user_id, created_at, expires_at)
       VALUES (?, ?, datetime('now'), ?)`
    ).bind(sid, userRow.id, expSec).run();

    // Set cookie with correct domain/samesite/secure
    const headers = new Headers(corsHeaders(request));
    headers.append("Set-Cookie", buildSessionCookie(request, sid, maxAge));

    return json({ ok: true, user: { id: userRow.id, email: userRow.email } }, { headers });
  } catch (err: any) {
    console.error("login error:", err?.message || err);
    return json({ ok: false, error: "service_unavailable" }, { headers: corsHeaders(request), status: 503 });
  }
};
