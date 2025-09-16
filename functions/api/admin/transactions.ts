import { json, requireAdmin, type Env } from "../../_utils";

function normalizeStatus(status: string | null) {
  const s = (status || "").toLowerCase();
  if (["pending", "completed", "failed"].includes(s)) return s;
  return "pending";
}
function normalizeKind(kind: string | null) {
  const k = (kind || "").toLowerCase();
  if (["deposit", "withdraw"].includes(k)) return k;
  return null; // all kinds
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const gate = await requireAdmin(env, request);
  if (!gate.ok) return gate.res;

  const url = new URL(request.url);
  const status = normalizeStatus(url.searchParams.get("status"));
  const kind = normalizeKind(url.searchParams.get("kind"));

  let sql =
    `SELECT t.id, t.user_id, u.email AS user_email, t.kind, t.amount_cents, t.currency, t.ref, t.status, t.created_at
       FROM transactions t JOIN users u ON u.id = t.user_id
      WHERE t.status = ?`;
  const binds: any[] = [status];
  if (kind) { sql += " AND t.kind = ?"; binds.push(kind); }
  sql += " ORDER BY t.created_at DESC LIMIT 500";

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return json({ transactions: rows.results || [] });
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const gate = await requireAdmin(env, request);
  if (!gate.ok) return gate.res;

  const body = await request.json().catch(() => ({}));
  const id = body?.id as string;
  const status = normalizeStatus(body?.status);
  if (!id) return json({ error: "Missing id" }, 400);

  // fetch tx
  const tx = await env.DB.prepare(
    `SELECT id,user_id,kind,amount_cents,currency,status FROM transactions WHERE id=? LIMIT 1`
  ).bind(id).first<{ id:string; user_id:string; kind:string; amount_cents:number; currency:string; status:string }>();

  if (!tx) return json({ error: "Not found" }, 404);
  if (tx.status !== "pending") return json({ error: "Already processed" }, 400);

  // simple balance update rules
  let delta = 0;
  if (status === "completed") {
    if (tx.kind === "deposit") delta = +tx.amount_cents;
    if (tx.kind === "withdraw") delta = -tx.amount_cents;
  }
  const now = Date.now();

  const tx1 = env.DB.prepare(`UPDATE transactions SET status=?, updated_at=? WHERE id=?`).bind(status, now, id);
  if (delta !== 0) {
    const w1 = env.DB.prepare(`
      INSERT INTO wallets (user_id,balance_cents,currency)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET balance_cents = wallets.balance_cents + excluded.balance_cents
    `).bind(tx.user_id, delta, tx.currency || "USD");
    const b = await env.DB.batch([tx1, w1]);
    return json({ ok: true, updated: b.length });
  } else {
    const b = await env.DB.batch([tx1]);
    return json({ ok: true, updated: b.length });
  }
};
