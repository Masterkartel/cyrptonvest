// functions/api/wallet/balance.ts
import { json, bad, requireAuth, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    // Require a valid session
    const sess = await requireAuth(ctx.request, ctx.env);

    // Read wallet balance (defaults if no row yet)
    const w = await ctx.env.DB.prepare(
      `SELECT balance_cents, currency
         FROM wallets
        WHERE user_id = ?
        LIMIT 1`
    )
      .bind(sess.sub)
      .first<{ balance_cents: number; currency: string }>();

    return json({
      ok: true,
      wallet: {
        balance_cents: Number(w?.balance_cents ?? 0),
        currency: w?.currency || "USD",
      },
    });
  } catch (e: any) {
    if (e?.status === 401) return json({ ok: false, error: "Unauthorized" }, 401);
    return bad("Unable to load balance", 500);
  }
};
