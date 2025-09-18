// functions/api/wallet/deposit.ts
import { json, bad, requireAuth, type Env } from "../../_utils";

type Body = {
  amount_cents?: number;
  currency?: string;        // "USD"
  network?: string;         // "BTC" | "USDT-TRC20" | "ETH-ERC20" | "manual"
  address?: string;         // optional
  txid?: string;            // user-provided hash
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const sess = await requireAuth(ctx.request, ctx.env);

    // Parse & validate
    let body: Body = {};
    try { body = await ctx.request.json<Body>(); } catch { /* fallthrough */ }

    const amount = Math.trunc(Number(body.amount_cents || 0));
    if (!Number.isFinite(amount) || amount <= 0) return bad("amount_cents must be a positive integer", 400);

    const currency = (body.currency || "USD").toUpperCase();
    const network  = String(body.network || "manual").toUpperCase();
    const txid     = String(body.txid || "").slice(0, 120);
    const address  = String(body.address || "").slice(0, 120);

    // Ensure wallet exists (TEXT user_id)
    await ctx.env.DB.prepare(
      `INSERT INTO wallets (user_id, balance_cents, currency)
       VALUES (?, 0, ?)
       ON CONFLICT(user_id) DO NOTHING`
    ).bind(String(sess.sub), currency).run();

    // Record as pending deposit; put the *method* in ref so UI shows clean label
    const txId = (crypto as any).randomUUID?.() ?? String(Date.now());
    const created_sec = Math.floor(Date.now() / 1000);
    await ctx.env.DB.prepare(
      `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
       VALUES (?, ?, 'deposit', ?, ?, 'pending', ?, ?)`
    ).bind(
      txId,
      String(sess.sub),
      amount,
      currency,
      // keep method (network) in ref; if you need txid later, you can include it in ref like "BTC: <txid>"
      network || "DEPOSIT",
      created_sec
    ).run();

    return json({ ok: true, id: txId });
  } catch (e: any) {
    console.error("deposit error:", e);
    return bad("Unable to submit deposit", 500);
  }
};
