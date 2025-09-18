// functions/api/wallet/withdraw.ts
import { json, bad, requireAuth, type Env } from "../../_utils";
import { ensureWallet, hexId16 } from "../../_db";

type Body = {
  amount_cents?: number;
  currency?: string;        // "USD"
  network?: string;         // "BTC" | "USDT-TRC20" | "ETH-ERC20"
  address?: string;         // destination
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const sess = await requireAuth(ctx.request, ctx.env);
    let body: Body = {};
    try { body = await ctx.request.json<Body>(); } catch {}

    const amount = Math.trunc(Number(body.amount_cents || 0));
    if (!Number.isFinite(amount) || amount <= 0) return bad("amount_cents must be a positive integer", 400);

    const currency = (body.currency || "USD").toUpperCase();
    const network  = String(body.network || "").toUpperCase();
    const address  = String(body.address || "").trim();
    if (!network) return bad("network is required", 400);
    if (!address) return bad("address is required", 400);

    // 1) Ensure wallet
    const walletId = await ensureWallet(ctx.env, String(sess.sub), currency);

    // (Optional) pre-check funds using posted balance view before queuing:
    // const bal = await ctx.env.DB.prepare(`SELECT current_balance_cents FROM v_wallet_reconcile WHERE user_id=?`)
    //  .bind(String(sess.sub)).first<number>("current_balance_cents");
    // if ((bal ?? 0) < amount) return bad("Insufficient funds", 400);

    // 2) Insert pending withdrawal into txs
    const txId = hexId16();
    const memo = `WITHDRAW ${network} → ${address.slice(0, 8)}…`;

    await ctx.env.DB.prepare(
      `INSERT INTO txs (id, user_id, wallet_id, amount_cents, kind, status, memo, created_at)
       VALUES (?, ?, ?, ?, 'withdrawal', 'pending', ?, datetime('now'))`
    ).bind(txId, String(sess.sub), walletId, amount, memo).run();

    return json({ ok: true, id: txId, wallet_id: walletId });
  } catch (e: any) {
    console.error("withdraw error:", e);
    return bad("Unable to request withdrawal", 500);
  }
};
