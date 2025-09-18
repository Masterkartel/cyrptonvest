// functions/api/auth/login.ts
import {
  json,
  bad,
  createSession,
  headerSetCookie,
  verifyPassword,
  type Env,
} from "../../_utils";

/** Ensure the sessions table exists so inserts don't crash on fresh DBs */
async function ensureSessionsTable(env: Env) {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  `);
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  // Preflight (CORS is handled by _middleware)
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

    // 3) Verify password (bcrypt, s256, sha256, plain)
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return bad("Invalid credentials", 400);

    // 4) Ensure sessions table exists (prevents 503 on fresh DBs)
    await ensureSessionsTable(env);

    // 5) Determine role
    const role: "user" | "admin" =
      env.ADMIN_EMAIL && user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()
        ? "admin"
        : "user";

    // 6) Create session + cookie
    const cookie = await createSession(
      env,
      { sub: user.id, email: user.email, role },
      request
    );

    // 7) Return JSON + Set-Cookie
    const res = json({ ok: true, user: { id: user.id, email: user.email, role } });
    headerSetCookie(res, cookie);
    return res;
  } catch (err: any) {
    console.error("login error:", err?.message || err);
    return bad("service_unavailable", 503);
  }
};
