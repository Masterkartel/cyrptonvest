// /functions/api/auth/login.ts
import { json, setCookie, verifyPassword, db, getUserByEmail } from "../../_utils";

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const env: any = ctx.env;
    const body = await ctx.request.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) return json({ error: "Missing credentials" }, 400);

    // --- Admin path (ENV-based, no DB lookup) ---
    if (email === (env.ADMIN_EMAIL || "").toLowerCase()) {
      if (password !== env.ADMIN_PASSWORD) {
        return json({ error: "Invalid credentials" }, 401);
      }
      // create an admin session
      const session = {
        sub: "admin",
        email,
        role: "admin",
        iat: Date.now(),
      };
      const res = json({ ok: true, admin: true });
      setCookie(res, env, session); // uses AUTH_COOKIE_SECRET
      return res;
    }

    // --- Normal user path (DB) ---
    const conn = db(env);
    const user = await getUserByEmail(conn, email);
    if (!user) return json({ error: "Invalid credentials" }, 401);

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return json({ error: "Invalid credentials" }, 401);

    const session = {
      sub: user.id,
      email: user.email,
      role: "user",
      iat: Date.now(),
    };
    const res = json({ ok: true });
    setCookie(res, env, session);
    return res;
  } catch (e) {
    return json({ error: "Login error" }, 500);
  }
};
