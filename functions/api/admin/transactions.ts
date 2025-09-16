import { json, requireAdmin, type Env } from "../../_utils";

function normStatus(s: string | null) {
  s = (s || "").toLowerCase();
  return ["pending", "completed", "failed"].includes(s) ? s : undefined;
}
function normKind(k: string | null) {
  k = (k || "").toLowerCase();
  return ["deposit", "withdraw", "plan_charge", "adjustment", "profit", "bonus"].includes(k) ? k : undefined;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const gate = await requireAdmin(env, request);
  if (!gate.ok) return gate.res;

  const url = new URL(request.url);
  const status = normStatus(url.searchParams.get("status")) || "pending";
  const kind = normKind(url.searchParams.get("kind"));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "50", 10)));
  const cursor = parseInt(url.searchParams.get("cursor") || "0", 10); // created_at keyset

  const binds: any[] = [status];
  let sql =
    `SELECT t.id,t.user_id,u.email AS user_email,t.kind,t.amount_cents,t.currency,t.ref,t.status,t.created_at
       FROM transactions t JOIN users u ON u.id=t.user_id
      WHERE t.status=?`;

  if (kind) { sql += " AND t.kind=?"; binds.push(kind); }
  if (cursor > 0) { sql += " AND t.created_at < ?"; binds.push(cursor); } // keyset
  sql += " ORDER BY t.created_at DESC LIMIT ?"; binds.push(limit);

  const { results } = await env.DB.prepare(sql).bind(...binds).all<any>();
  const rows = results || [];
  const nextCursor = rows.length ? rows[rows.length - 1].created_at : null;

  return json({ transactions: rows, nextCursor });
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const gate = await requireAdmin(env, request);
  if (!gate.ok) return gate.res;

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "");
  const status = normStatus(body?.status || "");
  if (!id || !status) return json({ error: "id and valid status required" }, 400);

  const tx = await env.DB.prepare(
    `SELECT id,user_id,kind,amount_cents,currency,status FROM transactions WHERE id=? LIMIT 1`
  ).bind(id).first<any>();
  if (!tx) return json({ error: "Not found" }, 404);
  if (tx.status !== "pending") return json({ error: "Already processed" }, 400);

  let delta = 0;
  if (status === "completed") {
    if (tx.kind === "deposit") delta = +tx.amount_cents;
    if (tx.kind === "withdraw") delta = -tx.amount_cents;
  }

  const now = Date.now();
  const q1 = env.DB.prepare(`UPDATE transactions SET status=?, updated_at=? WHERE id=?`).bind(status, now, id);

  if (delta !== 0) {
    const q2 = env.DB.prepare(
      `INSERT INTO wallets (user_id,balance_cents,currency)
       VALUES (?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET balance_cents = wallets.balance_cents + excluded.balance_cents`
    ).bind(tx.user_id, delta, tx.currency || "USD");
    await env.DB.batch([q1, q2]);
  } else {
    await q1.run();
  }
  return json({ ok: true });
};
