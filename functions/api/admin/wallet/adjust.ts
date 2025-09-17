// functions/api/admin/wallet/adjust.ts
import { json, bad, requireAdmin, randomTokenHex, type Env } from "../../../_utils";

type Body =
  | { user_id: string; amount_cents: number; kind?: string; note?: string; direction?: "auto" | "credit" | "debit" }
  | { email: string;   amount_cents: number; kind?: string; note?: string; direction?: "auto" | "credit" | "debit" };

async function getUserIdByEmail(env: Env, email: string) {
  const row = await env.DB.prepare(`SELECT id FROM users WHERE lower(email)=? LIMIT 1`)
    .bind(email.toLowerCase()).first<{ id: string }>();
  return row?.id || null;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try { await requireAdmin(ctx.request, ctx.env); } catch { return json({ ok:false, error:"Forbidden" }, 403); }

  let body: any = {};
  try { body = await ctx.request.json(); } catch { return bad("Invalid JSON body", 400); }

  const amount_cents_num = Math.trunc(Number(body.amount_cents));
  if (!Number.isFinite(amount_cents_num) || amount_cents_num === 0) {
    return bad("amount_cents must be a non-zero integer", 400);
  }

  let user_id = String(body.user_id || "").trim();
  if (!user_id && body.email) {
    const u = await getUserIdByEmail(ctx.env, String(body.email));
    if (!u) return bad("User not found", 404);
    user_id = u;
  }
  if (!user_id) return bad("Provide user_id or email", 400);

  const nowSec = Math.floor(Date.now() / 1000);

  // Ensure wallet exists
  await ctx.env.DB
    .prepare(`INSERT INTO wallets (user_id, balance_cents, currency) VALUES (?, 0, 'USD') ON CONFLICT(user_id) DO NOTHING`)
    .bind(user_id)
    .run();

  // Direction
  const dir: "auto" | "credit" | "debit" = (body.direction || "auto");
  const signedDelta =
    dir === "credit" ? Math.abs(amount_cents_num)
    : dir === "debit" ? -Math.abs(amount_cents_num)
    : amount_cents_num; // auto: use sign given

  // Update balance
  await ctx.env.DB
    .prepare(`UPDATE wallets SET balance_cents = COALESCE(balance_cents,0) + ? WHERE user_id = ?`)
    .bind(signedDelta, user_id)
    .run();

  // Read back
  const wallet = await ctx.env.DB
    .prepare(`SELECT balance_cents, currency FROM wallets WHERE user_id = ? LIMIT 1`)
    .bind(user_id).first<{ balance_cents:number; currency:string }>();

  // Audit transaction
  const txid = randomTokenHex(12);
  const kind = signedDelta >= 0 ? "admin_credit" : "admin_debit";
  const note = String(body.note || "");
  await ctx.env.DB
    .prepare(`INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
              VALUES (?, ?, ?, ?, ?, 'cleared', ?, ?)`)
    .bind(txid, user_id, kind, Math.abs(signedDelta), wallet?.currency || "USD", note, nowSec)
    .run();

  return json({
    ok: true,
    wallet: { user_id, balance_cents: wallet?.balance_cents ?? 0, currency: wallet?.currency || "USD" },
    tx: { id: txid, kind, amount_cents: Math.abs(signedDelta), currency: wallet?.currency || "USD", note, created_at: nowSec }
  });
};
