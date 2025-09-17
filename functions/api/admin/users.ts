// functions/api/admin/users.ts
import { json, bad, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  // 1) Auth — only admins may read the user list
  try {
    await requireAdmin(ctx.request, ctx.env);
  } catch {
    return bad("Forbidden", 403);
  }

  // 2) Optional email search
  const url = new URL(ctx.request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  // 3) Pull users + wallet balances (LEFT JOIN so users without wallets still appear)
  //    COALESCE to show $0.00 when no wallet row exists.
  const base = `
    SELECT
      u.id,
      u.email,
      u.created_at,                           -- stored in seconds in our schema
      COALESCE(w.balance_cents, 0)  AS balance_cents,
      COALESCE(w.currency, 'USD')   AS currency,
      COALESCE(u.disallow_starter, 0) AS disallow_starter,
      COALESCE(u.disallow_growth,  0) AS disallow_growth,
      COALESCE(u.disallow_pro,     0) AS disallow_pro
    FROM users u
    LEFT JOIN wallets w ON w.user_id = u.id
  `;

  const sql = q
    ? `${base} WHERE lower(u.email) LIKE ? ORDER BY u.created_at DESC LIMIT 500`
    : `${base} ORDER BY u.created_at DESC LIMIT 500`;

  const stmt = q
    ? ctx.env.DB.prepare(sql).bind(`%${q}%`)
    : ctx.env.DB.prepare(sql);

  const rows = await stmt.all<{
    id: string;
    email: string;
    created_at: number | null;      // seconds
    balance_cents: number | null;
    currency: string | null;
    disallow_starter: number | null;
    disallow_growth: number | null;
    disallow_pro: number | null;
  }>();

  // 4) Normalize created_at to milliseconds for JS Date() and coerce flags to booleans
  const users = (rows?.results || []).map((r) => {
    const sec = Number(r.created_at || 0);
    const created_at = sec < 1e12 ? sec * 1000 : sec; // seconds → ms (or already ms)
    return {
      id: r.id,
      email: r.email,
      created_at,                                    // Admin UI calls: new Date(u.created_at)
      balance_cents: r.balance_cents ?? 0,
      currency: r.currency || "USD",
      disallow_starter: !!r.disallow_starter,
      disallow_growth:  !!r.disallow_growth,
      disallow_pro:     !!r.disallow_pro,
    };
  });

  return json({ ok: true, users });
};
