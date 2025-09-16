import { ensureAdmin } from '../_guard';

export const onRequestPost: PagesFunction<{DB:D1Database}> = async (c) => {
  const guard = ensureAdmin(c); if (guard) return guard;
  const body = await c.req.json();
  let { user_id, email, amount_cents, kind, note } = body as {
    user_id?: string; email?: string; amount_cents: number; kind?: string; note?: string;
  };

  if ((!user_id && !email) || !amount_cents) return c.json({ ok:false, error:'missing' }, 400);
  const db = c.env.DB;

  // Resolve id by email if needed
  if (!user_id && email) {
    const u = await db.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();
    if (!u) return c.json({ ok:false, error:'user_not_found' }, 404);
    // @ts-ignore
    user_id = u.id;
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  await db.batch([
    db.prepare(`UPDATE wallets SET balance_cents = COALESCE(balance_cents,0) + ? WHERE user_id = ?`)
      .bind(amount_cents, user_id),
    db.prepare(`
      INSERT INTO transactions (id,user_id,kind,amount_cents,currency,ref,status,meta,created_at)
      VALUES (?,?,?,?,?,?,?,json(?),?)
    `).bind(
      id, user_id, kind || 'adjustment', amount_cents, 'USD',
      note || '', 'completed', JSON.stringify({ admin: true }), now
    )
  ]);

  return c.json({ ok:true, id, user_id });
};
