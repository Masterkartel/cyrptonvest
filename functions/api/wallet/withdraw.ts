// Creates a pending "withdraw" transaction for the signed-in user
import { json, bad, requireAuth, type Env } from "../../_utils";

function rid(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a).map(b=>b.toString(16).padStart(2,"0")).join("");
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const sess = await requireAuth(ctx.request, ctx.env);

    const body = await ctx.request.json<any>().catch(() => ({}));
    const amount_cents = Math.max(0, Number(body?.amount_cents || 0) | 0);
    const currency = String(body?.currency || "USD");
    const network  = String(body?.network || "").slice(0, 32);
    const address  = String(body?.address || "").slice(0, 120);

    if (!amount_cents || !address) return bad("amount_cents and address are required", 400);

    // Optional balance check: don’t block if you prefer manual review only
    const w = await ctx.env.DB
      .prepare(`SELECT balance_cents FROM wallets WHERE user_id = ? LIMIT 1`)
      .bind(sess.sub)
      .first<{ balance_cents: number }>();
    const bal = Number(w?.balance_cents || 0);
    if (bal < amount_cents) return bad("Insufficient balance", 400);

    const id = rid();
    const ref = [`net=${network||"manual"}`, `addr=${address}`].filter(Boolean).join(" | ");

    await ctx.env.DB.prepare(
      `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
       VALUES (?, ?, 'withdraw', ?, ?, 'pending', ?, CAST(strftime('%s','now') AS INTEGER))`
    ).bind(id, sess.sub, amount_cents, currency, ref).run();

    // NOTE: we’re NOT deducting balance yet; admin approval will move funds.
    return json({ ok: true, id, status: "pending" });
  } catch (e: any) {
    if (e?.status === 401) return json({ ok: false, error: "Unauthorized" }, 401);
    return bad("Unable to request withdrawal", 500);
  }
};
