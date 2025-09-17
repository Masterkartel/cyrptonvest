// functions/api/auth/login.ts
import {
  json,
  bad,
  createSession,
  headerSetCookie,
  verifyPassword,
  type Env,
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  // Handle OPTIONS quickly (CORS preflight is set in _middleware)
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // 1) Parse & validate body
  let email = "";
  let password = "";
  try {
    const body = await request.json<any>();
    email = String(body?.email || "").trim().toLowerCase();
    password = String(body?.password || "");
    if (!email || !password) return bad("Email and password are required", 400);
  } catch {
    return bad("Invalid JSON body", 400);
  }

  try {
    // 2) Look up user
    const user = await env.DB.prepare(
      `SELECT id, email, password_hash FROM users WHERE lower(email) = ? LIMIT 1`
    )
      .bind(email)
      .first<{ id: string; email: string; password_hash: string }>();

    if (!user) return bad("Invalid credentials", 400);

    // 3) Verify password
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return bad("Invalid credentials", 400);

    // 4) Determine role (email match to ADMIN_EMAIL is admin)
    const adminEmail = (env.ADMIN_EMAIL || "").toLowerCase();
    const role: "user" | "admin" =
      adminEmail && user.email.toLowerCase() === adminEmail ? "admin" : "user";

    // 5) Create session (stored in D1) and build cookie for this host
    const cookie = await createSession(
      env,
      { sub: user.id, email: user.email, role, iat: Math.floor(Date.now() / 1000) },
      request
    );

    // 6) Respond
    const res = json({ ok: true, user: { id: user.id, email: user.email, role } });
    headerSetCookie(res, cookie);
    return res;
  } catch (err: any) {
    console.error("login error:", err?.message || err);
    return bad("service_unavailable", 503);
  }
};
