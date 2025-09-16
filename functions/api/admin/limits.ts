import { json, requireAdmin, type Env } from "../../../_utils";

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const gate = await requireAdmin(env, request);
  if (!gate.ok) return gate.res;

  const body = await request.json().catch(() => ({}));
  const { user_id, disallow_starter=0, disallow_growth=0, disallow_pro=0 } = body || {};
  if (!user_id) return json({ error: "user_id required" }, 400);

  const now = Date.now();
  const stmt = env.DB.prepare(
    `INSERT INTO user_limits (user_id,disallow_starter,disallow_growth,disallow_pro,updated_at)
     VALUES (?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET
       disallow_starter=excluded.disallow_starter,
       disallow_growth=excluded.disallow_growth,
       disallow_pro=excluded.disallow_pro,
       updated_at=excluded.updated_at`
  ).bind(user_id, disallow_starter?1:0, disallow_growth?1:0, disallow_pro?1:0, now);

  await stmt.run();
  return json({ ok: true });
};
