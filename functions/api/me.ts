import { json, requireAuth, type Env } from "../_utils";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const g = await requireAuth(env, request);
  if (!g.ok) return g.res;
  return json({ user: g.user });
};
