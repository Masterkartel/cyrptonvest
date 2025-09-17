// functions/api/wallet/balance.ts
import { json, bad, requireUser, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const auth = await requireUser(ctx.request, ctx.env).catch(() => null);
  if (!auth) return bad("Unauthorized", 401);
  const userId = auth.sub;

  // ensure wallet row exists
  await ctx.env.DB
    .prepare(`INSERT INTO wallets (user_id, balance_cents, currency) VALUES (?, 0, 'USD') ON CONFLICT(user_id) DO NOTHING`)
    .bind(userId).run();

  const row = await ctx.env.DB
    .prepare(`SELECT balance_cents, currency FROM wallets WHERE user_id=? LIMIT 1`)
    .bind(userId).first<{ balance_cents: number; currency: string }>();

  return json({ ok:true, wallet: { balance_cents: row?.balance_cents ?? 0, currency: row?.currency || "USD" } });
};
