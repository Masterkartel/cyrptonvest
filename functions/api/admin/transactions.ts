// functions/api/admin/transactions.ts
import { json, bad, requireAdmin, type Env } from "../../_utils";

type TxRow = {
  id: string;
  user_id: string;
  wallet_id: string;
  kind: "deposit" | "withdraw" | string;
  amount_cents: number;
  currency: string;
  status: "pending" | "completed" | "failed" | string;
  ref: string | null;
  created_at: number | string | null;
  user_email?: string;
};

/**
 * GET /api/admin/transactions
 * Query params:
 *   - status: pending|completed|failed (default: pending)
 *   - kind: deposit|withdraw (optional)
 *   - limit: 1..200 (default: 100)
 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);

    const url = new URL(ctx.request.url);
    const status = (url.searchParams.get("status") || "pending").toLowerCase();
    const kind   = (url.searchParams.get("kind")   || "").toLowerCase();
    const limit  = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), 200);

    const where: string[] = [];
    const binds: any[] = [];

    if (status) {
      where.push("t.status = ?");
      binds.push(status);
    }
    if (kind === "deposit" || kind === "withdraw") {
      where.push("t.kind = ?");
      binds.push(kind);
    }

    const sql =
      `SELECT t.id,
              t.user_id,
              t.wallet_id,
              u.email AS user_email,
              t.kind,
              t.amount_cents,
              COALESCE(w.currency,'USD') AS currency,
              t.status,
              t.memo AS ref,
              t.created_at
         FROM txs t
         LEFT JOIN users   u ON u.id = t.user_id
         LEFT JOIN wallets w ON w.id = t.wallet_id
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY t.created_at DESC
        LIMIT ?`;

    const res = await ctx.env.DB.prepare(sql).bind(...binds, limit).all<TxRow>();

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
        user_email: t.user_email || "",
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

/**
 * PATCH /api/admin/transactions
 * Body: { id: string, status: "pending"|"completed"|"failed" }
 * Notes:
 *  - No raw BEGIN/COMMIT (D1 doesn’t support them).
 *  - If status -> completed, we update the specific wallet (by wallet_id) first,
 *    then flip the tx status. If wallet update fails, we don’t change the tx.
 */
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);
    const { id, status } = await ctx.request.json().catch(() => ({}));
    const newStatus = String(status || "").toLowerCase();

    if (!id || !["completed", "failed", "pending"].includes(newStatus)) {
      return bad("Provide id and a valid status", 400);
    }

    // Load tx (need wallet_id, amount, kind, current status)
    const tx = await ctx.env.DB.prepare(
      `SELECT t.id, t.user_id, t.wallet_id, t.kind, t.amount_cents,
              COALESCE(w.currency,'USD') AS currency,
              t.status
         FROM txs t
         LEFT JOIN wallets w ON w.id = t.wallet_id
        WHERE t.id = ? LIMIT 1`
    ).bind(id).first<TxRow>();

    if (!tx) return bad("Transaction not found", 404);
    if (!tx.wallet_id) return bad("Transaction has no wallet_id", 400);
    if (tx.status === newStatus) return json({ ok: true });

    // If completing, adjust wallet FIRST
    if (newStatus === "completed") {
      const kind = String(tx.kind).toLowerCase();
      const isWithdraw = kind === "withdraw" || kind === "withdrawal" || kind.includes("withdraw");
      const delta = isWithdraw ? -Math.abs(tx.amount_cents) : +Math.abs(tx.amount_cents);

      // Overdraft check for withdrawals
      if (delta < 0) {
        const w = await ctx.env.DB.prepare(
          `SELECT balance_cents FROM wallets WHERE id = ? LIMIT 1`
        ).bind(tx.wallet_id).first<{ balance_cents: number }>();
        const current = Number(w?.balance_cents ?? 0);
        if (current < Math.abs(delta)) {
          return bad("Insufficient funds for withdrawal", 400);
        }
      }

      const updWallet = await ctx.env.DB.prepare(
        `UPDATE wallets
            SET balance_cents = COALESCE(balance_cents,0) + ?
          WHERE id = ?`
      ).bind(delta, tx.wallet_id).run();

      if (updWallet.meta.changes !== 1) {
        return bad("Wallet not updated", 500);
      }
    }

    // Update tx status LAST
    const updTx = await ctx.env.DB.prepare(
      `UPDATE txs SET status = ? WHERE id = ?`
    ).bind(newStatus, id).run();

    if (updTx.meta.changes !== 1) {
      return bad("Unable to update tx status", 500);
    }

    return json({ ok: true });
  } catch (e: any) {
    if (e?.status === 403) return json({ ok: false, error: "Forbidden" }, 403);
    return bad("Unable to update transaction", 500);
  }
};
