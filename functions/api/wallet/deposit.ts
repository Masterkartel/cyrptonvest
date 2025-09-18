// Creates a pending "deposit" transaction for the signed-in user
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
    const txid     = String(body?.txid || "").slice(0, 120);

    if (!amount_cents || !txid) return bad("amount_cents and txid are required", 400);

    const id = rid();
    const ref = [`net=${network||"manual"}`, `txid=${txid}`].filter(Boolean).join(" | ");

    await ctx.env.DB.prepare(
      `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
       VALUES (?, ?, 'deposit', ?, ?, 'pending', ?, CAST(strftime('%s','now') AS INTEGER))`
    ).bind(id, sess.sub, amount_cents, currency, ref).run();

    return json({ ok: true, id, status: "pending" });
  } catch (e: any) {
    if (e?.status === 401) return json({ ok: false, error: "Unauthorized" }, 401);
    return bad("Unable to submit deposit", 500);
  }
};
