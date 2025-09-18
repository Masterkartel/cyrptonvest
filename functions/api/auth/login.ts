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

  // Preflight
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
    // 2) Look up user (defensive: coalesce email to empty string)
    const user = await env.DB.prepare(
      `SELECT id, COALESCE(email,'') AS email, COALESCE(password_hash,'') AS password_hash
         FROM users
        WHERE lower(email) = ?
        LIMIT 1`
    )
      .bind(email)
      .first<{ id: string; email: string; password_hash: string }>();

    if (!user || !user.id) return bad("Invalid credentials", 400);

    // 3) Verify password (handles bcrypt/s256/legacy/plain)
    const ok = await verifyPassword(password, user.password_hash || "");
    if (!ok) return bad("Invalid credentials", 400);

    // 4) Determine role (never throw on weird/null values)
    const userEmailLc = String(user.email || "").trim().toLowerCase();
    const adminEmailLc = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
    const role: "user" | "admin" = adminEmailLc && userEmailLc === adminEmailLc ? "admin" : "user";

    // 5) Create session + cookie (guard against failures)
    let cookie = "";
    try {
      cookie = await createSession(
        env,
        { sub: user.id, email: userEmailLc, role },
        request
      );
    } catch (e) {
      console.error("createSession error:", e);
      return bad("service_unavailable", 503);
    }

    // 6) Respond
    const res = json({ ok: true, user: { id: user.id, email: userEmailLc, role } });
    headerSetCookie(res, cookie);
    return res;
  } catch (err: any) {
    console.error("login error:", err?.message || err);
    return bad("service_unavailable", 503);
  }
};
