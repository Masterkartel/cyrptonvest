import {
  json, bad, setCookie, headerSetCookie,
  hashPassword, verifyPassword,
  createSession, getUserFromSession, type Env
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const env = ctx.env;
    const body = await ctx.request.json().catch(() => ({} as any));
    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");

    if (!email || !password) return bad("Email and password required", 400);

    // Try to find existing user
    let user = await env.DB.prepare(
      "SELECT id, email, password_hash FROM users WHERE lower(email)=? LIMIT 1"
    ).bind(email).first<{ id: string; email: string; password_hash: string }>();

    // Bootstrap admin if not present
    const ADM_EMAIL = (env.ADMIN_EMAIL || "support@cyrptonvest.com").toLowerCase();
    const ADM_PASS  = env.ADMIN_PASSWORD || ""; // set this in CF env vars
    if (!user && email === ADM_EMAIL && ADM_PASS) {
      const uid = crypto.randomUUID();
      const phash = await hashPassword(ADM_PASS);
      await env.DB
        .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?,?,?,?)")
        .bind(uid, ADM_EMAIL, phash, Date.now())
        .run();
      user = { id: uid, email: ADM_EMAIL, password_hash: phash };
    }

    if (!user) return bad("Invalid credentials", 401);
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return bad("Invalid credentials", 401);

    // Create session + cookie
    const sid = await createSession(env, user.id);
    const cookie = setCookie(env.SESSION_COOKIE_NAME || "cv_sid", sid, {
      httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30
    });

    return headerSetCookie(json({ ok: true }), cookie);
  } catch (e: any) {
    return json({ ok: false, error: "login_failed", detail: String(e?.message || e) }, 500);
  }
};
