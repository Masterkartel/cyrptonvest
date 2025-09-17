// functions/api/admin/wallet/adjust.ts
import {
  json,
  bad,
  requireAdmin,
  randomTokenHex,
  getUserByEmail,
  type Env,
} from "../../../_utils";

type Body = {
  user_id?: string;
  email?: string;
  delta_cents?: number | string;
  amount_cents?: number | string;
  amount_usd?: number | string;
  currency?: string;
  note?: string;
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try { await requireAdmin(ctx.request, ctx.env); } catch { return bad("Forbidden", 403); }

  let body: Body;
  try { body = await ctx.request.json<Body>(); } catch { return bad("Invalid JSON body", 400); }

  const currency = (body.currency || "USD").toUpperCase();
  const note = String(body.note || "").slice(0, 200);

  // Resolve user
  let userId = String(body.user_id || "").trim();
  if (!userId && body.email) {
    const u = await getUserByEmail(ctx.env, String(body.email).toLowerCase());
    if (!u) return bad("User not found", 404);
    userId = u.id;
  }
  if (!userId) return bad("user_id or email required", 400);

  const exists = await ctx.env.DB.prepare(
    `SELECT id FROM users WHERE id = ? LIMIT 1`
  ).bind(userId).first<{ id: string }>();
  if (!exists) return bad("User not found", 404);

  // Amount → integer cents
  const pick = (v: unknown) => (typeof v === "string" ? v.trim() : v);
  let centsRaw: unknown =
    body.delta_cents ?? body.amount_cents ??
    (body.amount_usd != null ? Number(pick(body.amount_usd)) * 100 : undefined);

  const delta_cents = Math.trunc(Number(pick(centsRaw)));
  if (!Number.isFinite(delta_cents) || delta_cents === 0) {
    return bad("Amount must be a non-zero integer (cents)", 400);
  }

  // Ensure wallet row exists, then apply adjustment
  await ctx.env.DB.prepare(
    `INSERT INTO wallets (user_id, balance_cents, currency)
     VALUES (?, 0, ?)
     ON CONFLICT(user_id) DO NOTHING`
  ).bind(userId, currency).run();

  await ctx.env.DB.prepare(
    `UPDATE wallets
       SET balance_cents = COALESCE(balance_cents,0) + ?
     WHERE user_id = ?`
  ).bind(delta_cents, userId).run();

  const wallet = await ctx.env.DB.prepare(
    `SELECT balance_cents, currency FROM wallets WHERE user_id = ? LIMIT 1`
  ).bind(userId).first<{ balance_cents: number; currency: string }>();

  // Audit trail
  const txid = randomTokenHex(12);
  const kind = delta_cents >= 0 ? "admin_credit" : "admin_debit";
  const created_at = Math.floor(Date.now() / 1000);
  await ctx.env.DB.prepare(
    `INSERT INTO transactions
      (id, user_id, kind, amount_cents, currency, status, ref, created_at)
     VALUES (?,  ?,      ?,    ?,            ?,        'cleared', ?,  ?)`
  ).bind(txid, userId, kind, Math.abs(delta_cents), currency, note || "", created_at).run();

  return json({
    ok: true,
    wallet: {
      user_id: userId,
      balance_cents: wallet?.balance_cents ?? 0,
      currency: wallet?.currency || currency,
    },
    tx: { id: txid, kind, amount_cents: Math.abs(delta_cents), currency, note, created_at },
  });
};
