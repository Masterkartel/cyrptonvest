import { ensureAdmin } from './_guard';

export const onRequestPatch: PagesFunction<{ DB: D1Database }> = async (c) => {
  const guard = ensureAdmin(c); if (guard) return guard;
  const body = await c.req.json();
  const { user_id, disallow_starter, disallow_growth, disallow_pro } = body || {};
  if (!user_id) return c.json({ ok:false, error:'missing user_id' }, 400);

  const db = c.env.DB;
  const now = Date.now();

  // upsert
  await db.prepare(`
    INSERT INTO user_limits (user_id, disallow_starter, disallow_growth, disallow_pro, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      disallow_starter=excluded.disallow_starter,
      disallow_growth =excluded.disallow_growth,
      disallow_pro    =excluded.disallow_pro,
      updated_at      =excluded.updated_at
  `).bind(
    user_id,
    disallow_starter ? 1 : 0,
    disallow_growth  ? 1 : 0,
    disallow_pro     ? 1 : 0,
    now
  ).run();

  return c.json({ ok:true });
};
