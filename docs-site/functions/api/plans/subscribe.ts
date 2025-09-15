// functions/api/plans/subscribe.ts
import { v4 as uuid } from 'uuid';

export const onRequestPost: PagesFunction = async ({ data, env, request }) => {
  if (!data.user) return new Response('Unauthorized', { status: 401 });
  const { plan_id } = await request.json();
  const plan = await env.DB.prepare('SELECT id, min_deposit_cents FROM plans WHERE id = ?').bind(plan_id).first();
  if (!plan) return new Response('Plan not found', { status: 404 });
  // Just record subscription; funding threshold enforcement is up to your ops.
  const id = uuid();
  await env.DB.prepare('INSERT INTO user_plans (id,user_id,plan_id,started_at,status) VALUES (?,?,?,?,?)')
    .bind(id, data.user.id, plan_id, Date.now(), 'active').run();
  return Response.json({ ok:true });
};
