// functions/api/auth/logout.ts
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const cookies = Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(v=>v.trim().split('=').map(decodeURIComponent)).filter(x=>x[0]));
  const sid = cookies['session'];
  if (sid) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
  return new Response(JSON.stringify({ ok:true }), { headers: { 'Content-Type':'application/json', 'Set-Cookie':'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' } });
};
