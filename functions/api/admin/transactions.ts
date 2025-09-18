// functions/api/admin/transactions.ts
import { json, bad, requireAdmin, type Env } from "../../_utils";

type TxRow = {
  id: string;
  user_id: string;
  kind: "deposit" | "withdraw" | string;
  amount_cents: number;
  currency: string;
  status: "pending" | "completed" | "failed" | string;
  ref: string | null;
  created_at: number | string | null;
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);

    const url = new URL(ctx.request.url);
    const status = (url.searchParams.get("status") || "pending").toLowerCase();
    const kind = (url.searchParams.get("kind") || "").toLowerCase();
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), 200);

    const where: string[] = [];
    const binds: any[] = [];
    if (status) {
      where.push("status = ?");
      binds.push(status);
    }
    if (kind === "deposit" || kind === "withdraw") {
      where.push("kind = ?");
      binds.push(kind);
    }

    const sql =
      `SELECT t.id, t.user_id, u.email AS user_email, t.kind, t.amount_cents, t.currency, t.status, t.ref, t.created_at
         FROM transactions t
         LEFT JOIN users u ON u.id = t.user_id
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY t.created_at DESC
        LIMIT ?`;

    const res = await ctx.env.DB.prepare(sql).bind(...binds, limit).all<TxRow & { user_email?: string }>();

    const out = (res.results || []).map((t) => {
      let created = Number(t.created_at ?? 0);
      if (!Number.isFinite(created)) {
        const parsed = Date.parse(String(t.created_at || ""));
        created = Number.isFinite(parsed) ? parsed : 0;
      } else if (created > 0 && created < 1e12) {
        created *= 1000;
      }
      return {
        id: t.id,
        user_id: t.user_id,
        user_email: (t as any).user_email || "",
        kind: t.kind,
        amount_cents: Number(t.amount_cents || 0),
        currency: t.currency || "USD",
        status: t.status,
        ref: t.ref || "",
        created_at: created,
      };
    });

    return json({ ok: true, transactions: out });
  } catch (e: any) {
    if (e?.status === 403) return json({ ok: false, error: "Forbidden" }, 403);
    return bad("Unable to load transactions", 500);
  }
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);
    const { id, status } = await ctx.request.json().catch(() => ({}));
    const newStatus = String(status || "").toLowerCase();

    if (!id || !["completed", "failed", "pending"].includes(newStatus)) {
      return bad("Provide id and a valid status", 400);
    }

    // Load tx
    const tx = await ctx.env.DB.prepare(
      `SELECT id, user_id, kind, amount_cents, currency, status
         FROM transactions WHERE id = ? LIMIT 1`
    ).bind(id).first<TxRow>();

    if (!tx) return bad("Not found", 404);
    if (tx.status === newStatus) return json({ ok: true, transaction: tx });

    // Auto wallet mutation if completing
    if (newStatus === "completed") {
      const sign = tx.kind === "deposit" ? +1 : tx.kind === "withdraw" ? -1 : 0;

      if (sign !== 0) {
        // Ensure wallet row exists
        await ctx.env.DB.prepare(
          `INSERT INTO wallets (user_id, balance_cents, currency)
           VALUES (?, 0, ?)
           ON CONFLICT(user_id) DO NOTHING`
        ).bind(tx.user_id, tx.currency || "USD").run();

        if (sign < 0) {
          // Prevent overdraft
          const w = await ctx.env.DB.prepare(
            `SELECT balance_cents FROM wallets WHERE user_id = ? LIMIT 1`
          ).bind(tx.user_id).first<{ balance_cents: number }>();
          const current = Number(w?.balance_cents ?? 0);
          if (current < tx.amount_cents) {
            return bad("Insufficient funds for withdrawal", 400);
          }
        }

        await ctx.env.DB.prepare(
          `UPDATE wallets
              SET balance_cents = COALESCE(balance_cents,0) + ?
            WHERE user_id = ?`
        ).bind(sign * Math.abs(tx.amount_cents), tx.user_id).run();
      }
    }

    // Update status
    await ctx.env.DB.prepare(
      `UPDATE transactions SET status = ? WHERE id = ?`
    ).bind(newStatus, id).run();

    return json({ ok: true });
  } catch (e: any) {
    if (e?.status === 403) return json({ ok: false, error: "Forbidden" }, 403);
    return bad("Unable to update transaction", 500);
  }
};
