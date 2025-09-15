// functions/_middleware.ts
import { v4 as uuid } from 'uuid';

export const onRequest = async ({ request, env, next, data }: any) => {
  const cookies = Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(v=>v.trim().split('=').map(decodeURIComponent)).filter(x=>x[0]));
  const sid = cookies['session'];
  data.user = null;
  if (sid) {
    const now = Date.now();
    const row = await env.DB.prepare('SELECT s.user_id, s.expires_at, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id = ?').bind(sid).first();
    if (row && now < row.expires_at) {
      data.user = { id: row.user_id, email: row.email };
    }
  }
  return next();
};
