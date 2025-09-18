// functions/api/auth/login.ts
import {
  json,
  bad,
  createSession,
  headerSetCookie,
  verifyPassword,
  type Env,
} from "../../_utils";

/** Make sure the sessions table exists (prevents 503 on first logins). */
async function ensureSessionsTable(env: Env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS sessions (
       id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL,
       created_at TEXT DEFAULT (datetime('now')),
       expires_at INTEGER NOT NULL
     )`
  ).run();
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  // Preflight (CORS OPTIONS is handled by middleware; just 204 here)
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
    // 2) Ensure sessions table exists (avoids insert errors later)
    await ensureSessionsTable(env);

    // 3) Look up user defensively
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

    if (!user?.id) {
      // Keep generic message for security
      return bad("Invalid credentials", 400);
    }

    // 4) Verify password (supports bcrypt, s256, sha256, plain)
    let ok = false;
    try {
      ok = await verifyPassword(password, user.password_hash || "");
    } catch (e) {
      console.error("verifyPassword error:", e);
      // Treat as invalid creds rather than 503
      return bad("Invalid credentials", 400);
    }
    if (!ok) return bad("Invalid credentials", 400);

    // 5) Determine role safely
    const userEmailLc = String(user.email || "").trim().toLowerCase();
    const adminEmailLc = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
    const role: "user" | "admin" =
      adminEmailLc && userEmailLc === adminEmailLc ? "admin" : "user";

    // 6) Create session + cookie
    let cookie: string;
    try {
      cookie = await createSession(
        env,
        { sub: user.id, email: userEmailLc, role },
        request
      );
    } catch (e) {
      console.error("createSession() failed:", e);
      // If session insert failed for any reason, try once more after ensuring table again
      try {
        await ensureSessionsTable(env);
        cookie = await createSession(
          env,
          { sub: user.id, email: userEmailLc, role },
          request
        );
      } catch (e2) {
        console.error("createSession() retry failed:", e2);
        return bad("service_unavailable", 503);
      }
    }

    // 7) Respond OK
    const res = json({
      ok: true,
      user: { id: user.id, email: userEmailLc, role },
    });
    headerSetCookie(res, cookie);
    return res;
  } catch (err: any) {
    // Final guard — log real error server-side, return generic 503
    console.error("login error:", err?.message || err);
    return bad("service_unavailable", 503);
  }
};
