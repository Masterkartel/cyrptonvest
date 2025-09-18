// functions/api/admin/users.ts
import { json, requireAdmin, type Env } from "../../_utils";

type Row = {
  id: string;
  email: string;
  created_at: number | string | null;
  balance_cents: number | null;
  currency: string | null;
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);

    const url = new URL(ctx.request.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    // Left join wallets so users with no wallet still show up
    // Filter on email when q is provided
    const stmt = q
      ? ctx.env.DB.prepare(
          `SELECT u.id, u.email, u.created_at, w.balance_cents, w.currency
             FROM users u
             LEFT JOIN wallets w ON w.user_id = u.id
            WHERE lower(u.email) LIKE ?
            ORDER BY u.created_at DESC`
        ).bind(`%${q}%`)
      : ctx.env.DB.prepare(
          `SELECT u.id, u.email, u.created_at, w.balance_cents, w.currency
             FROM users u
             LEFT JOIN wallets w ON w.user_id = u.id
            ORDER BY u.created_at DESC`
        );

    const res = await stmt.all<Row>();
    const users = (res.results || []).map((u) => {
      // Normalize created_at → milliseconds for UI
      let ms = 0;
      const v = u.created_at as any;
      if (typeof v === "number") {
        ms = v < 1e12 ? v * 1000 : v; // seconds → ms
      } else if (typeof v === "string" && v) {
        const parsed = Date.parse(v);
        ms = Number.isFinite(parsed) ? parsed : 0;
      }
      return {
        id: u.id,
        email: u.email,
        created_at_ms: ms,
        balance_cents: Number(u.balance_cents ?? 0),
        currency: u.currency || "USD",
      };
    });

    return json({ ok: true, users });
  } catch (e: any) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }
};
