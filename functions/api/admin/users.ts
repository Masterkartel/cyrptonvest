import { json, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const gate = await requireAdmin(env, request);
  if (!gate.ok) return gate.res;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  // wallets: user_id TEXT PK, balance_cents INTEGER DEFAULT 0, currency TEXT
  // user_limits: user_id TEXT PK, disallow_starter INT, disallow_growth INT, disallow_pro INT
  const base =
    `SELECT u.id, u.email, u.created_at,
            IFNULL(w.balance_cents,0) AS balance_cents,
            IFNULL(l.disallow_starter,0) AS disallow_starter,
            IFNULL(l.disallow_growth,0)  AS disallow_growth,
            IFNULL(l.disallow_pro,0)     AS disallow_pro
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       LEFT JOIN user_limits l ON l.user_id = u.id`;
  const sql = q ? `${base} WHERE u.email LIKE ? ORDER BY u.created_at DESC LIMIT 500`
                : `${base} ORDER BY u.created_at DESC LIMIT 500`;
  const stmt = q ? env.DB.prepare(sql).bind(`%${q}%`) : env.DB.prepare(sql);
  const rows = await stmt.all();

  return json({ users: rows.results || [] });
};
