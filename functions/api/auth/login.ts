// functions/api/auth/login.ts
import {
  json,
  bad,
  createSession,
  headerSetCookie,
  verifyPassword,
  ensureSessionsTable,
  type Env,
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  // CORS preflight passthrough (middleware should set headers)
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // 1) Parse input
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
    // 2) Ensure sessions table exists with correct schema
    await ensureSessionsTable(env);

    // 3) Lookup user (defensive coalescing)
    const user = await env.DB.prepare(
      `SELECT id,
              COALESCE(email,'')          AS email,
              COALESCE(password_hash,'')  AS password_hash
         FROM users
        WHERE lower(email) = ?
        LIMIT 1`
    )
      .bind(email)
      .first<{ id: string; email: string; password_hash: string }>();

    if (!user?.id) return bad("Invalid credentials", 400);

    // 4) Verify password
    const ok = await verifyPassword(password, user.password_hash || "");
    if (!ok) return bad("Invalid credentials", 400);

    // 5) Role
    const userEmailLc = (user.email || "").toLowerCase();
    const adminEmailLc = String(env.ADMIN_EMAIL || "").toLowerCase();
    const role: "user" | "admin" = adminEmailLc && userEmailLc === adminEmailLc ? "admin" : "user";

    // 6) Create session (INTEGER timestamps)
    let cookie = "";
    try {
      cookie = await createSession(env, { sub: user.id, email: userEmailLc, role }, request);
    } catch (e) {
      console.error("createSession failed (first try):", e);
      // Re-ensure and try once more
      await ensureSessionsTable(env);
      cookie = await createSession(env, { sub: user.id, email: userEmailLc, role }, request);
    }

    // 7) Reply OK
    const res = json({ ok: true, user: { id: user.id, email: userEmailLc, role } });
    headerSetCookie(res, cookie);
    return res;
  } catch (err: any) {
    console.error("login error:", err?.message || err);
    return bad("service_unavailable", 503);
  }
};
