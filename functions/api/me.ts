import { json, getUserFromSession, type Env } from "../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const sess = await getUserFromSession(ctx.request, ctx.env);
  if (!sess) return json({ ok: false, user: null }, 401);
  return json({ ok: true, user: { id: sess.sub, email: sess.email, role: sess.role } });
};
