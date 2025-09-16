import { ensureAdmin } from './_guard';

export const onRequestGet: PagesFunction<{DB:D1Database}> = async (c) => {
  const guard = ensureAdmin(c); if (guard) return guard;
  const kind = c.req.query?.get('kind') || '';      // deposit | withdraw | ''
  const status = c.req.query?.get('status') || '';  // pending | completed | failed | ''
  const db = c.env.DB;

  const rows = await db.prepare(`
    SELECT t.*, u.email AS user_email
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE (? = '' OR t.kind = ?)
      AND (? = '' OR t.status = ?)
    ORDER BY t.created_at DESC
    LIMIT 200
  `).bind(kind, kind, status, status).all();

  return c.json({ transactions: rows.results || [] });
};

export const onRequestPatch: PagesFunction<{DB:D1Database}> = async (c) => {
  const guard = ensureAdmin(c); if (guard) return guard;
  const body = await c.req.json();
  const { id, status } = body as { id: string; status: 'completed' | 'failed' | 'pending' };

  const db = c.env.DB;

  // Get tx
  const tx = (await db.prepare(`SELECT * FROM transactions WHERE id = ?`).bind(id).first()) as any;
  if (!tx) return c.json({ ok: false, error: 'not_found' }, 404);

  // If approving a deposit, credit wallet; if rejecting, no credit.
  if (tx.kind === 'deposit' && status === 'completed' && tx.status !== 'completed') {
    await db.batch([
      db.prepare(`UPDATE transactions SET status = ? WHERE id = ?`).bind('completed', id),
      db.prepare(`UPDATE wallets SET balance_cents = COALESCE(balance_cents,0) + ? WHERE user_id = ?`).bind(tx.amount_cents, tx.user_id)
    ]);
    return c.json({ ok: true });
  }

  // If approving a withdraw, mark completed (you may also subtract when initiating or here if pending hold).
  if (tx.kind === 'withdraw' && status !== tx.status) {
    await db.prepare(`UPDATE transactions SET status = ? WHERE id = ?`).bind(status, id).run();
    return c.json({ ok: true });
  }

  // Generic status update for other kinds
  await db.prepare(`UPDATE transactions SET status = ? WHERE id = ?`).bind(status, id).run();
  return c.json({ ok: true });
};
