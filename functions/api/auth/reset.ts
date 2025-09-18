import {
  json,
  bad,
  createSession,
  headerSetCookie,
  hashPasswordBcrypt,
  isReasonablePassword,
  getUserByEmail,
  type Env,
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  let email = "";
  let password = "";
  try {
    const body = await request.json<any>();
    email = String(body?.email || "").trim().toLowerCase();
    password = String(body?.password || "");
  } catch {
    return bad("Invalid JSON body", 400);
  }

  if (!email || !password) return bad("Email and password are required", 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("Invalid email", 400);
  if (!isReasonablePassword(password)) return bad("Password too weak", 400);

  try {
    const existing = await getUserByEmail(env, email);
    if (existing) return bad("Account already exists", 409);

    const password_hash = await hashPasswordBcrypt(password);
    const nowSec = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`
    ).bind(id, email, password_hash, nowSec).run();

    await env.DB.prepare(
      `INSERT OR IGNORE INTO wallets (user_id, balance_cents, currency) VALUES (?, 0, 'USD')`
    ).bind(id).run();

    const role: "user" | "admin" =
      env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.toLowerCase() ? "admin" : "user";

    const cookie = await createSession(env, { sub: id, email, role }, request);

    const res = json({ ok: true, user: { id, email, role } });
    headerSetCookie(res, cookie);
    return res;
  } catch (e: any) {
    console.error("register error:", e?.message || e);
    return bad("service_unavailable", 503);
  }
};
