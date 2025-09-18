// functions/api/auth/login.ts
import {
  json,
  bad,
  getUserByEmail,
  verifyPassword,
  setCookie,
  type Env,
} from "../../_utils";

type Body = {
  email?: string;
  password?: string;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return bad("Email and password are required", 400);
    }

    // Look up user
    const user = await getUserByEmail(env, email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      // Hide which part failed
      return json({ ok: false, error: "Invalid email or password" }, 401);
    }

    const role: "user" | "admin" =
      env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.toLowerCase() ? "admin" : "user";

    // Create session cookie (appends Set-Cookie to the response)
    const res = json({ ok: true, user: { id: user.id, email: user.email, role } }, 200);
    await setCookie(res, env, { sub: user.id, email, role }, request);
    return res;
  } catch (e: any) {
    console.error("login error:", e);
    return json({ ok: false, error: "Service temporarily unavailable. Please try again." }, 503);
  }
};
