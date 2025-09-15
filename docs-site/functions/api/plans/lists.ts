// functions/api/plans/list.ts
export const onRequestGet: PagesFunction = async ({ env }) => {
  const rows = await env.DB.prepare('SELECT id,name,min_deposit_cents,terms FROM plans').all();
  return Response.json({ plans: rows.results || [] });
};
