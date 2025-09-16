import { json, requireAdmin, type Env } from "../../_utils";

// tiny helper to run IN() in small chunks (D1 param limit safety)
async function fetchMap<T extends { [k: string]: any }>(
  db: D1Database,
  table: "wallets" | "user_limits",
  idField: "user_id",
  ids: string[],
  cols: string[],
  chunk = 25
) {
  const map: Record<string, any> = {};
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const q = `SELECT ${[idField, ...cols].join(",")} FROM ${table} WHERE ${idField} IN (${slice
      .map(() => "?")
      .join(",")})`;
    const { results } = await db.prepare(q).bind(...slice).all<T>();
    (results || []).forEach((r: any) => (map[r[idField]] = r));
  }
  return map;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const gate = await requireAdmin(env, request);
  if (!gate.ok) return gate.res;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "50", 10)));
  const offset = (page - 1) * limit;

  // 1) base user rows only
  const baseSql = q
    ? `SELECT id,email,created_at FROM users WHERE email LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    : `SELECT id,email,created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`;

  const usersRs = q
    ? await env.DB.prepare(baseSql).bind(`%${q}%`, limit, offset).all<{ id: string; email: string; created_at: number }>()
    : await env.DB.prepare(baseSql).bind(limit, offset).all<{ id: string; email: string; created_at: number }>();

  const users = usersRs.results || [];
  const ids = users.map(u => u.id);
  if (ids.length === 0) return json({ users: [], page, limit, total: 0 });

  // 2) wallets (separate tiny queries, chunked)
  const walletMap = await fetchMap(env.DB, "wallets", "user_id", ids, ["balance_cents", "currency"]);

  // 3) limits (separate tiny queries, chunked)
  const limitMap = await fetchMap(env.DB, "user_limits", "user_id", ids, [
    "disallow_starter",
    "disallow_growth",
    "disallow_pro",
  ]);

  // 4) total (separate fast count—no joins)
  const countSql = q ? `SELECT COUNT(1) as c FROM users WHERE email LIKE ?` : `SELECT COUNT(1) as c FROM users`;
  const countRow = q
    ? await env.DB.prepare(countSql).bind(`%${q}%`).first<{ c: number }>()
    : await env.DB.prepare(countSql).first<{ c: number }>();

  // 5) merge on the server (cheap)
  const merged = users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    balance_cents: walletMap[u.id]?.balance_cents ?? 0,
    currency: walletMap[u.id]?.currency ?? "USD",
    disallow_starter: !!(limitMap[u.id]?.disallow_starter ?? 0),
    disallow_growth: !!(limitMap[u.id]?.disallow_growth ?? 0),
    disallow_pro: !!(limitMap[u.id]?.disallow_pro ?? 0),
  }));

  return json({ users: merged, page, limit, total: countRow?.c ?? merged.length });
};
