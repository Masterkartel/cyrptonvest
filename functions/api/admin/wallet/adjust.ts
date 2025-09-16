import { json, requireAdmin, type Env } from "../../../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const gate = await requireAdmin(env, request);
  if (!gate.ok) return gate.res;

  const body = await request.json().catch(() => ({}));
  let { user_id, email, amount_cents, kind, note } = body || {};
  amount_cents = Number(amount_cents)||0;
  if (!user_id && !email) return json({ error: "Provide user_id or email" }, 400);
  if (!amount_cents) return json({ error: "Amount required" }, 400);

  if (!user_id) {
    const row = await env.DB.prepare(`SELECT id FROM users WHERE email=? LIMIT 1`).bind(String(email||"")).first<{id:string}>();
    if (!row) return json({ error: "User not found" }, 404);
    user_id = row.id;
  }

  const positive = ["adjustment","profit","bonus"].includes((kind||"").toLowerCase());
  const negative = ["plan_charge","debit"].includes((kind||"").toLowerCase());
  let delta = amount_cents;
  if (negative) delta = -Math.abs(amount_cents);
  if (!positive && !negative) kind = "adjustment";

  const txId = crypto.randomUUID();
  const now = Date.now();

  const addTx = env.DB.prepare(
    `INSERT INTO transactions (id,user_id,kind,amount_cents,currency,ref,status,created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(txId, user_id, kind, Math.abs(amount_cents), "USD", note||"", "completed", now);

  const upWallet = env.DB.prepare(
    `INSERT INTO wallets (user_id,balance_cents,currency)
     VALUES (?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET balance_cents = wallets.balance_cents + excluded.balance_cents`
  ).bind(user_id, delta, "USD");

  await env.DB.batch([addTx, upWallet]);

  return json({ ok: true, id: txId });
};
