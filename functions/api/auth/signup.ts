import { json, bad, setCookie, headerSetCookie, hashPassword, createSession, type Env } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const env = ctx.env;
    const body = await ctx.request.json().catch(() => ({} as any));
    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");

    if (!email || !password) return bad("Email and password required", 400);

    const exists = await env.DB.prepare("SELECT 1 FROM users WHERE lower(email)=? LIMIT 1")
      .bind(email).first<{ 1: number }>();
    if (exists) return bad("Email already registered", 409);

    const uid = crypto.randomUUID();
    const phash = await hashPassword(password);

    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)")
        .bind(uid, email, phash, Date.now()),
      env.DB.prepare("INSERT INTO wallets (user_id,balance_cents,currency,btc_addr,trc20_addr,eth_addr,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(uid, 0, "USD", "", "", "", Date.now()),
    ]);

    const sid = await createSession(env, uid);
    const cookie = setCookie(env.SESSION_COOKIE_NAME || "cv_sid", sid, {
      httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30
    });
    return headerSetCookie(json({ ok: true }), cookie);
  } catch (e: any) {
    return json({ ok: false, error: "signup_failed", detail: String(e?.message || e) }, 500);
  }
};
