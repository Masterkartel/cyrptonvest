import { json, bad, requireAdmin, type Env } from "../../_utils";

type TxRow = {
  id: string;
  user_id: string;
  wallet_id: string;
  kind: "deposit" | "withdraw" | string;
  amount_cents: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "posted" | string;
  ref: string | null;                  // t.memo
  created_at: number | string | null;
  user_email?: string;
};

function normalizeStatus(raw: string): "pending" | "approved" | "rejected" | null {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "approve" || s === "approved" || s === "complete" || s === "completed") return "approved";
  if (s === "reject"  || s === "rejected"  || s === "fail"     || s === "failed")   return "rejected";
  if (s === "pending") return "pending";
  return null;
}

// Pull a full address out of WITHDRAW memos, supports TRON and generic long tokens
function extractAddressFromRef(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  // Prefer content after an arrow if present
  const tail = s.split("→").pop()?.trim() || s;

  // TRON (TRC20): starts with T, 34 total Base58 chars
  const tron = tail.match(/T[1-9A-HJ-NP-Za-km-z]{33}/g);
  if (tron && tron.length) return tron[tron.length - 1];

  // Ethereum-like long hex
  const hex = tail.match(/0x[a-fA-F0-9]{38,}/g);
  if (hex && hex.length) return hex[hex.length - 1];

  // Generic long alphanumeric
  const alnum = tail.match(/[A-Za-z0-9]{20,}/g);
  if (alnum && alnum.length) return alnum[alnum.length - 1];

  return tail;
}

/**
 * GET /api/admin/transactions
 * ?status=pending|approved|rejected|posted (default: pending)
 * ?kind=deposit|withdraw (optional)
 * ?limit=1..200 (default: 100)
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
    if (status) { where.push("t.status = ?"); binds.push(status); }
    if (kind === "deposit" || kind === "withdraw") { where.push("t.kind = ?"); binds.push(kind); }

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
      // normalize created_at to ms
      let created = Number(t.created_at ?? 0);
      if (!Number.isFinite(created)) {
        const parsed = Date.parse(String(t.created_at || ""));
        created = Number.isFinite(parsed) ? parsed : 0;
      } else if (created > 0 && created < 1e12) {
        created *= 1000;
      }

      const ref_full = extractAddressFromRef(t.ref || "");

      return {
        id: t.id,
        user_id: t.user_id,
        user_email: t.user_email || "",
        kind: t.kind,
        amount_cents: Number(t.amount_cents || 0),
        currency: t.currency || "USD",
        status: t.status,
        ref: t.ref || "",
        ref_full,                 // <-- full, no ellipsis
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
 * Body: { id: string, status: "approve|approved|completed|reject|rejected|failed|pending" }
 */
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);

    const body = await ctx.request.json().catch(() => ({} as any));
    const id = String(body?.id ?? body?.txId ?? body?.transactionId ?? body?.tx_id ?? "").trim();
    const newStatus = normalizeStatus(String(body?.status ?? body?.state ?? body?.action ?? ""));

    if (!id || !newStatus) return bad("Provide id and valid status", 400);

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

    const oldStatus = String(tx.status || "").trim().toLowerCase();
    if (oldStatus === newStatus) return json({ ok: true });

    const updTx = await ctx.env.DB.prepare(
      `UPDATE txs SET status = ? WHERE id = ?`
    ).bind(newStatus, id).run();

    if (updTx.meta.changes !== 1) {
      return bad("Unable to update tx status", 409);
    }

    if (newStatus === "approved") {
      const kind = String(tx.kind).toLowerCase();
      const isWithdraw = (kind === "withdraw" || kind === "withdrawal" || kind.includes("withdraw"));
      const delta = isWithdraw ? -Math.abs(tx.amount_cents) : +Math.abs(tx.amount_cents);

      if (delta < 0) {
        const w = await ctx.env.DB.prepare(
          `SELECT balance_cents FROM wallets WHERE id = ? LIMIT 1`
        ).bind(tx.wallet_id).first<{ balance_cents: number }>();
        const current = Number(w?.balance_cents ?? 0);
        if (current < Math.abs(delta)) {
          await ctx.env.DB.prepare(`UPDATE txs SET status = ? WHERE id = ?`)
            .bind(oldStatus || "pending", id).run();
          return bad("Insufficient funds for withdrawal", 400);
        }
      }

      const updWallet = await ctx.env.DB.prepare(
        `UPDATE wallets
            SET balance_cents = COALESCE(balance_cents,0) + ?
          WHERE id = ?`
      ).bind(delta, tx.wallet_id).run();

      if (updWallet.meta.changes !== 1) {
        await ctx.env.DB.prepare(`UPDATE txs SET status = ? WHERE id = ?`)
          .bind(oldStatus || "pending", id).run();
        return bad("Wallet not updated", 500);
      }
    }

    return json({ ok: true });
  } catch (e: any) {
    if (e?.status === 403) return json({ ok: false, error: "Forbidden" }, 403);
    return bad("Unable to update transaction", 500);
  }
};
