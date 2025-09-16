// functions/api/admin/transactions.ts
import { json, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = [
  requireAdmin,
  async ({ env, request }) => {
    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
      const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
      const status = url.searchParams.get("status")?.trim();

      const params: any[] = [];
      let where = "";
      if (status) { where = "WHERE status = ?1"; params.push(status); }

      const list = await env.DB.prepare(
        `SELECT id, user_id, kind, amount_cents, currency, status, txid, created_at
           FROM transactions
           ${where}
           ORDER BY created_at DESC
           LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}`
      ).bind(...params, limit, offset).all();

      const countStmt = status
        ? env.DB.prepare("SELECT COUNT(*) AS c FROM transactions WHERE status = ?1").bind(status)
        : env.DB.prepare("SELECT COUNT(*) AS c FROM transactions");
      const count = await countStmt.first<number>("c");

      return json({
        ok: true,
        transactions: list.results || [],
        meta: { count: Number(count ?? 0), limit, offset, status: status || null },
      });
    } catch (err: any) {
      console.error("admin/transactions error:", err?.stack || err);
      return json({ ok: false, error: String(err?.message || err) }, { status: 500 });
    }
  },
];
