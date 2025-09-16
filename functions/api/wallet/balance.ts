import { json, requireAuth, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const g = await requireAuth(env, request);
  if (!g.ok) return g.res;

  const w = await env.DB.prepare(`SELECT balance_cents,currency,btc_addr,trc20_addr,eth_addr FROM wallets WHERE user_id=? LIMIT 1`)
    .bind(g.user.id).first<any>();

  return json({
    wallet: {
      balance_cents: w?.balance_cents || 0,
      currency: w?.currency || "USD",
      btc_addr: w?.btc_addr || "bc1qcqy3f6z3qjglyt8qalmphrd4p6rz4jy6m0q0ye",
      trc20_addr: w?.trc20_addr || "TTxwizHvUPUuJdmSmJREpaSYrwsderWp5V",
      eth_addr: w?.eth_addr || "0xf3060f3dbb49b1ad301dd4291b2e74ab2fdcd861"
    }
  });
};
