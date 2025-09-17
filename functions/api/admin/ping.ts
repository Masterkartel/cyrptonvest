// GET /api/admin/ping  (auth: admin)
import { json, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  await requireAdmin(ctx.request, ctx.env);
  return json({ ok: true, pong: true });
};
