// functions/api/admin/limits.ts
import { json, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const g = await requireAdmin(ctx.env, ctx.request);
  if (!g.ok) return g.res;

  // Placeholder values; wire these to KV/D1 later if needed
  return json({
    ok: true,
    limits: {
      starterMin: 5,
      starterMax: 10,
      growthMin: 50,
      growthMax: 400,
      proMin: 500,
      proMax: 10000,
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const g = await requireAdmin(ctx.env, ctx.request);
  if (!g.ok) return g.res;

  // Accept payload but don’t persist yet (stub)
  await ctx.request.json().catch(() => ({}));
  return json({ ok: true, saved: false, message: "stub only" });
};
