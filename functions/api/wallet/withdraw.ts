// functions/api/wallet/withdraw.ts
import { json, bad, requireAuth, type Env } from "../../_utils";

type Body = {
  amount_cents?: number;
  currency?: string;      // "USD"
  network?: string;       // "BTC" | "USDT-TRC20" | "ETH-ERC20"
  address?: string;       // destination address (required)
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
    const network  = String(body.network  || "").trim();
    const address  = String(body.address  || "").trim();
    if (!network) return bad("network is required", 400);
    if (!address) return bad("address is required", 400);

    // You could validate address formats per network here if needed.

    const id = (crypto as any).randomUUID?.() ?? String(Date.now());
    const created_ms = Date.now();

    await env.DB.prepare(
      `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
       VALUES (?, ?, 'withdrawal', ?, ?, 'pending', ?, ?)`
    ).bind(id, sess.sub, amount_cents, currency, network, created_ms).run();

    // Keep wallet unchanged until admin approves/completes.
    return json({ ok: true, id, status: "pending" });
  } catch (e: any) {
    console.error("withdraw error:", e?.stack || e);
    return json({ ok: false, error: "Unable to request withdrawal" }, 500);
  }
};
