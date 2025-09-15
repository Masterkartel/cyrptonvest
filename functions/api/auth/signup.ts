// functions/api/auth/signup.ts
import { v4 as uuid } from 'uuid';

function hash(password: string, salt: string) {
  // Minimal salted SHA-256 (use Argon2/bcrypt in production). Keep salt unique per user.
  const enc = new TextEncoder();
  const data = enc.encode(password + ':' + salt);
  // @ts-ignore
  return crypto.subtle.digest('SHA-256', data).then(buf => Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''));
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { email, password } = await request.json();
  if (!email || !password) return new Response('Missing fields', { status: 400 });
  const id = uuid();
  const salt = uuid();
  const pw = await hash(password, salt);
  const created = Date.now();
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)').bind(id, email.toLowerCase(), `${salt}:${pw}`, created),
      env.DB.prepare('INSERT INTO wallets (user_id,balance_cents,currency,btc_addr,trc20_addr,eth_addr) VALUES (?,?,"USD",?,?,?)')
        .bind(id, 0, 'bc1qcqy3f6z3qjglyt8qalmphrd4p6rz4jy6m0q0ye', 'TTxwizHvUPUuJdmSmJREpaSYrwsderWp5V', '0xf3060f3dbb49b1ad301dd4291b2e74ab2fdcd861')
    ]);
  } catch (e:any) {
    return new Response(e.message.includes('UNIQUE')?'Email exists':'DB error', { status: 400 });
  }
  // auto-login
  const sid = uuid();
  const expires = Date.now() + 1000*60*60*24*7; // 7 days
  await env.DB.prepare('INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)').bind(sid, id, Date.now(), expires).run();
  const headers = new Headers({ 'Content-Type':'application/json', 'Set-Cookie': `session=${encodeURIComponent(sid)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60*60*24*7}` });
  return new Response(JSON.stringify({ ok:true }), { headers });
};
