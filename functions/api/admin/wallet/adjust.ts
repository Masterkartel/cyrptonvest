import { json, requireAdmin, type Env } from "../../../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const g = await requireAdmin(env, request);
  if (!g.ok) return g.res;

  const body = await request.json().catch(() => ({}));
  let { user_id, email, amount_cents, kind, note } = body || {};
  amount_cents = Number(amount_cents)||0;
  if (!user_id && !email) return json({ error: "user_id or email required" }, 400);
  if (!amount_cents) return json({ error: "amount_cents required" }, 400);

  if (!user_id) {
    const row = await env.DB.prepare(`SELECT id FROM users WHERE email=? LIMIT 1`).bind(String(email||"").toLowerCase()).first<{id:string}>();
    if (!row) return json({ error: "user not found" }, 404);
    user_id = row.id;
  }

  const negative = ["plan_charge","debit"].includes((kind||"").toLowerCase());
  const positive = !negative;
  if (!kind) kind = positive ? "adjustment" : "plan_charge";

  const txId = crypto.randomUUID();
  const now = Date.now();
  const delta = negative ? -Math.abs(amount_cents) : Math.abs(amount_cents);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO transactions (id,user_id,kind,amount_cents,currency,ref,status,created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(txId, user_id, kind, Math.abs(amount_cents), "USD", note||"", "completed", now),
    env.DB.prepare(
      `INSERT INTO wallets (user_id,balance_cents,currency)
       VALUES (?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET balance_cents = wallets.balance_cents + excluded.balance_cents`
    ).bind(user_id, delta, "USD")
  ]);

  return json({ ok:true, id: txId });
};
