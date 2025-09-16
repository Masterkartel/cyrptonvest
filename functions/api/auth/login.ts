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
  const res = new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  return res;
}

function bad(message: string, req: Request) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function b64url(bytes: Uint8Array) {
  // URL-safe base64
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  // Handle CORS preflight if any
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
    // 1) Fetch user by email
    const userRow = await env.DB.prepare(
      `SELECT id, email, password_hash FROM users WHERE lower(email) = ? LIMIT 1`
    ).bind(email).first<{ id: string; email: string; password_hash: string }>();

    if (!userRow) {
      return bad("Invalid credentials", request);
    }

    // 2) Verify password
    const ok = await verifyPassword(password, userRow.password_hash);
    if (!ok) {
      return bad("Invalid credentials", request);
    }

    // 3) Create session
    const sidBytes = new Uint8Array(32);
    crypto.getRandomValues(sidBytes);
    const sid = b64url(sidBytes);
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 60 * 60 * 24 * 14; // 14 days
    const expiresAt = new Date((now + maxAge) * 1000).toISOString();

    await env.DB.prepare(
      `INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, datetime('now'), ?)`
    ).bind(sid, userRow.id, expiresAt).run();

    // 4) Set cookie
    const cookie =
      `${cookieName}=${sid}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Secure`;

    const headers = new Headers(corsHeaders(request));
    headers.append("Set-Cookie", cookie);

    return json(
      { ok: true, user: { id: userRow.id, email: userRow.email } },
      { headers }
    );
  } catch (err: any) {
    // Log to CF logs for debugging
    console.error("login error:", err?.message || err);
    // Never surface internals to client
    return json({ ok: false, error: "service_unavailable" }, { headers: corsHeaders(request) });
  }
};
