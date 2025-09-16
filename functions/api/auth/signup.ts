// functions/api/auth/signup.ts
import {
  json, bad, hashPassword, createSession, headerSetCookie, type Env,
} from "../../_utils";

type Req = { email?: string; password?: string };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { email, password } = (await request.json().catch(() => ({}))) as Req;
    if (!email || !password) return bad("Missing email or password");

    const DB = env.DB as D1Database | undefined;
    if (!DB) return json({ error: "DB binding missing" }, { status: 500 });

    // already exists?
    const exists = await DB.prepare(`SELECT 1 FROM users WHERE lower(email)=lower(?) LIMIT 1`)
      .bind(email).first();
    if (exists) return bad("Email already registered");

    const hash = await hashPassword(password);
    const id = crypto.randomUUID();
    await DB.batch([
      DB.prepare(`INSERT INTO users (id, email, password_hash, is_active, created_at)
                  VALUES (?1, ?2, ?3, 1, CURRENT_TIMESTAMP)`).bind(id, email, hash),
      // optional: wallets row
      DB.prepare(`INSERT OR IGNORE INTO wallets (user_id, balance_cents) VALUES (?1, 0)`)
        .bind(id),
    ]);

    const { cookieValue, expires } = await createSession(env, id);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": headerSetCookie(env, cookieValue, expires),
      },
    });
  } catch (e: any) {
    return json({ error: `Signup failed: ${e?.message || e}` }, { status: 500 });
  }
};
