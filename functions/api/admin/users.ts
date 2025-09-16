import { ensureAdmin } from './_guard';

export const onRequestGet: PagesFunction<{
  DB: D1Database
}> = async (c) => {
  const guard = ensureAdmin(c);
  if (guard) return guard;

  const q = c.req.query?.get('q') || '';
  const db = c.env.DB;

  const sql = `
    SELECT u.id, u.email, u.created_at,
           COALESCE(w.balance_cents,0) AS balance_cents
    FROM users u
    LEFT JOIN wallets w ON w.user_id = u.id
    WHERE (? = '' OR u.email LIKE '%' || ? || '%')
    ORDER BY u.created_at DESC
    LIMIT 200
  `;
  const rows = await db.prepare(sql).bind(q, q).all();
  return c.json({ users: rows.results || [] });
};
