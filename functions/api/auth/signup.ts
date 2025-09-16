// functions/api/auth/signup.ts
import {
  json,
  bad,
  setCookie,
  hashPasswordBcrypt,
  getUserByEmail,
  randomTokenHex,
  type Env
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { env, request } = ctx;

    // 1) Parse body (and defend against non-JSON)
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return bad("Invalid JSON body", 400);
    }

    const emailRaw = (body.email || "").trim();
    const password = String(body.password || "");

    // 2) Basic validation
    const email = emailRaw.toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return bad("Enter a valid email address", 400);
    if (password.length < 8) return bad("Password must be at least 8 characters", 400);

    // 3) Already registered?
    const existing = await getUserByEmail(env, email);
    if (existing) return bad("Email is already registered", 409);

    // 4) Hash password and insert
    const id = randomTokenHex(16);
    const hash = await hashPasswordBcrypt(password);
    const created_at = Math.floor(Date.now() / 1000);

    const stmt = env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, created_at)
       VALUES (?, ?, ?, ?)`
    ).bind(id, email, hash, created_at);

    await stmt.run();

    // 5) Create session cookie (admin role if matches ADMIN_EMAIL)
    const role = email === (env.ADMIN_EMAIL || "").toLowerCase() ? "admin" : "user";
    const res = json({ ok: true, user: { id, email, role } });
    await setCookie(res, env, { sub: id, email, role, iat: Math.floor(Date.now() / 1000) });

    return res;
  } catch (err: any) {
    // If something explodes, never leak HTML — return JSON error
    console.error("signup error:", err);
    return bad("Could not create account. Please try again.", 500);
  }
};
