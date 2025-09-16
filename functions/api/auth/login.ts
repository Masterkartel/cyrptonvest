import { json, bad, verifyPassword, setCookie, type Env, getUserFromSession, createSession } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password) return bad("email and password required", 400);

  const row = await env.DB.prepare(`SELECT id,email,password FROM users WHERE email=? LIMIT 1`)
    .bind(String(email).toLowerCase()).first<{id:string; email:string; password:string}>();
  if (!row) return bad("invalid credentials", 401);
  const ok = await verifyPassword(String(password), row.password);
  if (!ok) return bad("invalid credentials", 401);

  const existing = await getUserFromSession(env, request);
  let sid: string;
  if (existing?.id === row.id) {
    // already logged; create a fresh session anyway
    sid = await createSession(env, row.id);
  } else {
    sid = await createSession(env, row.id);
  }
  const cookie = setCookie(env.SESSION_COOKIE_NAME || "cv_sid", sid, { httpOnly:true, secure:true, path:"/", maxAge:60*60*24*30 });
  return new Response(JSON.stringify({ ok:true, user:{ id: row.id, email: row.email } }), {
    status:200, headers:{ "Content-Type":"application/json", "Set-Cookie": cookie }
  });
};
