import { json, bad, hashPassword, setCookie, createSession, type Env } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password) return bad("email and password required", 400);

  const now = Date.now();
  const id = crypto.randomUUID();
  const pw = await hashPassword(String(password));

  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO users (id,email,password,created_at) VALUES (?,?,?,?)`).bind(id, String(email).toLowerCase(), pw, now),
      env.DB.prepare(`INSERT INTO wallets (user_id,balance_cents,currency,btc_addr,trc20_addr,eth_addr) VALUES (?,?,?,?,?,?)`)
        .bind(id, 0, "USD",
          "bc1qcqy3f6z3qjglyt8qalmphrd4p6rz4jy6m0q0ye",
          "TTxwizHvUPUuJdmSmJREpaSYrwsderWp5V",
          "0xf3060f3dbb49b1ad301dd4291b2e74ab2fdcd861"
        )
    ]);
  } catch (e: any) {
    if (String(e.message||"").includes("UNIQUE")) return bad("email already registered", 409);
    return bad("signup failed", 500);
  }

  const sid = await createSession(env, id);
  const cookie = setCookie(env.SESSION_COOKIE_NAME || "cv_sid", sid, { httpOnly:true, secure:true, path:"/", maxAge:60*60*24*30 });
  return new Response(JSON.stringify({ ok:true, user:{ id, email:String(email).toLowerCase() } }), {
    status: 200,
    headers: { "Content-Type":"application/json", "Set-Cookie": cookie }
  });
};
