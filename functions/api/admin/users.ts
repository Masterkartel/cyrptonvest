// GET /api/admin/users?cursor=<id>&limit=50&search=foo  (auth: admin)
import { json, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  await requireAdmin(ctx.request, ctx.env);

  const url = new URL(ctx.request.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 50));
  const cursor = url.searchParams.get("cursor") || ""; // opaque user id to continue after
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();

  let sql = `SELECT id, email, created_at FROM users`;
  const args: any[] = [];

  const where: string[] = [];
  if (search) { where.push(`lower(email) LIKE ?`); args.push(`%${search}%`); }
  if (cursor) { where.push(`id > ?`); args.push(cursor); }

  if (where.length) sql += ` WHERE ` + where.join(` AND `);
  sql += ` ORDER BY id ASC LIMIT ?`; args.push(limit + 1);

  const rows = await ctx.env.DB.prepare(sql).bind(...args).all<{
    id: string; email: string; created_at: string | number;
  }>();

  const list = rows.results || [];
  const hasMore = list.length > limit;
  const page = hasMore ? list.slice(0, limit) : list;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return json({ ok: true, users: page, nextCursor });
};
