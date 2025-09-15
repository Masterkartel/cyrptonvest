import { json, bad } from "../../_utils";

export const onRequestPost: PagesFunction = async ({ data, env, request }) => {
  if (!data.user) return new Response("Unauthorized", { status: 401 });

  let body: any = {};
  try { body = await request.json(); } catch { return bad("Invalid JSON"); }

  const plan_id = (body.plan_id || "").toString();
  if (!plan_id) return bad("Missing plan_id");

  const plan = await env.DB.prepare("SELECT id FROM plans WHERE id = ?").bind(plan_id).first();
  if (!plan) return bad("Plan not found", 404);

  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO user_plans (id,user_id,plan_id,started_at,status) VALUES (?,?,?,?,?)")
    .bind(id, data.user.id, plan_id, Date.now(), "active").run();

  return json({ ok: true });
};
