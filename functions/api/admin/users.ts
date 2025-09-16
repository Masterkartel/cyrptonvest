// functions/api/admin/users.ts
import { json, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = [
  requireAdmin,
  async ({ env, request }) => {
    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "25", 10), 100);
      const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
      const q = (url.searchParams.get("q") || "").trim();

      // 1) page of users (no joins)
      const where = q ? "WHERE email LIKE ?1" : "";
      const like = `%${q}%`;

      const usersStmt = env.DB.prepare(
        `SELECT id, email, created_at
           FROM users
           ${where}
           ORDER BY created_at DESC
           LIMIT ?${q ? 2 : 1} OFFSET ?${q ? 3 : 2}`
      );

      const usersRes = q
        ? await usersStmt.bind(like, limit, offset).all()
        : await usersStmt.bind(limit, offset).all();

      const users = (usersRes.results || []) as Array<{ id: string; email: string; created_at: string }>;
      if (!users.length) {
        const cnt = q
          ? await env.DB.prepare("SELECT COUNT(*) AS c FROM users WHERE email LIKE ?1")
              .bind(like).first<number>("c")
          : await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first<number>("c");
        return json({ ok: true, users: [], meta: { count: Number(cnt ?? 0), limit, offset } });
      }

      // 2) balances in a second query (wallets table preferred)
      const ids = users.map(u => u.id);
      const placeholders = ids.map((_, i) => `?${i + 1}`).join(", ");
      const balances: Record<string, number> = {};

      // try fast path (wallets)
      try {
        const wr = await env.DB.prepare(
          `SELECT user_id, balance_cents FROM wallets WHERE user_id IN (${placeholders})`
        ).bind(...ids).all();
        for (const row of (wr.results || []) as any[]) {
          balances[row.user_id] = row.balance_cents ?? 0;
        }
      } catch (e) {
        console.warn("wallets lookup failed, falling back to transactions:", e);
        const tr = await env.DB.prepare(
          `SELECT user_id,
                  SUM(CASE WHEN kind IN ('deposit','profit','plan_payout','interest','bonus')
                           THEN amount_cents ELSE 0 END)
                - SUM(CASE WHEN kind IN ('withdrawal','fee')
                           THEN amount_cents ELSE 0 END) AS balance_cents
             FROM transactions
            WHERE status IN ('cleared','completed','success')
              AND user_id IN (${placeholders})
            GROUP BY user_id`
        ).bind(...ids).all();
        for (const row of (tr.results || []) as any[]) {
          balances[row.user_id] = row.balance_cents ?? 0;
        }
      }

      const items = users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        balance_cents: balances[u.id] ?? 0,
      }));

      const cnt = q
        ? await env.DB.prepare("SELECT COUNT(*) AS c FROM users WHERE email LIKE ?1")
            .bind(like).first<number>("c")
        : await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first<number>("c");

      return json({ ok: true, users: items, meta: { count: Number(cnt ?? 0), limit, offset } });
    } catch (err: any) {
      console.error("admin/users error:", err?.stack || err);
      return json({ ok: false, error: String(err?.message || err) }, { status: 500 });
    }
  },
];
