// functions/api/admin/users.ts
import { json, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);

    // Pull minimal fields you need in the admin table
    const rows = await ctx.env.DB.prepare(
      `SELECT id, email, created_at
         FROM users
        ORDER BY created_at DESC`
    ).all<{ id: string; email: string; created_at: number }>();

    const users = (rows?.results || []).map(u => {
      const sec = Number(u.created_at || 0);
      const ms  = sec < 1e12 ? sec * 1000 : sec; // normalize to ms
      return { id: u.id, email: u.email, created_at_ms: ms };
    });

    return json({ ok: true, users });
  } catch (e:any) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }
};
