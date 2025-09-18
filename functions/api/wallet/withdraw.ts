// functions/api/wallet/withdraw.ts
import { json, bad, requireAuth, type Env } from "../../_utils";

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
    try { body = await ctx.request.json<Body>(); } catch { /* noop */ }

    const amount = Math.trunc(Number(body.amount_cents || 0));
    if (!Number.isFinite(amount) || amount <= 0) return bad("amount_cents must be a positive integer", 400);

    const currency = (body.currency || "USD").toUpperCase();
    const network  = String(body.network || "").toUpperCase();
    const address  = String(body.address || "").trim();

    if (!network) return bad("network is required", 400);
    if (!address) return bad("address is required", 400);

    // Ensure wallet exists (so pending rows don't fail)
    await ctx.env.DB.prepare(
      `INSERT INTO wallets (user_id, balance_cents, currency)
       VALUES (?, 0, ?)
       ON CONFLICT(user_id) DO NOTHING`
    ).bind(String(sess.sub), currency).run();

    // Optional: you may enforce minimum balance here; for now we just queue a pending withdrawal

    const txId = (crypto as any).randomUUID?.() ?? String(Date.now());
    const created_sec = Math.floor(Date.now() / 1000);
    await ctx.env.DB.prepare(
      `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
       VALUES (?, ?, 'withdraw', ?, ?, 'pending', ?, ?)`
    ).bind(
      txId,
      String(sess.sub),
      amount,
      currency,
      // Put the *method* (network) in ref so UI shows "BTC" / "USDT-TRC20" etc.
      network,
      created_sec
    ).run();

    return json({ ok: true, id: txId });
  } catch (e: any) {
    console.error("withdraw error:", e);
    return bad("Unable to request withdrawal", 500);
  }
};
