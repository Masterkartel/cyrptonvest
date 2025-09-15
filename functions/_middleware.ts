export const onRequest: PagesFunction = async ({ request, env, next, data }) => {
  // Parse cookies
  const jar = Object.fromEntries(
    (request.headers.get('Cookie') || '')
      .split(';')
      .map(v => v.trim().split('=').map(decodeURIComponent))
      .filter(x => x[0])
  );
  const sid = jar['session'];
  data.user = null;
  if (sid) {
    const row = await env.DB
      .prepare('SELECT s.user_id, s.expires_at, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?')
      .bind(sid).first();
    if (row && Date.now() < row.expires_at) data.user = { id: row.user_id, email: row.email };
  }
  return next();
};
