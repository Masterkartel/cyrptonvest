import { json, bad, requireAuth, type Env } from "../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const sess = await requireAuth(ctx.request, ctx.env);

    const url = new URL(ctx.request.url);
    const kind = url.searchParams.get("kind") || "";        // e.g. deposit | withdraw | admin_credit | ...
    const status = url.searchParams.get("status") || "";     // e.g. pending | completed | failed
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10) || 50, 500);

    let sql = `SELECT id, user_id, kind, amount_cents, currency, status, ref, created_at
                 FROM transactions
                WHERE user_id = ?`;
    const binds: any[] = [sess.sub];

    if (kind && kind !== "all") { sql += ` AND kind = ?`; binds.push(kind); }
    if (status && status !== "all") { sql += ` AND status = ?`; binds.push(status); }
    sql += ` ORDER BY created_at DESC LIMIT ?`; binds.push(limit);

    const rows = await ctx.env.DB.prepare(sql).bind(...binds).all<{
      id: string; user_id: string; kind: string; amount_cents: number; currency: string;
      status: string; ref: string | null; created_at: number;
    }>();

    return json({ ok: true, transactions: rows.results || [] });
  } catch (e: any) {
    if (e?.status === 401) return json({ ok: false, error: "Unauthorized" }, 401);
    return bad("Unable to load transactions", 500);
  }
};
