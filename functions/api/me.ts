import { json, requireAuth, type Env } from "../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const env = ctx.env;
  const g = await requireAuth(env, ctx.request);
  if (!g.ok) return g.res;

  // Basic profile + wallet addresses + balance
  const row = await env.DB.prepare(
    `SELECT u.id, u.email,
            w.balance_cents, w.currency,
            w.btc_addr, w.trc20_addr, w.eth_addr
       FROM users u
       LEFT JOIN wallets w ON w.user_id=u.id
      WHERE u.id=? LIMIT 1`
  ).bind(g.user.id).first();

  return json({ user: { id: g.user.id, email: g.user.email }, wallet: row ?? null });
};
