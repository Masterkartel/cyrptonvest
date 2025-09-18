// functions/api/auth/login.ts
import {
  json,
  bad,
  getUserByEmail,
  verifyPassword,
  setCookie,
  type Env,
} from "../../_utils";

type Body = { email?: string; password?: string };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // Parse JSON (gracefully handle bad JSON)
    const body = (await request.json().catch(() => ({}))) as Body;

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return bad("Email and password are required", 400);
    }

    // Lookup user
    const user = await getUserByEmail(env, email);
    if (!user) {
      // Hide which field was wrong
      return json({ ok: false, error: "Invalid email or password" }, 401);
    }

    // Verify password (supports bcrypt / s256 / sha256 / plain)
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return json({ ok: false, error: "Invalid email or password" }, 401);
    }

    // Determine role
    const role: "user" | "admin" =
      env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.toLowerCase() ? "admin" : "user";

    // Build response and attach session cookie
    const res = json(
      { ok: true, user: { id: String(user.id), email: user.email, role } },
      200
    );

    // setCookie overload from _utils.ts: (resOrHeaders, env, session, reqOrUrl?)
    await setCookie(res, env, { sub: String(user.id), email, role }, request);

    return res;
  } catch (e: any) {
    // More explicit logging for diagnosing issues
    console.error("login error:", e?.stack || e);
    // Keep a friendly error for client
    return json(
      { ok: false, error: "Service temporarily unavailable. Please try again." },
      503
    );
  }
};
