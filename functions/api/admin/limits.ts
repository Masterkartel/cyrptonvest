// functions/api/admin/limits.ts
import { json, requireAdmin, type Env } from "../../_utils";

/**
 * GET  /api/admin/limits?user=<uuid-or-email>
 *   -> returns current limit flags for the user
 *
 * PATCH /api/admin/limits
 *   body: { user: "<uuid-or-email>", disallow_starter?: boolean, disallow_growth?: boolean, disallow_pro?: boolean }
 *   -> upserts flags
 */

// Resolve a user by id or email
async function resolveUserId(DB: D1Database, u: string) {
  // try exact id first
  let row = await DB.prepare("SELECT id,email FROM users WHERE id=?").bind(u).first<{ id: string; email: string }>();
  if (row?.id) return row;

  // then try email
  row = await DB.prepare("SELECT id,email FROM users WHERE email=?").bind(u).first<{ id: string; email: string }>();
  return row || null;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const gate = await requireAdmin(env, request);
  if (!gate.ok) return gate.res;

  const url = new URL(request.url);
  const userParam = (url.searchParams.get("user") || "").trim();
  if (!userParam) return json({ error: "Missing ?user" }, 400);

  const user = await resolveUserId(env.DB, userParam);
  if (!user) return json({ error: "User not found" }, 404);

  const lim =
    (await env.DB
      .prepare(
        `SELECT user_id,disallow_starter,disallow_growth,disallow_pro
         FROM user_limits WHERE user_id=?`
      )
      .bind(user.id)
      .first<{
        user_id: string;
        disallow_starter: number;
        disallow_growth: number;
        disallow_pro: number;
      }>()) || {
      user_id: user.id,
      disallow_starter: 0,
      disallow_growth: 0,
      disallow_pro: 0,
    };

  return json({
    user_id: user.id,
    email: user.email,
    disallow_starter: !!lim.disallow_starter,
    disallow_growth: !!lim.disallow_growth,
    disallow_pro: !!lim.disallow_pro,
  });
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const gate = await requireAdmin(env, request);
  if (!gate.ok) return gate.res;

  const body = await request
    .json()
    .catch(() => ({} as any)) as { user?: string; disallow_starter?: boolean; disallow_growth?: boolean; disallow_pro?: boolean };

  const userParam = (body.user || "").trim();
  if (!userParam) return json({ error: "Body must include { user }" }, 400);

  const user = await resolveUserId(env.DB, userParam);
  if (!user) return json({ error: "User not found" }, 404);

  const ds = body.disallow_starter === true ? 1 : body.disallow_starter === false ? 0 : undefined;
  const dg = body.disallow_growth === true ? 1 : body.disallow_growth === false ? 0 : undefined;
  const dp = body.disallow_pro === true ? 1 : body.disallow_pro === false ? 0 : undefined;

  // If none provided, no-op
  if (ds === undefined && dg === undefined && dp === undefined) {
    return json({ ok: true, note: "No changes" });
  }

  // Upsert pattern: insert defaults, then update specific columns
  await env.DB
    .prepare(
      `INSERT INTO user_limits (user_id, disallow_starter, disallow_growth, disallow_pro)
       VALUES (?, COALESCE(?,0), COALESCE(?,0), COALESCE(?,0))
       ON CONFLICT(user_id) DO UPDATE SET
         disallow_starter = COALESCE(excluded.disallow_starter, user_limits.disallow_starter),
         disallow_growth  = COALESCE(excluded.disallow_growth , user_limits.disallow_growth ),
         disallow_pro     = COALESCE(excluded.disallow_pro    , user_limits.disallow_pro    )`
    )
    .bind(
      user.id,
      ds as any,
      dg as any,
      dp as any
    )
    .run();

  return json({ ok: true });
};
