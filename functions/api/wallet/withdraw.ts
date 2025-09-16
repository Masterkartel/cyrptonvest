import { json, bad, requireAuth, type Env } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const g = await requireAuth(env, request);
  if (!g.ok) return g.res;

  const body = await request.json().catch(() => ({}));
  const amount_cents = Math.max(0, parseInt(body?.amount_cents || 0, 10));
  const currency = String(body?.currency || "USD");
  const network = String(body?.network || "BTC");
  const address = String(body?.address || "").trim();
  if (!amount_cents || !address) return bad("amount_cents and address required", 400);

  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO transactions (id,user_id,kind,amount_cents,currency,ref,status,created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(id, g.user.id, "withdraw", amount_cents, currency, `${network}:${address}`, "pending", now).run();

  return json({ ok: true, id });
};
