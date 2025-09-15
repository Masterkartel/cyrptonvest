import { json, bad, setCookie, verifyPassword } from "../../../_utils";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  let body: any = {};
  try { body = await request.json(); } catch { return bad("Invalid JSON"); }

  const email = (body.email || "").toLowerCase().trim();
  const password = body.password || "";
  if (!email || !password) return bad("Missing email/password");

  const user = await env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ?").bind(email).first();
  if (!user) return bad("Invalid credentials", 401);

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return bad("Invalid credentials", 401);

  const sid = crypto.randomUUID();
  const now = Date.now();
  const expires = now + 7 * 24 * 60 * 60 * 1000;
  await env.DB.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)")
    .bind(sid, user.id, now, expires).run();

  return json({ ok: true }, 200, { "Set-Cookie": setCookie("session", sid, 7 * 24 * 60 * 60) });
};
