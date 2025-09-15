// functions/api/wallet/withdraw.ts
import { v4 as uuid } from 'uuid';

export const onRequestPost: PagesFunction = async ({ data, env, request }) => {
  if (!data.user) return new Response('Unauthorized', { status: 401 });
  const { amount_cents, currency, network, address } = await request.json();
  if (!amount_cents || amount_cents <= 0) return new Response('Invalid amount', { status: 400 });
  // read balance
  const w = await env.DB.prepare('SELECT balance_cents FROM wallets WHERE user_id = ?').bind(data.user.id).first();
  if (!w || w.balance_cents < amount_cents) return new Response('Insufficient balance', { status: 400 });
  const id = uuid();
  const meta = JSON.stringify({ network, address });
  await env.DB.prepare('INSERT INTO transactions (id,user_id,kind,amount_cents,currency,ref,status,meta,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id, data.user.id, 'withdraw', amount_cents, currency||'USD', null, 'pending', meta, Date.now()).run();
  // Do NOT deduct immediately; wait until processed by ops.
  return Response.json({ ok:true, id });
};
