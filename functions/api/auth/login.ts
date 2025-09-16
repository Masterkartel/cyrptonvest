// functions/api/auth/login.ts
import {
  json,
  bad,
  verifyPassword,
  createSession,
  headerSetCookie,
  type Env,
} from "../../_utils";

type Req = { email?: string; password?: string };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { email, password } = (await request.json().catch(() => ({}))) as Req;

    if (!email || !password) {
      return bad("Missing email or password");
    }

    // <-- IMPORTANT: read D1 directly from env
    const DB = env.DB as D1Database | undefined;
    if (!DB) return json({ error: "DB binding missing" }, { status: 500 });

    // Find user
    const row = await DB.prepare<
      { id: string; email: string; password_hash: string; is_active: number }
    >(
      `SELECT id, email, password_hash, COALESCE(is_active,1) as is_active
         FROM users
        WHERE lower(email)=lower(?)
        LIMIT 1`
    )
      .bind(email)
      .first();

    if (!row) return bad("Invalid credentials");
    if (!row.is_active) return bad("Account disabled");

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) return bad("Invalid credentials");

    // Create a user session (stored via _utils)
    const { cookieValue, expires } = await createSession(env, row.id);

    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          // send cookie
          "set-cookie": headerSetCookie(env, cookieValue, expires),
        },
      }
    );
  } catch (e: any) {
    return json({ error: `Login failed: ${e?.message || e}` }, { status: 500 });
  }
};
