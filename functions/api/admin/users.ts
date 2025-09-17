// functions/api/admin/users.ts
import { json, bad, requireAdmin, type Env } from "../../_utils";

async function hasColumns(env: Env, table: string, cols: string[]) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{
    cid: number; name: string; type: string; notnull: number; dflt_value: any; pk: number;
  }>();
  const names = new Set((info.results || []).map(r => (r.name || "").toLowerCase()));
  return cols.every(c => names.has(c.toLowerCase()));
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try { await requireAdmin(ctx.request, ctx.env); } catch { return bad("Forbidden", 403); }

  const url = new URL(ctx.request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  const hasFlags   = await hasColumns(ctx.env, "users", ["disallow_starter","disallow_growth","disallow_pro"]);
  const hasCreated = await hasColumns(ctx.env, "users", ["created_at"]);

  const baseSelect = `
    SELECT
      u.id,
      u.email,
      ${hasCreated ? "u.created_at" : "0 AS created_at"},
      COALESCE(w.balance_cents,0) AS balance_cents,
      COALESCE(w.currency,'USD')  AS currency
      ${hasFlags ? `,
        COALESCE(u.disallow_starter,0) AS disallow_starter,
        COALESCE(u.disallow_growth,0)  AS disallow_growth,
        COALESCE(u.disallow_pro,0)     AS disallow_pro
      ` : `,
        0 AS disallow_starter,
        0 AS disallow_growth,
        0 AS disallow_pro
      `}
    FROM users u
    LEFT JOIN wallets w ON w.user_id = u.id
  `;

  const sql = q
    ? `${baseSelect} WHERE lower(u.email) LIKE ? ORDER BY ${hasCreated ? "u.created_at" : "u.rowid"} DESC LIMIT 500`
    : `${baseSelect} ORDER BY ${hasCreated ? "u.created_at" : "u.rowid"} DESC LIMIT 500`;

  const stmt = q
    ? ctx.env.DB.prepare(sql).bind(`%${q}%`)
    : ctx.env.DB.prepare(sql);

  const rows = await stmt.all<{
    id: string; email: string; created_at: number | null;
    balance_cents: number | null; currency: string | null;
    disallow_starter: number | null; disallow_growth: number | null; disallow_pro: number | null;
  }>();

  const users = (rows.results || []).map(r => ({
    id: r.id,
    email: r.email,
    // return raw created_at; UI will normalize
    created_at: Number(r.created_at || 0),
    balance_cents: r.balance_cents ?? 0,
    currency: r.currency || "USD",
    disallow_starter: !!r.disallow_starter,
    disallow_growth:  !!r.disallow_growth,
    disallow_pro:     !!r.disallow_pro,
  }));

  return json({ ok: true, users });
};
