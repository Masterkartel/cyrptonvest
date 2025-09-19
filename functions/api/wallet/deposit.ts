import { json, bad, requireAuth, type Env } from "../../_utils";
import { ensureWallet, hexId16 } from "../../_db";

type Body = {
  amount_cents?: number;
  currency?: string;
  network?: string;
  address?: string;
  txid?: string;
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const sess = await requireAuth(ctx.request, ctx.env);

    let body: Body = {};
    try { body = await ctx.request.json<Body>(); } catch {}

    const amount = Math.trunc(Number(body.amount_cents || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      return bad("amount_cents must be a positive integer", 400);
    }

    const currency = (body.currency || "USD").toUpperCase();
    const network  = String(body.network || "MANUAL").toUpperCase();
    const address  = String(body.address || "").slice(0, 120);
    const txid     = String(body.txid || "").slice(0, 120);

    const walletId = await ensureWallet(ctx.env, String(sess.sub), currency);

    const txId = hexId16();
    const memo = [network, address && `ADDR:${address}`, txid && `TX:${txid}`]
      .filter(Boolean)
      .join(" | ");

    // Writes to txs (ledger) — kind 'deposit'
    await ctx.env.DB.prepare(
      `INSERT INTO txs (id, user_id, wallet_id, amount_cents, kind, status, memo, created_at)
       VALUES (?, ?, ?, ?, 'deposit', 'pending', ?, datetime('now'))`
    ).bind(txId, String(sess.sub), walletId, amount, memo).run();

    return json({ ok: true, id: txId, wallet_id: walletId });
  } catch (e: any) {
    console.error("deposit error:", e);
    return bad("Unable to submit deposit", 500);
  }
};
