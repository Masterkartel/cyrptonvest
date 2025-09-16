// functions/api/admin/users.ts
import { json, requireAdmin, type Env } from "../../_utils";

/**
 * GET /api/admin/users?limit=25&offset=0&q=foo
 * - returns: users page + balances (joined via IN (...) in a 2nd query)
 */
export const onRequestGet: PagesFunction<Env> = [
  requireAdmin,
  async ({ env, request }) => {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "25", 10), 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
    const q = (url.searchParams.get("q") || "").trim();

    // 1) fetch users page (no joins)
    const where = q ? "WHERE email LIKE ?1" : "";
    const like = `%${q}%`;

    const usersStmt = env.DB.prepare(
      `SELECT id, email, created_at
         FROM users
         ${where}
         ORDER BY created_at DESC
         LIMIT ?2 OFFSET ?3`
    );

    const usersRes = q
      ? await usersStmt.bind(like, limit, offset).all()
      : await usersStmt.bind(limit, offset).all();

    const users = usersRes.results as Array<{ id: string; email: string; created_at: string }>;

    // If no users in page, short-circuit
    if (!users.length) {
      return json({
        ok: true,
        users: [],
        meta: { count: 0, limit, offset },
      });
    }

    // 2) balances in one shot using IN (...) against wallets
    //    (if you don't have a wallets table, see the fallback below)
    const ids = users.map(u => u.id);
    const placeholders = ids.map((_, i) => `?${i + 1}`).join(", ");

    // Try wallets table first (fast)
    let balances: Record<string, number> = {};
    try {
      const w = await env.DB.prepare(
        `SELECT user_id, balance_cents
           FROM wallets
          WHERE user_id IN (${placeholders})`
      ).bind(...ids).all();

      for (const row of w.results as any[]) {
        balances[row.user_id] = row.balance_cents ?? 0;
      }
    } catch {
      // Fallback (no wallets table): compute from transactions quickly
      // Cleared/Completed/Success only, credit minus debit
      const t = await env.DB.prepare(
        `SELECT user_id,
                SUM(CASE WHEN kind IN ('deposit','profit','plan_payout','interest','bonus') THEN amount_cents ELSE 0 END) -
                SUM(CASE WHEN kind IN ('withdrawal','fee') THEN amount_cents ELSE 0 END) AS balance_cents
           FROM transactions
          WHERE status IN ('cleared','completed','success')
            AND user_id IN (${placeholders})
          GROUP BY user_id`
      ).bind(...ids).all();

      for (const row of t.results as any[]) {
        balances[row.user_id] = row.balance_cents ?? 0;
      }
    }

    // shape result
    const items = users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      balance_cents: balances[u.id] ?? 0,
    }));

    // 3) total count (cheap single count)
    const cnt = q
      ? await env.DB.prepare("SELECT COUNT(*) AS c FROM users WHERE email LIKE ?1").bind(like).first("c")
      : await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first("c");

    return json({
      ok: true,
      users: items,
      meta: { count: Number(cnt ?? 0), limit, offset },
    });
  },
];
