import { json, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const g = await requireAdmin(ctx.env, ctx.request);
  if (!g.ok) return g.res;

  const url = new URL(ctx.request.url);
  const status = (url.searchParams.get("status") || "pending").toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 300);

  const rs = await ctx.env.DB.prepare(
    `SELECT t.id, t.user_id, u.email, t.kind, t.amount_cents, t.currency, t.status, t.ref, t.created_at
       FROM transactions t JOIN users u ON u.id=t.user_id
      WHERE t.status = ?
      ORDER BY t.created_at DESC LIMIT ?`
  ).bind(status, limit).all();

  return json({ ok: true, transactions: rs.results || [] });
};
