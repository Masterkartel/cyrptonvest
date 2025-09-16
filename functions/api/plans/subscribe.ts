import { json, bad, requireAuth, type Env } from "../../_utils";

const PLANS: Record<string, { min:number; max:number; rate:number; hours:number }> = {
  starter:     { min:5,   max:10,    rate:0.60, hours:3  },
  growth:      { min:50,  max:400,   rate:1.40, hours:6  },
  professional:{ min:500, max:10000, rate:2.00, hours:24 }
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const g = await requireAuth(env, request);
  if (!g.ok) return g.res;

  const { plan, amount_cents } = await request.json().catch(() => ({}));
  const p = PLANS[String(plan||"").toLowerCase()];
  if (!p) return bad("invalid plan", 400);

  const usd = Math.round(Number(amount_cents)||0);
  if (!usd) return bad("amount_cents required", 400);
  if (usd < p.min*100 || usd > p.max*100) return bad("amount out of range for plan", 400);

  // Check plan locks
  const lim = await env.DB.prepare(`SELECT disallow_starter,disallow_growth,disallow_pro FROM user_limits WHERE user_id=?`)
    .bind(g.user.id).first<any>();
  if (lim) {
    if (plan==='starter' && lim.disallow_starter) return bad("starter locked", 403);
    if (plan==='growth' && lim.disallow_growth) return bad("growth locked", 403);
    if (plan==='professional' && lim.disallow_pro) return bad("professional locked", 403);
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  // Charge immediately (hold) and log a plan_charge (pending -> completed instantly)
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO transactions (id,user_id,kind,amount_cents,currency,ref,status,created_at)
                    VALUES (?,?,?,?,?,?,?,?)`)
      .bind(id, g.user.id, "plan_charge", usd, "USD", plan, "completed", now),
    env.DB.prepare(`INSERT INTO wallets (user_id,balance_cents,currency)
                    VALUES (?,?,?)
                    ON CONFLICT(user_id) DO UPDATE SET balance_cents = wallets.balance_cents - excluded.balance_cents`)
      .bind(g.user.id, usd, "USD"),
  ]);

  return json({ ok:true, id });
};
