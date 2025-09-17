// functions/api/admin/wallet/adjust.ts
import { json, bad, requireAdmin, randomTokenHex, type Env } from "../../../_utils";

type Body = {
  user_id: string;
  delta_cents: number | string; // can arrive as string from UI
  currency?: string;            // default 'USD'
  note?: string;                // optional admin note / ref
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);
  } catch {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  // Parse & validate body
  let body: Body;
  try {
    body = await ctx.request.json<Body>();
  } catch {
    return bad("Invalid JSON body", 400);
  }

  const user_id = String(body.user_id || "").trim();
  const currency = (body.currency || "USD").toUpperCase();
  const note = String(body.note || "").slice(0, 200);

  // Coerce delta to integer cents
  const raw = typeof body.delta_cents === "string" ? body.delta_cents.trim() : body.delta_cents;
  const delta_cents = Math.trunc(Number(raw));
  if (!user_id) return bad("user_id required", 400);
  if (!Number.isFinite(delta_cents) || delta_cents === 0) {
    return bad("delta_cents must be a non-zero integer", 400);
  }

  // Ensure the user exists
  const user = await ctx.env.DB.prepare(
    `SELECT id FROM users WHERE id = ? LIMIT 1`
  ).bind(user_id).first<{ id: string }>();
  if (!user) return bad("User not found", 404);

  // Ensure wallet row exists, then adjust balance atomically
  // (D1 doesn't have full transactions; we keep it simple & consistent)
  // 1) Upsert wallet
  await ctx.env.DB.prepare(
    `INSERT INTO wallets (user_id, balance_cents, currency)
     VALUES (?, 0, ?)
     ON CONFLICT(user_id) DO NOTHING`
  ).bind(user_id, currency).run();

  // 2) Update balance
  await ctx.env.DB.prepare(
    `UPDATE wallets
        SET balance_cents = COALESCE(balance_cents,0) + ?
      WHERE user_id = ?`
  ).bind(delta_cents, user_id).run();

  // 3) Read back balance
  const wallet = await ctx.env.DB.prepare(
    `SELECT balance_cents, currency FROM wallets WHERE user_id = ? LIMIT 1`
  ).bind(user_id).first<{ balance_cents: number; currency: string }>();

  // 4) Record a transaction row (so there's an audit trail)
  const txid = randomTokenHex(12);
  const kind = delta_cents >= 0 ? "admin_credit" : "admin_debit";
  const created_at = Math.floor(Date.now() / 1000);
  await ctx.env.DB.prepare(
    `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
     VALUES (?, ?, ?, ?, ?, 'cleared', ?, ?)`
  ).bind(txid, user_id, kind, Math.abs(delta_cents), currency, note || "", created_at).run();

  return json({
    ok: true,
    wallet: {
      user_id,
      balance_cents: wallet?.balance_cents ?? 0,
      currency: wallet?.currency || currency,
    },
    tx: { id: txid, kind, amount_cents: Math.abs(delta_cents), currency, note, created_at }
  });
};
