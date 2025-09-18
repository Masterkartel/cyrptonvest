import {
  json,
  bad,
  createSession,
  headerSetCookie,
  verifyPassword,
  type Env,
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  let email = "", password = "";
  try {
    const body = await request.json<any>();
    email = String(body?.email || "").trim().toLowerCase();
    password = String(body?.password || "");
    if (!email || !password) return bad("Email and password are required", 400);
  } catch {
    return bad("Invalid JSON body", 400);
  }

  try {
    const user = await env.DB.prepare(
      `SELECT id, email, password_hash FROM users WHERE lower(email) = ? LIMIT 1`
    ).bind(email).first<{ id: string; email: string; password_hash: string }>();

    if (!user) return bad("Invalid credentials", 400);

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return bad("Invalid credentials", 400);

    const role: "user" | "admin" =
      env.ADMIN_EMAIL && user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()
        ? "admin"
        : "user";

    const cookie = await createSession(env, { sub: user.id, email: user.email, role }, request);

    const res = json({ ok: true, user: { id: user.id, email: user.email, role } });
    headerSetCookie(res, cookie);
    return res;
  } catch (err: any) {
    console.error("login error:", err?.message || err);
    return bad("service_unavailable", 503);
  }
};
