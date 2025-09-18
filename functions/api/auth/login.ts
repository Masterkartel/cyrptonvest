// functions/api/auth/login.ts
import {
  json,
  bad,
  createSession,
  headerSetCookie,
  verifyPassword,
  type Env,
} from "../../_utils";

/** Read credentials from JSON or form posts */
async function readCredentials(req: Request) {
  let email = "";
  let password = "";
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  // Try JSON and form — whichever works
  if (ct.includes("application/json")) {
    const body = await req.json<any>().catch(() => null);
    if (body) {
      email = String(body?.email ?? "").trim().toLowerCase();
      password = String(body?.password ?? "");
    }
  } else if (ct.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData().catch(() => null);
    if (form) {
      email = String(form.get("email") ?? "").trim().toLowerCase();
      password = String(form.get("password") ?? "");
    }
  } else {
    const body = await req.json<any>().catch(() => null);
    if (body) {
      email = String(body?.email ?? "").trim().toLowerCase();
      password = String(body?.password ?? "");
    }
    if (!email || !password) {
      const form = await req.formData().catch(() => null);
      if (form) {
        email = String(form.get("email") ?? "").trim().toLowerCase();
        password = String(form.get("password") ?? "");
      }
    }
  }
  return { email, password };
}

/** Ensure sessions table exists using single statements (safer on D1) */
async function ensureSessionsTable(env: Env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`
  ).run();
}

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { email, password } = await readCredentials(request);
    if (!email || !password) return bad("Email and password are required", 400);

    // Look up user
    const user = await env.DB.prepare(
      `SELECT id, email, password_hash FROM users WHERE lower(email) = ? LIMIT 1`
    )
      .bind(email)
      .first<{ id: string; email: string; password_hash: string }>();

    if (!user) return bad("Invalid credentials", 400);

    // Verify password (supports bcrypt/salted sha256/sha256/plain)
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return bad("Invalid credentials", 400);

    // Make sure sessions table exists (prevents 500s on first write)
    await ensureSessionsTable(env);

    // Determine role
    const role: "user" | "admin" =
      env.ADMIN_EMAIL &&
      user.email &&
      user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()
        ? "admin"
        : "user";

    // Create session + cookie
    const cookie = await createSession(
      env,
      { sub: user.id, email: user.email, role },
      request
    );

    const res = json({
      ok: true,
      user: { id: user.id, email: user.email, role },
    });
    headerSetCookie(res, cookie);
    res.headers.set("access-control-allow-origin", "*");
    return res;
  } catch (err: any) {
    // Map most-common D1 errors to clear messages (your UI shows only `error`)
    const msg =
      typeof err?.message === "string" ? err.message : "Login failed";
    const friendly =
      /no such table: users/i.test(msg)
        ? "Database not initialized (users)."
        : /no such table: sessions/i.test(msg)
        ? "Database not initialized (sessions)."
        : msg;

    return json({ ok: false, error: friendly }, 500);
  }
};
