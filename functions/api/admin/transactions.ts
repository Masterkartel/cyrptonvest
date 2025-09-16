// functions/api/admin/transactions.ts
import { json, requireAdmin, type Env } from "../../_utils";

/**
 * GET /api/admin/transactions?status=pending&limit=50&offset=0
 * status: pending|cleared|failed (optional)
 */
export const onRequestGet: PagesFunction<Env> = [
  requireAdmin,
  async ({ env, request }) => {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
    const status = url.searchParams.get("status")?.trim();

    const params: any[] = [];
    let where = "";
    if (status) {
      where = "WHERE status = ?1";
      params.push(status);
    }

    const rows = await env.DB.prepare(
      `SELECT id, user_id, kind, amount_cents, currency, status, txid, created_at
         FROM transactions
         ${where}
         ORDER BY created_at DESC
         LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}`
    ).bind(...params, limit, offset).all();

    const count = await env.DB.prepare(
      status
        ? "SELECT COUNT(*) AS c FROM transactions WHERE status = ?1"
        : "SELECT COUNT(*) AS c FROM transactions"
    ).bind(...(status ? [status] : [])).first("c");

    return json({
      ok: true,
      transactions: rows.results ?? [],
      meta: { count: Number(count ?? 0), limit, offset, status: status || null },
    });
  },
];
