// functions/api/admin/wallet/adjust.ts
import { json, bad, requireAdmin, type Env } from "../../../_utils";

type Body =
  | { email: string; delta_cents: number | string; note?: string }
  | { user_id: string; delta_cents: number | string; note?: string };

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  // auth
  try {
    await requireAdmin(ctx.request, ctx.env);
  } catch {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  // parse
  let body: Body;
  try {
    body = await ctx.request.json<Body>();
  } catch {
    return bad("Invalid JSON body", 400);
  }

  // resolve user_id
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

  // delta
  const raw = (body as any).delta_cents;
  const delta = Math.trunc(Number(typeof raw === "string" ? raw.trim() : raw));
  if (!Number.isFinite(delta) || delta === 0) {
    return bad("delta_cents must be a non-zero integer", 400);
  }
  const note = String((body as any).note || "").slice(0, 200);
  const currency = "USD";

  // tx id/time
  const txId = (crypto as any).randomUUID?.() ?? String(Date.now());
  const created_sec = Math.floor(Date.now() / 1000);

  // do all writes atomically
  const db = ctx.env.DB;
  try {
    await db.batch([
      // ensure wallet row (robust across missing UNIQUE until we add it)
      db.prepare(
        `INSERT OR IGNORE INTO wallets (user_id, balance_cents, currency)
         VALUES (?, 0, ?)`
      ).bind(user_id, currency),

      // update balance (can be +/-)
      db.prepare(
        `UPDATE wallets
           SET balance_cents = COALESCE(balance_cents,0) + ?
         WHERE user_id = ?`
      ).bind(delta, user_id),

      // insert transaction (store absolute amount for display)
      db.prepare(
        `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
         VALUES (?, ?, 'admin_adjust', ?, ?, 'cleared', ?, ?)`
      ).bind(txId, user_id, Math.abs(delta), currency, note, created_sec),
    ]);
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    // common hints
    if (msg.includes("FOREIGN KEY")) {
      return bad("Foreign key constraint failed (user may not exist).", 409);
    }
    if (msg.includes("no such table")) {
      return bad("Missing tables: run schema migration for wallets/transactions.", 500);
    }
    return bad(`Adjust failed: ${msg}`, 500);
  }

  // read back balance
  const wallet = await db.prepare(
    `SELECT balance_cents, currency FROM wallets WHERE user_id = ? LIMIT 1`
  ).bind(user_id).first<{ balance_cents: number; currency: string }>();

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
      created_at: created_sec * 1000,
    },
  });
};
