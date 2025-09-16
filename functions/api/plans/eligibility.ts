export const onRequestGet: PagesFunction<{DB:D1Database}> = async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error:'unauthorized' }, 401);

  const db = c.env.DB;
  const row = await db.prepare(`
    SELECT COALESCE(disallow_starter,0) AS disallow_starter,
           COALESCE(disallow_growth,0)  AS disallow_growth,
           COALESCE(disallow_pro,0)     AS disallow_pro
    FROM user_limits WHERE user_id = ?
  `).bind(user.id).first();

  return c.json({
    eligibility: {
      disallow_starter: row?.disallow_starter ? 1 : 0,
      disallow_growth:  row?.disallow_growth  ? 1 : 0,
      disallow_pro:     row?.disallow_pro     ? 1 : 0
    }
  });
};
