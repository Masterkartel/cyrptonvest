// functions/api/admin/wallet/adjust.ts
import { json, bad, requireAdmin, type Env } from "../../../_utils";

type Body =
  | { email: string; delta_cents: number | string; note?: string }
  | { user_id: string; delta_cents: number | string; note?: string };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // 1) Auth
  try {
    await requireAdmin(request, env);
  } catch {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  // 2) Parse body
  let body: Body;
  try {
    body = await request.json<Body>();
  } catch {
    return bad("Invalid JSON body", 400);
  }

  // 3) Resolve a canonical user_id that we know exists in users
  let user_id = "";
  if ("user_id" in body && body.user_id) {
    user_id = String(body.user_id).trim();
  } else if ("email" in body && body.email) {
    const email = String(body.email).trim().toLowerCase();
    const row = await env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ? LIMIT 1`
    ).bind(email).first<{ id: string }>();
    if (!row) return bad("User not found", 404);
    user_id = String(row.id);
  } else {
    return bad("Provide user_id or email", 400);
  }

  // Double-check the user really exists (prevents FK surprises)
  const check = await env.DB.prepare(
    `SELECT 1 AS ok FROM users WHERE id = ? LIMIT 1`
  ).bind(user_id).first<{ ok: number }>();
  if (!check?.ok) return bad("Foreign key constraint failed (user does not exist)", 409);

  // 4) delta
  const raw = (body as any).delta_cents;
  const delta = Math.trunc(Number(typeof raw === "string" ? raw.trim() : raw));
  if (!Number.isFinite(delta) || delta === 0) {
    return bad("delta_cents must be a non-zero integer", 400);
  }
  const note = String((body as any).note || "").slice(0, 200);
  const currency = "USD";

  // 5) Ensure wallet exists, but only if the user exists
  try {
    await env.DB.prepare(
      `INSERT INTO wallets (user_id, balance_cents, currency)
       SELECT ?, 0, ?
       WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
       ON CONFLICT(user_id) DO NOTHING`
    ).bind(user_id, currency, user_id).run();
  } catch (e: any) {
    return bad(`Unable to ensure wallet (FK wallets→users): ${e?.message || e}`, 500);
  }

  // 6) Update balance
  try {
    await env.DB.prepare(
      `UPDATE wallets
          SET balance_cents = COALESCE(balance_cents,0) + ?
        WHERE user_id = ?`
    ).bind(delta, user_id).run();
  } catch (e: any) {
    return bad(`Unable to update wallet: ${e?.message || e}`, 500);
  }

  // 7) Read back
  const wallet = await env.DB.prepare(
    `SELECT balance_cents, currency FROM wallets WHERE user_id = ? LIMIT 1`
  ).bind(user_id).first<{ balance_cents: number; currency: string }>();

  if (!wallet) {
    return bad("Wallet not found after update (unexpected)", 500);
  }

  // 8) Record transaction (admin_adjust is always a positive amount entry)
  const txId = (crypto as any).randomUUID?.() ?? String(Date.now());
  const created_sec = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare(
      `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
       VALUES (?, ?, 'admin_adjust', ?, ?, 'cleared', ?, ?)`
    ).bind(txId, user_id, Math.abs(delta), currency, note, created_sec).run();
  } catch (e: any) {
    return bad(`Unable to record transaction (FK tx→users): ${e?.message || e}`, 500);
  }

  return json({
    ok: true,
    wallet: {
      user_id,
      balance_cents: Number(wallet.balance_cents ?? 0),
      currency: wallet.currency || currency,
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
