import { json, bad, requireAuth, type Env } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const g = await requireAuth(env, request);
  if (!g.ok) return g.res;

  const body = await request.json().catch(() => ({}));
  const amount_cents = Math.max(0, parseInt(body?.amount_cents || 0, 10));
  const currency = String(body?.currency || "USD");
  const txid = String(body?.txid || "").trim();
  if (!amount_cents || !txid) return bad("amount_cents and txid required", 400);

  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO transactions (id,user_id,kind,amount_cents,currency,ref,status,created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(id, g.user.id, "deposit", amount_cents, currency, txid, "pending", now).run();

  return json({ ok: true, id });
};
