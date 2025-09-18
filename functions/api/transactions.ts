// functions/api/transactions.ts
import { json, bad, requireAuth, type Env } from "../_utils";

type TxRow = {
  id: string;
  user_id: string;
  kind: string;
  amount_cents: number;
  currency: string;
  status: string;
  ref: string | null;
  created_at: number | string | null; // could be seconds, ms, or TEXT from D1
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    // Require an authenticated user (reads session from cookie)
    const sess = await requireAuth(ctx.request, ctx.env);

    // Optional: limit via ?limit=50 (caps at 200)
    const url = new URL(ctx.request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
      200
    );

    // Fetch the user's transactions (newest first)
    const res = await ctx.env.DB.prepare(
      `SELECT id, user_id, kind, amount_cents, currency, status, ref, created_at
         FROM transactions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?`
    )
      .bind(sess.sub, limit)
      .all<TxRow>();

    const out = (res.results || []).map((t) => {
      // Normalize created_at → milliseconds for the dashboard UI
      let created = Number(t.created_at ?? 0);
      if (!Number.isFinite(created)) {
        // If stored as TEXT like "2025-09-18 00:00:00", try Date.parse
        const parsed = Date.parse(String(t.created_at || ""));
        created = Number.isFinite(parsed) ? parsed : 0;
      } else {
        // If it's a small number, assume seconds → convert to ms
        if (created > 0 && created < 1e12) created *= 1000;
      }

      return {
        id: t.id,
        kind: t.kind,
        amount_cents: Number(t.amount_cents || 0),
        currency: t.currency || "USD",
        status: t.status || "pending",
        ref: t.ref || "",
        created_at: created, // milliseconds for UI: new Date(t.created_at)
      };
    });

    return json({ ok: true, transactions: out });
  } catch (e: any) {
    if (e?.status === 401) return json({ ok: false, error: "Unauthorized" }, 401);
    return bad("Unable to load transactions", 500);
  }
};
