// functions/api/wallet/balance.ts
export const onRequestGet: PagesFunction = async ({ data, env }) => {
  if (!data.user) return new Response('Unauthorized', { status: 401 });
  const w = await env.DB.prepare('SELECT balance_cents, currency, btc_addr, trc20_addr, eth_addr FROM wallets WHERE user_id = ?').bind(data.user.id).first();
  return Response.json({ wallet: w });
};
