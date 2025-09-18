import { json, bad, requireAdmin, type Env } from "../../../_utils";
import { ensureWallet, hexId16 } from "../../../_db";

type Body =
  | { email: string; delta_cents: number | string; note?: string }
  | { user_id: string;  delta_cents: number | string; note?: string };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try { await requireAdmin(request, env); } catch { return json({ ok:false, error:"Forbidden" }, 403); }

  let body: Body; try { body = await request.json<Body>(); } catch { return bad("Invalid JSON body", 400); }

  // Find the real user_id from DB
  let userId: string | null = null;
  if ("email" in body && body.email) {
    const row = await env.DB.prepare(`SELECT id FROM users WHERE lower(email)=? LIMIT 1`)
      .bind(String(body.email).trim().toLowerCase()).first<{ id: string }>();
    if (!row) return bad("User not found", 404);
    userId = row.id;
  } else if ("user_id" in body && body.user_id) {
    const row = await env.DB.prepare(`SELECT id FROM users WHERE id=? LIMIT 1`)
      .bind(String(body.user_id).trim()).first<{ id: string }>();
    if (!row) return bad("User not found", 404);
    userId = row.id;
  } else {
    return bad("Provide user_id or email", 400);
  }

  const rawDelta = (body as any).delta_cents;
  const delta = Math.trunc(Number(typeof rawDelta === "string" ? rawDelta.trim() : rawDelta));
  if (!Number.isFinite(delta) || delta === 0) return bad("delta_cents must be a non-zero integer", 400);

  const note = String((body as any).note || "").slice(0, 200);
  const currency = "USD";

  // Make sure wallet exists
  const walletId = await ensureWallet(env, userId, currency);

  // Update wallet balance
  await env.DB.prepare(
    `UPDATE wallets
       SET balance_cents = COALESCE(balance_cents,0) + ?,
           updated_at = datetime('now')
     WHERE id = ?`
  ).bind(delta, walletId).run();

  // Record an adjustment in txs (posted now)
  const txId = hexId16();
  await env.DB.prepare(
    `INSERT INTO txs (id, user_id, wallet_id, amount_cents, kind, status, memo, created_at)
     VALUES (?, ?, ?, ?, 'adjustment', 'posted', ?, datetime('now'))`
  ).bind(txId, userId, walletId, Math.abs(delta), note || "admin adjustment").run();

  const wallet = await env.DB.prepare(
    `SELECT balance_cents, currency FROM wallets WHERE id=? LIMIT 1`
  ).bind(walletId).first<{ balance_cents: number; currency: string }>();

  return json({
    ok: true,
    wallet: { user_id: userId, wallet_id: walletId, balance_cents: Number(wallet?.balance_cents ?? 0), currency: wallet?.currency ?? currency },
    tx: { id: txId, kind: "adjustment", amount_cents: Math.abs(delta), status: "posted", memo: note }
  });
};
