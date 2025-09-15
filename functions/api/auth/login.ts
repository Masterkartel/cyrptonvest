// functions/api/auth/login.ts
function sha256Hex(s: string) {
  const enc = new TextEncoder();
  // @ts-ignore
  return crypto.subtle.digest('SHA-256', enc.encode(s)).then(buf => Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''));
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { email, password } = await request.json();
  if (!email || !password) return new Response('Missing fields', { status: 400 });
  const user = await env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?').bind(email.toLowerCase()).first();
  if (!user) return new Response('Invalid credentials', { status: 401 });
  const [salt, hashStored] = (user.password_hash as string).split(':');
  const hashInput = await sha256Hex(password + ':' + salt);
  if (hashInput !== hashStored) return new Response('Invalid credentials', { status: 401 });
  const sid = crypto.randomUUID();
  const expires = Date.now() + 1000*60*60*24*7;
  await env.DB.prepare('INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)').bind(sid, user.id, Date.now(), expires).run();
  const headers = new Headers({ 'Content-Type':'application/json', 'Set-Cookie': `session=${encodeURIComponent(sid)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60*60*24*7}` });
  return new Response(JSON.stringify({ ok:true }), { headers });
};
