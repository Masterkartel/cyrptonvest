// functions/api/wallet/deposit.ts
import { v4 as uuid } from 'uuid';

export const onRequestPost: PagesFunction = async ({ data, env, request }) => {
  if (!data.user) return new Response('Unauthorized', { status: 401 });
  const { amount_cents, currency, network, address, txid } = await request.json();
  if (!amount_cents || amount_cents <= 0) return new Response('Invalid amount', { status: 400 });
  const id = uuid();
  const meta = JSON.stringify({ network, address });
  await env.DB.prepare('INSERT INTO transactions (id,user_id,kind,amount_cents,currency,ref,status,meta,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id, data.user.id, 'deposit', amount_cents, currency||'USD', txid||null, 'pending', meta, Date.now()).run();
  // NOTE: An admin or webhook should later mark this completed and update balance.
  return Response.json({ ok:true, id });
};
