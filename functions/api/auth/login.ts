// functions/api/auth/login.ts
import {
  json,
  bad,
  createSession,
  headerSetCookie,
  verifyPassword,
  type Env,
} from "../../_utils";

/**
 * D1 can be empty on first deploys; if the `sessions` table is missing,
 * inserts throw and you see a generic 503. We create it if needed.
 */
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

/** Parse either JSON or form-urlencoded bodies safely */
async function readCredentials(req: Request) {
  let email = "";
  let password = "";
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  try {
    if (ct.includes("application/json")) {
      const body = await req.json<any>();
      email = String(body?.email ?? "").trim().toLowerCase();
      password = String(body?.password ?? "");
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      email = String(form.get("email") ?? "").trim().toLowerCase();
      password = String(form.get("password") ?? "");
    } else {
      // try JSON anyway (some clients forget the header)
      try {
        const body = await req.json<any>();
        email = String(body?.email ?? "").trim().toLowerCase();
        password = String(body?.password ?? "");
      } catch {
        // and finally try form
        try {
          const form = await req.formData();
          email = String(form.get("email") ?? "").trim().toLowerCase();
          password = String(form.get("password") ?? "");
        } catch {
          // fall through
        }
      }
    }
  } catch {
    // ignore; validated below
  }

  return { email, password };
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
  // Read credentials (supports JSON and form posts)
  const { email, password } = await readCredentials(request);
  if (!email || !password) return bad("Email and password are required", 400);

  // Look up user
  const user = await env.DB.prepare(
    `SELECT id, email, password_hash FROM users WHERE lower(email) = ? LIMIT 1`
  )
    .bind(email)
    .first<{ id: string; email: string; password_hash: string }>();

  if (!user) return bad("Invalid credentials", 400);

  // Verify password (bcrypt / salted sha256 / sha256 / plain)
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return bad("Invalid credentials", 400);

  // Make sure sessions table exists before insert (prevents 503)
  await ensureSessionsTable(env);

  // Role
  const role: "user" | "admin" =
    env.ADMIN_EMAIL &&
    user.email &&
    user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()
      ? "admin"
      : "user";

  // Create session + cookie
  const cookie = await createSession(env, { sub: user.id, email: user.email, role }, request);

  // Respond
  const res = json({ ok: true, user: { id: user.id, email: user.email, role } });
  headerSetCookie(res, cookie);
  // light CORS so fetch() from the login page never chokes
  res.headers.set("access-control-allow-origin", "*");
  return res;
};
