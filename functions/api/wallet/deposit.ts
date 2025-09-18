// functions/api/wallet/deposit.ts
import { json, bad, requireAuth, type Env } from "../../_utils";

type Body = {
  amount_cents?: number;
  currency?: string;      // "USD"
  network?: string;       // e.g. "BTC" | "USDT-TRC20" | "ETH-ERC20" | "manual"
  address?: string;       // optional
  txid?: string;          // user-provided TX hash
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const sess = await requireAuth(request, env);

    let body: Body = {};
    try { body = await request.json(); } catch { return bad("Invalid JSON body", 400); }

    const amount_cents = Math.trunc(Number(body.amount_cents || 0));
    if (!Number.isFinite(amount_cents) || amount_cents <= 0) {
      return bad("amount_cents must be a positive integer", 400);
    }

    const currency = String(body.currency || "USD").toUpperCase();
    const network  = String(body.network  || "manual");
    const address  = String(body.address  || "");
    const txid     = String(body.txid     || "");

    if (!txid) return bad("TXID is required", 400);

    const id = (crypto as any).randomUUID?.() ?? String(Date.now());
    const created_ms = Date.now();

    await env.DB.prepare(
      `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
       VALUES (?, ?, 'deposit', ?, ?, 'pending', ?, ?)`
    ).bind(id, sess.sub, amount_cents, currency, txid, created_ms).run();

    // (Optional) You could also store network/address in a separate table if you have columns.

    return json({ ok: true, id, status: "pending" });
  } catch (e: any) {
    console.error("deposit error:", e?.stack || e);
    return json({ ok: false, error: "Unable to submit deposit" }, 500);
  }
};
