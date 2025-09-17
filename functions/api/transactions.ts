// functions/api/transactions.ts
import { json, bad, requireUser, type Env } from "../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const auth = await requireUser(ctx.request, ctx.env).catch(() => null);
  if (!auth) return bad("Unauthorized", 401);

  const rows = await ctx.env.DB
    .prepare(`SELECT id, kind, amount_cents, currency, status, ref, created_at
              FROM transactions
              WHERE user_id = ?
              ORDER BY created_at DESC
              LIMIT 200`)
    .bind(auth.sub)
    .all<{ id:string; kind:string; amount_cents:number; currency:string; status:string; ref:string|null; created_at:number }>();

  return json({ ok:true, transactions: rows.results || [] });
};
