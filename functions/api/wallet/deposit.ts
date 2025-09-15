import { json, bad } from "../../_utils";

export const onRequestPost: PagesFunction = async ({ data, env, request }) => {
  if (!data.user) return new Response("Unauthorized", { status: 401 });

  let body: any = {};
  try { body = await request.json(); } catch { return bad("Invalid JSON"); }

  const amount_cents = Number(body.amount_cents);
  const currency = (body.currency || "USD").toString();
  const network = (body.network || "").toString();
  const address = (body.address || "").toString();
  const txid = (body.txid || null);

  if (!amount_cents || amount_cents <= 0) return bad("Invalid amount");

  const id = crypto.randomUUID();
  const meta = JSON.stringify({ network, address });

  await env.DB.prepare(
    "INSERT INTO transactions (id,user_id,kind,amount_cents,currency,ref,status,meta,created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).bind(id, data.user.id, "deposit", amount_cents, currency, txid, "pending", meta, Date.now()).run();

  return json({ ok: true, id });
};
