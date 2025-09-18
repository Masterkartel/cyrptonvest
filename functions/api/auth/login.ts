// functions/api/auth/login.ts
import {
  json,
  bad,
  getUserByEmail,
  verifyPassword,
  createSession, // ← use deterministic cookie creation
  type Env,
} from "../../_utils";

type Body = { email?: string; password?: string };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) return bad("Email and password are required", 400);

    // Lookup user
    const user = await getUserByEmail(env, email);
    const ok =
      !!user &&
      (await verifyPassword(password, user.password_hash));

    if (!ok) {
      // Hide which part failed
      return json({ ok: false, error: "Invalid email or password" }, 401);
    }

    const role: "user" | "admin" =
      env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.toLowerCase() ? "admin" : "user";

    // Create session cookie string (14 days)
    const setCookie = await createSession(
      env,
      { sub: user.id, email: user.email, role, iat: Math.floor(Date.now() / 1000) as any },
      request,
      60 * 60 * 24 * 14
    );

    // Respond with Set-Cookie header
    return new Response(
      JSON.stringify({ ok: true, user: { id: user.id, email: user.email, role } }),
      { status: 200, headers: { "content-type": "application/json", "set-cookie": setCookie } }
    );
  } catch (e) {
    console.error("login error:", e);
    return json({ ok: false, error: "Service temporarily unavailable. Please try again." }, 503);
  }
};
