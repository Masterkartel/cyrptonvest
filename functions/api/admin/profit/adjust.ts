// functions/api/admin/profit/adjust.ts
import { json, bad, requireAdmin, randomTokenHex, type Env } from "../../../_utils";

type Body =
  | { user_id: string; amount_cents: number; note?: string }
  | { email: string;   amount_cents: number; note?: string };

async function getUserIdByEmail(env: Env, email: string) {
  const row = await env.DB.prepare(
    `SELECT id FROM users WHERE lower(email)=? LIMIT 1`
  ).bind(email.toLowerCase()).first<{ id: string }>();
  return row?.id || null;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try { await requireAdmin(ctx.request, ctx.env); }
  catch { return json({ ok:false, error:"Forbidden" }, 403); }

  let body: any = {};
  try { body = await ctx.request.json(); }
  catch { return bad("Invalid JSON body", 400); }

  const amount_cents = Math.trunc(Number(body.amount_cents));
  if (!Number.isFinite(amount_cents) || amount_cents === 0) {
    return bad("amount_cents must be a non-zero integer", 400);
  }

  let user_id = String(body.user_id || "").trim();
  if (!user_id && body.email) {
    const found = await getUserIdByEmail(ctx.env, String(body.email));
    if (!found) return bad("User not found", 404);
    user_id = found;
  }
  if (!user_id) return bad("Provide user_id or email", 400);

  const now = Math.floor(Date.now() / 1000);
  const txid = randomTokenHex(12);
  const note = String(body.note || "");

  await ctx.env.DB.prepare(
    `INSERT INTO transactions
       (id, user_id, kind, amount_cents, currency, status, ref, created_at)
     VALUES (?, ?, 'admin_profit_adjust', ?, 'USD', 'cleared', ?, ?)`
  ).bind(txid, user_id, Math.abs(amount_cents), note, now).run();

  return json({ ok:true, tx:{ id:txid, user_id, kind:'admin_profit_adjust', amount_cents:Math.abs(amount_cents), currency:'USD', note, created_at:now } });
};
