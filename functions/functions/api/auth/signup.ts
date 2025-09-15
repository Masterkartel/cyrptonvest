function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashPassword(pw: string, salt: string) {
  // Workers crypto
  const data = new TextEncoder().encode(pw + ':' + salt);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return hex(digest);
}
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { email, password } = await request.json();
  if (!email || !password || password.length < 6) return new Response('Invalid input', { status: 400 });
  const id = crypto.randomUUID();
  const salt = crypto.randomUUID();
  const pwHash = await hashPassword(password, salt);
  const created = Date.now();
  try {
    await env.DB.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)')
      .bind(id, String(email).toLowerCase(), `${salt}:${pwHash}`, created).run();
  } catch (e:any) {
    const msg = (e.message||'').includes('UNIQUE') ? 'Email already registered' : 'DB error';
    return new Response(msg, { status: 400 });
  }
  // Create session
  const sid = crypto.randomUUID();
  const expires = Date.now() + 1000*60*60*24*7;
  await env.DB.prepare('INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)')
    .bind(sid, id, Date.now(), expires).run();
  const headers = new Headers({
    'Content-Type':'application/json',
    'Set-Cookie': `session=${encodeURIComponent(sid)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60*60*24*7}`
  });
  return new Response(JSON.stringify({ ok:true }), { headers });
};
