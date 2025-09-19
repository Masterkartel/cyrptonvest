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

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);
    const { id, status } = await ctx.request.json().catch(() => ({}));
    const newStatus = String(status || "").toLowerCase();

    if (!id || !["completed", "failed", "pending"].includes(newStatus)) {
      return bad("Provide id and a valid status", 400);
    }

    // Load tx (we need wallet_id, amount, kind, current status)
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

    // Decide wallet delta only when completing
    const kind = String(tx.kind).toLowerCase();
    const isWithdraw = kind === "withdraw" || kind === "withdrawal" || kind.includes("withdraw");
    const delta = (newStatus === "completed")
      ? (isWithdraw ? -Math.abs(tx.amount_cents) : +Math.abs(tx.amount_cents))
      : 0;

    // Start atomic txn so we don't change balance without flipping status
    await ctx.env.DB.exec("BEGIN");

    // 1) Flip status FIRST; only from current status to newStatus.
    //    If you're approving, require it's currently pending.
    const statusWhere = (newStatus === "completed" || newStatus === "failed")
      ? "AND lower(status)='pending'"
      : ""; // allow toggling back to pending if you want; otherwise enforce previous state as well.

    const upd = await ctx.env.DB.prepare(
      `UPDATE txs
          SET status = ?
        WHERE id = ?
        ${statusWhere}`
    ).bind(newStatus, id).run();

    if (upd.meta.changes !== 1) {
      await ctx.env.DB.exec("ROLLBACK");
      return bad("Unable to update: transaction not pending or id mismatch", 409);
    }

    // 2) If marking completed, mutate the exact wallet row
    if (newStatus === "completed" && delta !== 0) {
      // Overdraft check for withdrawals
      if (delta < 0) {
        const w = await ctx.env.DB.prepare(
          `SELECT balance_cents FROM wallets WHERE id = ? LIMIT 1`
        ).bind(tx.wallet_id).first<{ balance_cents: number }>();
        const current = Number(w?.balance_cents ?? 0);
        if (current < Math.abs(delta)) {
          await ctx.env.DB.exec("ROLLBACK");
          return bad("Insufficient funds for withdrawal", 400);
        }
      }

      const bal = await ctx.env.DB.prepare(
        `UPDATE wallets
            SET balance_cents = COALESCE(balance_cents,0) + ?
          WHERE id = ?`
      ).bind(delta, tx.wallet_id).run();

      if (bal.meta.changes !== 1) {
        await ctx.env.DB.exec("ROLLBACK");
        return bad("Wallet not updated", 409);
      }
    }

    await ctx.env.DB.exec("COMMIT");
    return json({ ok: true });
  } catch (e: any) {
    // Try to ensure no partial updates remain
    try { await (ctx.env.DB as any).exec("ROLLBACK"); } catch {}
    if (e?.status === 403) return json({ ok: false, error: "Forbidden" }, 403);
    return bad(`Unable to update transaction: ${String(e)}`, 500);
  }
};
