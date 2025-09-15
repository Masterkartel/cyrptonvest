import { hashPassword, json, bad, setCookie } from "../../../_utils";

const START_BALANCE_CENTS = 0;
const DEFAULT_BTC = "bc1qcqy3f6z3qjglyt8qalmphrd4p6rz4jy6m0q0ye";
const DEFAULT_TRC = "TTxwizHvUPUuJdmSmJREpaSYrwsderWp5V";
const DEFAULT_ETH = "0xf3060f3dbb49b1ad301dd4291b2e74ab2fdcd861";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  let body: any = {};
  try { body = await request.json(); } catch { return bad("Invalid JSON"); }

  const email = (body.email || "").toLowerCase().trim();
  const password = body.password || "";
  if (!email || !password || password.length < 6) return bad("Missing email/password");

  // create user
  const id = crypto.randomUUID();
  const pw = await hashPassword(password);
  const now = Date.now();

  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)").bind(id, email, pw, now),
      env.DB.prepare("INSERT INTO wallets (user_id,balance_cents,currency,btc_addr,trc20_addr,eth_addr) VALUES (?,?, 'USD', ?, ?, ?)")
        .bind(id, START_BALANCE_CENTS, DEFAULT_BTC, DEFAULT_TRC, DEFAULT_ETH),
    ]);
  } catch (e: any) {
    const msg = (e?.message || "").includes("UNIQUE") ? "Email already registered" : "DB error";
    return bad(msg, 400);
  }

  // create session
  const sid = crypto.randomUUID();
  const expires = now + 7 * 24 * 60 * 60 * 1000; // 7 days
  await env.DB.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)")
    .bind(sid, id, now, expires).run();

  return json({ ok: true }, 200, { "Set-Cookie": setCookie("session", sid, 7 * 24 * 60 * 60) });
};
