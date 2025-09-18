// functions/api/admin/wallet/adjust.ts
import { json, bad, requireAdmin, type Env } from "../../../_utils";

type Body =
  | { email: string; delta_cents: number | string; note?: string; currency?: string }
  | { user_id: string; delta_cents: number | string; note?: string; currency?: string };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // Admin auth
    await requireAdmin(request, env);
  } catch {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  // Parse body
  let body: Body;
  try {
    body = await request.json<Body>();
  } catch {
    return bad("Invalid JSON body", 400);
  }

  // Resolve user_id
  let user_id = "";
  if ("user_id" in body && body.user_id) {
    user_id = String(body.user_id).trim();
  } else if ("email" in body && body.email) {
    const email = String(body.email).trim().toLowerCase();
    const row = await env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ? LIMIT 1`
    ).bind(email).first<{ id: string | number }>();
    if (!row) return bad("User not found", 404);
    user_id = String(row.id);
  } else {
    return bad("Provide user_id or email", 400);
  }

  // Coerce delta
  const raw = (body as any).delta_cents;
  const delta = Math.trunc(Number(typeof raw === "string" ? raw.trim() : raw));
  if (!Number.isFinite(delta) || delta === 0) {
    return bad("delta_cents must be a non-zero integer", 400);
  }

  const note = String((body as any).note || "").slice(0, 200);
  const currency = String((body as any).currency || "USD").toUpperCase();

  // Ensure wallet row exists (manual upsert)
  const existing = await env.DB.prepare(
    `SELECT user_id FROM wallets WHERE user_id = ? LIMIT 1`
  ).bind(user_id).first<{ user_id: string }>();

  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO wallets (user_id, balance_cents, currency) VALUES (?, 0, ?)`
    ).bind(user_id, currency).run();
  }

  // Update balance
  await env.DB.prepare(
    `UPDATE wallets
        SET balance_cents = COALESCE(balance_cents,0) + ?, currency = ?
      WHERE user_id = ?`
  ).bind(delta, currency, user_id).run();

  // Read back current wallet
  const wallet = await env.DB.prepare(
    `SELECT balance_cents, currency FROM wallets WHERE user_id = ? LIMIT 1`
  ).bind(user_id).first<{ balance_cents: number; currency: string }>();

  // Record transaction (kind reflects credit/debit)
  const kind = delta > 0 ? "admin_credit" : "admin_debit";
  const txId = (crypto as any).randomUUID?.() ?? String(Date.now());
  const created_ms = Date.now();

  await env.DB.prepare(
    `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
     VALUES (?, ?, ?, ?, ?, 'cleared', ?, ?)`
  ).bind(
    txId,
    user_id,
    kind,
    Math.abs(delta),     // store positive magnitude; kind signals direction
    currency,
    note || "admin",
    created_ms
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
      kind,
      amount_cents: Math.abs(delta),
      currency,
      status: "cleared",
      ref: note || "admin",
      created_at: created_ms,
    },
  });
};
