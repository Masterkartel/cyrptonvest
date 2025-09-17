// functions/api/admin/wallet/adjust.ts
import {
  json,
  bad,
  requireAdmin,
  randomTokenHex,
  type Env,
} from "../../../_utils";

type Body =
  | { user_id: string; delta_cents: number | string; currency?: string; note?: string }
  | { email: string;  delta_cents: number | string; currency?: string; note?: string };

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);
  } catch {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  // Parse and sanity-check input
  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return bad("Invalid JSON body", 400);
  }

  const currency = (body.currency || "USD").toUpperCase();
  const note: string = String(body.note || "").slice(0, 200);

  // Resolve a user_id from either user_id or email
  let user_id = String(body.user_id || "").trim();
  if (!user_id && body.email) {
    const email = String(body.email).trim().toLowerCase();
    const row = await ctx.env.DB.prepare(
      "SELECT id FROM users WHERE lower(email)=? LIMIT 1"
    ).bind(email).first<{ id: string }>();
    if (!row) return bad("User not found", 404);
    user_id = row.id;
  }
  if (!user_id) return bad("user_id or email required", 400);

  // delta in cents: must be non-zero integer
  const raw = typeof body.delta_cents === "string" ? body.delta_cents.trim() : body.delta_cents;
  const delta_cents = Math.trunc(Number(raw));
  if (!Number.isFinite(delta_cents) || delta_cents === 0) {
    return bad("delta_cents must be a non-zero integer", 400);
  }

  // Ensure the user exists
  const exists = await ctx.env.DB.prepare(
    "SELECT 1 FROM users WHERE id=? LIMIT 1"
  ).bind(user_id).first<any>();
  if (!exists) return bad("User not found", 404);

  // Ensure wallet row exists
  await ctx.env.DB.prepare(
    `INSERT INTO wallets (user_id, balance_cents, currency)
     VALUES (?, 0, ?)
     ON CONFLICT(user_id) DO NOTHING`
  ).bind(user_id, currency).run();

  // Apply balance change
  await ctx.env.DB.prepare(
    `UPDATE wallets
        SET balance_cents = COALESCE(balance_cents,0) + ?
      WHERE user_id = ?`
  ).bind(delta_cents, user_id).run();

  // Read back wallet
  const wallet = await ctx.env.DB.prepare(
    "SELECT balance_cents, currency FROM wallets WHERE user_id=? LIMIT 1"
  ).bind(user_id).first<{ balance_cents: number; currency: string }>();

  // Record an audit transaction (status=cleared so it shows in history)
  const txid = randomTokenHex(12);
  const created_at = Math.floor(Date.now() / 1000);
  const kind = delta_cents >= 0 ? "admin_credit" : "admin_debit";
  await ctx.env.DB.prepare(
    `INSERT INTO transactions
      (id, user_id, kind, amount_cents, currency, status, ref, created_at)
     VALUES (?, ?, ?, ?, ?, 'cleared', ?, ?)`
  ).bind(
    txid,
    user_id,
    kind,
    Math.abs(delta_cents),
    currency,
    note || (delta_cents >= 0 ? "Admin credit" : "Admin debit"),
    created_at
  ).run();

  return json({
    ok: true,
    wallet: {
      user_id,
      balance_cents: wallet?.balance_cents ?? 0,
      currency: wallet?.currency || currency,
    },
    tx: { id: txid, kind, amount_cents: Math.abs(delta_cents), currency, note, created_at },
  });
};
