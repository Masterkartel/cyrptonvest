import { json, requireAuth, type Env } from "../_utils";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const g = await requireAuth(env, request);
  if (!g.ok) return g.res;

  const { results } = await env.DB.prepare(
    `SELECT id,kind,amount_cents,currency,ref,status,created_at
       FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 200`
  ).bind(g.user.id).all<any>();

  return json({ transactions: results || [] });
};
