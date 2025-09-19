import type { Env } from "./_utils";

export function hexId16() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}

/** Make sure the user has a wallet. Return wallet_id. */
export async function ensureWallet(env: Env, userId: string, currency = "USD") {
  await env.DB.prepare(
    `INSERT INTO wallets (id, user_id, balance_cents, currency)
     VALUES (?, ?, 0, ?)
     ON CONFLICT(user_id) DO NOTHING`
  ).bind(hexId16(), userId, currency).run();

  const row = await env.DB.prepare(
    `SELECT id FROM wallets WHERE user_id=? LIMIT 1`
  ).bind(userId).first<{ id: string }>();

  if (!row?.id) throw new Error("No wallet for user (ensureWallet)");
  return row.id;
}
