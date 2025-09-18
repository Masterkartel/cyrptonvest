import { json, bad, requireAuth, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const sess = await requireAuth(ctx.request, ctx.env);

    // Wallet (balance)
    const w = await ctx.env.DB.prepare(
      `SELECT balance_cents, currency FROM wallets WHERE user_id = ? LIMIT 1`
    ).bind(sess.sub).first<{ balance_cents: number; currency: string }>();

    // Profit (optional table)
    let profit_cents = 0;
    try {
      const pr = await ctx.env.DB.prepare(
        `SELECT COALESCE(SUM(amount_cents),0) AS p FROM profit_ledger WHERE user_id = ?`
      ).bind(sess.sub).first<{ p: number }>();
      profit_cents = Number(pr?.p || 0);
    } catch {
      profit_cents = 0;
    }

    return json({
      ok: true,
      wallet: {
        balance_cents: Number(w?.balance_cents || 0),
        currency: w?.currency || "USD",
      },
      profits: {
        total_cents: profit_cents,
        currency: "USD",
      }
    });
  } catch (e: any) {
    if (e?.status === 401) return json({ ok: false, error: "Unauthorized" }, 401);
    return bad("Unable to load balance", 500);
  }
};
