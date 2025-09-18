// functions/api/admin/wallet/adjust.ts
import { json, bad, requireAdmin, type Env } from "../../../_utils";

type Body =
  | { email: string; delta_cents: number | string; note?: string }
  | { user_id: string; delta_cents: number | string; note?: string };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // 1) Admin required
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

  // 3) Resolve a CANONICAL user_id from DB (use this exact value everywhere)
  let canonicalUserId: string | null = null;

  if ("email" in body && body.email) {
    const email = String(body.email).trim().toLowerCase();
    const row = await env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ? LIMIT 1`
    ).bind(email).first<{ id: string }>();
    if (!row) return bad("User not found", 404);
    canonicalUserId = String(row.id);
  } else if ("user_id" in body && body.user_id) {
    const rawId = String(body.user_id).trim();
    const row = await env.DB.prepare(
      `SELECT id FROM users WHERE id = ? LIMIT 1`
    ).bind(rawId).first<{ id: string }>();
    if (!row) return bad("User not found", 404);
    canonicalUserId = String(row.id); // use EXACT value from DB
  } else {
    return bad("Provide user_id or email", 400);
  }

  // 4) Validate delta
  const rawDelta = (body as any).delta_cents;
  const delta = Math.trunc(Number(typeof rawDelta === "string" ? rawDelta.trim() : rawDelta));
  if (!Number.isFinite(delta) || delta === 0) {
    return bad("delta_cents must be a non-zero integer", 400);
  }
  const note = String((body as any).note || "").slice(0, 200);
  const currency = "USD";

  // 5) Ensure wallet exists ONLY if the user exists
  try {
    await env.DB.prepare(
      `INSERT INTO wallets (user_id, balance_cents, currency)
       SELECT ?, 0, ?
       WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
       ON CONFLICT(user_id) DO NOTHING`
    ).bind(canonicalUserId, currency, canonicalUserId).run();
  } catch (e: any) {
    return bad(`Unable to ensure wallet (FK wallets→users): ${e?.message || e}`, 500);
  }

  // Re-check wallet presence (defensive)
  const wExists = await env.DB.prepare(
    `SELECT 1 AS ok FROM wallets WHERE user_id = ? LIMIT 1`
  ).bind(canonicalUserId).first<{ ok: number }>();
  if (!wExists?.ok) {
    return bad("Wallet does not exist for this user (FK guard)", 409);
  }

  // 6) Update balance
  try {
    await env.DB.prepare(
      `UPDATE wallets
          SET balance_cents = COALESCE(balance_cents,0) + ?
        WHERE user_id = ?`
    ).bind(delta, canonicalUserId).run();
  } catch (e: any) {
    return bad(`Unable to update wallet: ${e?.message || e}`, 500);
  }

  // 7) Read back balance
  const wallet = await env.DB.prepare(
    `SELECT balance_cents, currency FROM wallets WHERE user_id = ? LIMIT 1`
  ).bind(canonicalUserId).first<{ balance_cents: number; currency: string }>();
  if (!wallet) return bad("Wallet not found after update", 500);

  // 8) Record transaction with EXISTS guard (prevents FK throws; gives clean 409)
  const txId = (crypto as any).randomUUID?.() ?? String(Date.now());
  const createdSec = Math.floor(Date.now() / 1000);
  const txInsert = await env.DB.prepare(
    `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
     SELECT ?, ?, 'admin_adjust', ?, ?, 'cleared', ?, ?
     WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)`
  ).bind(
    txId,
    canonicalUserId,
    Math.abs(delta),
    currency,
    note,
    createdSec,
    canonicalUserId
  ).run();

  // If the EXISTS check prevented insert, report clear error
  if ((txInsert as any)?.success === false || (txInsert as any)?.changes === 0) {
    return bad("Could not record transaction (user failed EXISTS check)", 409);
  }

  return json({
    ok: true,
    wallet: {
      user_id: canonicalUserId,
      balance_cents: Number(wallet.balance_cents ?? 0),
      currency: wallet.currency || currency,
    },
    tx: {
      id: txId,
      kind: "admin_adjust",
      amount_cents: Math.abs(delta),
      currency,
      note,
      created_at: createdSec * 1000,
    },
  });
};
