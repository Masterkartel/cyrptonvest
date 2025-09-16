import {
  json,
  bad,
  setCookie,
  headerSetCookie,
  createSession,
  verifyPassword,
  getUserByEmail,
  type Env,
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { email, password } = await ctx.request.json().catch(() => ({} as any));
    if (!email || !password) return bad("Email and password are required", 400);

    // Make sure the DB binding is present (avoids “Cannot read properties of undefined (reading 'prepare')”)
    if (!ctx.env.DB) return bad("Service unavailable (DB not bound)", 503);

    // Look up user
    const user = await getUserByEmail(email, ctx.env);
    if (!user) return bad("Invalid credentials", 401);

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return bad("Invalid credentials", 401);

    // Create session + cookie
    const sid = await createSession(user.id, ctx.env);
    const res = json({ ok: true, user: { id: user.id, email: user.email } });
    res.headers.append("Set-Cookie", headerSetCookie(sid, ctx.env));
    return res;
  } catch (err: any) {
    // Never leak stack traces to the UI
    return bad("Service temporarily unavailable", 503);
  }
};
