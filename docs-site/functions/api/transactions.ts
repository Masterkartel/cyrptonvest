// functions/api/transactions.ts
export const onRequestGet: PagesFunction = async ({ data, env }) => {
  if (!data.user) return new Response('Unauthorized', { status: 401 });
  const rows = await env.DB.prepare('SELECT id, kind, amount_cents, currency, ref, status, meta, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200')
    .bind(data.user.id).all();
  return Response.json({ transactions: rows.results || [] });
};
