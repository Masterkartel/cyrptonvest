// functions/_db.ts
export function hexId16() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}

export async function ensureWallet(env: Env, userId: string, currency = "USD") {
  // one wallet per user, relies on UNIQUE(user_id)
  await env.DB.prepare(
    `INSERT INTO wallets (id, user_id, balance_cents, currency)
     VALUES (?, ?, 0, ?)
     ON CONFLICT(user_id) DO NOTHING`
  ).bind(hexId16(), userId, currency).run();

  const walletId = await env.DB.prepare(
    `SELECT id FROM wallets WHERE user_id=? LIMIT 1`
  ).bind(userId).first<string>("id");

  if (!walletId) throw new Error("No wallet for user (ensureWallet)");
  return walletId;
}
