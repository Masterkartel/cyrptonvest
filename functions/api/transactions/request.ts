// functions/api/transactions/request.ts
import { json, bad, requireAuth, type Env } from "../../_utils";

type Body = {
  kind: "deposit" | "withdraw";
  amount_usd?: number | string;
  amount_cents?: number | string; // optional direct cents
  note?: string;
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const sess = await requireAuth(ctx.request, ctx.env);

    // Parse body
    let body: Body;
    try {
      body = await ctx.request.json<Body>();
    } catch {
      return bad("Invalid JSON body", 400);
    }

    const kind = String(body.kind || "").toLowerCase() as Body["kind"];
    if (kind !== "deposit" && kind !== "withdraw") {
      return bad("kind must be 'deposit' or 'withdraw'", 400);
    }

    // amount: allow amount_usd (float) or amount_cents (int)
    let cents = 0;
    if (body.amount_cents != null) {
      const raw = typeof body.amount_cents === "string" ? body.amount_cents.trim() : body.amount_cents;
      cents = Math.trunc(Number(raw));
    } else {
      const usd = Number(body.amount_usd);
      if (!Number.isFinite(usd)) return bad("amount_usd must be a number", 400);
      cents = Math.round(usd * 100);
    }
    if (!Number.isFinite(cents) || cents <= 0) {
      return bad("Amount must be a positive number", 400);
    }

    const note = String(body.note || "").slice(0, 200);
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    const now = Math.floor(Date.now() / 1000);

    await ctx.env.DB.prepare(
      `INSERT INTO transactions (id, user_id, kind, amount_cents, currency, status, ref, created_at)
       VALUES (?, ?, ?, ?, 'USD', 'pending', ?, ?)`
    )
      .bind(id, sess.sub, kind, cents, note || null, now)
      .run();

    return json({
      ok: true,
      transaction: {
        id,
        kind,
        amount_cents: cents,
        currency: "USD",
        status: "pending",
        ref: note || "",
        created_at: now * 1000,
      },
    });
  } catch (e: any) {
    if (e?.status === 401) return json({ ok: false, error: "Unauthorized" }, 401);
    return bad("Unable to create request", 500);
  }
};
