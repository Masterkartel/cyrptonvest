import { json, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const g = await requireAdmin(ctx.env, ctx.request);
  if (!g.ok) return g.res;

  const url = new URL(ctx.request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const cursor = url.searchParams.get("cursor"); // created_at cursor

  let q = `SELECT u.id, u.email, u.created_at,
                  IFNULL(w.balance_cents,0) AS balance_cents,
                  IFNULL(w.currency,'USD') AS currency
             FROM users u
             LEFT JOIN wallets w ON w.user_id=u.id`;
  const params: any[] = [];
  if (cursor) { q += ` WHERE u.created_at < ?`; params.push(parseInt(cursor, 10)); }
  q += ` ORDER BY u.created_at DESC LIMIT ?`; params.push(limit + 1);

  const rs = await ctx.env.DB.prepare(q).bind(...params).all<{ id:string; email:string; created_at:number; balance_cents:number; currency:string }>();
  const rows = rs.results || [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const next = hasMore ? String(items[items.length - 1].created_at) : null;

  return json({ ok: true, users: items, next_cursor: next });
};
