// functions/api/admin/wallet/adjust.ts
import { json, bad, requireAdmin, type Env } from "../../../_utils";

type Body =
  | { email: string; delta_cents: number | string; note?: string }
  | { user_id: string; delta_cents: number | string; note?: string };

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);
  } catch {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  // Parse body
  let body: Body;
  try {
    body = await ctx.request.json<Body>();
  } catch {
    return bad("Invalid JSON body", 400);
  }

  // Resolve user_id
  let user_id = "";
  if ("user_id" in body && body.user_id) {
    user_id = String(body.user_id).trim();
  } else if ("email" in body && body.email) {
    const email = String(body.email).trim().toLowerCase();
    const row = await ctx.env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ? LIMIT 1`
    ).bind(email).first<{ id: string }>();
    if (!row) return bad("User not found", 404);
    user_id = row.id;
  } else {
    return bad("Provide user_id or email", 400);
  }

  // Coerce delta_cents
  const raw = (body as any).delta_cents;
  const delta = Math.trunc(Number(typeof raw === "string" ? raw.trim() : raw));
  if (!Number.isFinite(delta) || delta === 0) {
    return bad("delta_cents must be a non-zero integer", 400);
  }

  const note = String((body as any).note || "").slice(0, 200);
  const currency = "USD";

  // Ensure wallet exists
  await ctx.env.DB.prepare(
    `INSERT INTO wallets (user_id, balance_cents, currency)
     VALUES (?, 0, ?)
     ON CONFLICT(user_id) DO NOTHING`
  ).bind(user_id, currency).run();

  // Update balance
  await ctx.env.DB.prepare(
    `UPDATE wallets
        SET balance_cents = COALESCE(balance_cents,0) + ?
      WHERE user_id = ?`
  ).bind(delta, user_id).run();

  // Read back
  const wallet = await ctx.env.DB.prepare(
    `SELECT balance_cents, currency FROM wallets WHERE user_id = ? LIMIT 1`
  ).bind(user_id).first<{ balance_cents: number; currency: string }>();

  // Record transaction
  const txId = crypto.randomUUID?.() ?? String(Date.now());
  const created_sec = Math.floor(Date.now() / 1000);
  await ctx.env.DB.prepare(
    `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
     VALUES (?, ?, 'admin_adjust', ?, ?, 'cleared', ?, ?)`
  ).bind(
    txId,
    user_id,
    Math.abs(delta),
    currency,
    note,
    created_sec
  ).run();

  return json({
    ok: true,
    wallet: {
      user_id,
      balance_cents: Number(wallet?.balance_cents ?? 0),
      currency: wallet?.currency || currency,
    },
    tx: {
      id: txId,
      kind: "admin_adjust",
      amount_cents: Math.abs(delta),
      currency,
      note,
      created_at: created_sec * 1000, // ms for UI
    },
  });
};
