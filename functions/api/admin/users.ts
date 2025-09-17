// functions/api/admin/users.ts
import { json, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);

    const url = new URL(ctx.request.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    // Pull users with wallet (left join) + created_at in seconds
    const users = await ctx.env.DB.prepare(
      q
        ? `SELECT u.id, u.email, u.created_at,
                 COALESCE(w.balance_cents,0) AS balance_cents,
                 COALESCE(u.disallow_starter,0) AS disallow_starter,
                 COALESCE(u.disallow_growth,0)  AS disallow_growth,
                 COALESCE(u.disallow_pro,0)     AS disallow_pro
           FROM users u
           LEFT JOIN wallets w ON w.user_id = u.id
           WHERE lower(u.email) LIKE ?
           ORDER BY u.created_at DESC`
        : `SELECT u.id, u.email, u.created_at,
                 COALESCE(w.balance_cents,0) AS balance_cents,
                 COALESCE(u.disallow_starter,0) AS disallow_starter,
                 COALESCE(u.disallow_growth,0)  AS disallow_growth,
                 COALESCE(u.disallow_pro,0)     AS disallow_pro
           FROM users u
           LEFT JOIN wallets w ON w.user_id = u.id
           ORDER BY u.created_at DESC`
    )
      .bind(q ? `%${q}%` : undefined)
      .all<{
        id: string;
        email: string;
        created_at: number;
        balance_cents: number;
        disallow_starter: number;
        disallow_growth: number;
        disallow_pro: number;
      }>();

    const rows = users.results || [];

    // Sum profits per user from transactions table
    // (profit, plan_payout, interest, bonus) with cleared/completed/success
    const profitKinds = ["profit", "plan_payout", "interest", "bonus"];
    const profitMap = new Map<string, number>();

    const profits = await ctx.env.DB.prepare(
      `SELECT user_id, SUM(amount_cents) AS cents
         FROM transactions
        WHERE kind IN (${profitKinds.map(() => "?").join(",")})
          AND status IN ('cleared','completed','success')
        GROUP BY user_id`
    )
      .bind(...profitKinds)
      .all<{ user_id: string; cents: number }>();

    (profits.results || []).forEach((r) => profitMap.set(r.user_id, Number(r.cents || 0)));

    const out = rows.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: Number(u.created_at || 0), // seconds since epoch
      balance_cents: Number(u.balance_cents || 0),
      profit_cents: profitMap.get(u.id) || 0,
      disallow_starter: u.disallow_starter ? 1 : 0,
      disallow_growth: u.disallow_growth ? 1 : 0,
      disallow_pro: u.disallow_pro ? 1 : 0,
    }));

    return json({ ok: true, users: out });
  } catch (e: any) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }
};
