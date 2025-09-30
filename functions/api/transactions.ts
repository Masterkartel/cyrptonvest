import { json, bad, requireAuth, type Env } from "../_utils";

type TxRow = {
  id: string;
  user_id: string;
  wallet_id?: string;
  kind: string;
  amount_cents: number;
  currency: string;
  status: string;
  ref: string | null;                // t.memo (now full)
  created_at: number | string | null;
};

function extractAddressFromRef(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  const tail = s.split("→").pop()?.trim() || s;
  const tron = tail.match(/T[1-9A-HJ-NP-Za-km-z]{33}/g);
  if (tron && tron.length) return tron[tron.length - 1];
  const hex = tail.match(/0x[a-fA-F0-9]{38,}/g);
  if (hex && hex.length) return hex[hex.length - 1];
  const alnum = tail.match(/[A-Za-z0-9]{20,}/g);
  if (alnum && alnum.length) return alnum[alnum.length - 1];
  return tail;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const sess = await requireAuth(ctx.request, ctx.env);

    const url = new URL(ctx.request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
      200
    );

    const res = await ctx.env.DB.prepare(
      `SELECT t.id, t.user_id, t.wallet_id, t.kind, t.amount_cents,
              COALESCE(w.currency, 'USD') AS currency,
              t.status,
              t.memo AS ref,
              t.created_at
         FROM txs t
         LEFT JOIN wallets w ON w.id = t.wallet_id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC
        LIMIT ?`
    )
      .bind(sess.sub, limit)
      .all<TxRow>();

    const out = (res.results || []).map((t) => {
      let created = Number(t.created_at ?? 0);
      if (!Number.isFinite(created)) {
        const parsed = Date.parse(String(t.created_at || ""));
        created = Number.isFinite(parsed) ? parsed : 0;
      } else if (created > 0 && created < 1e12) {
        created *= 1000;
      }

      const ref_full = extractAddressFromRef(t.ref || "");

      return {
        id: t.id,
        kind: t.kind,
        amount_cents: Number(t.amount_cents || 0),
        currency: t.currency || "USD",
        status: t.status || "pending",
        ref: t.ref || "",
        ref_full,                 // full address for client if needed
        created_at: created,
      };
    });

    return json({ ok: true, transactions: out });
  } catch (e: any) {
    if (e?.status === 401) return json({ ok: false, error: "Unauthorized" }, 401);
    return bad("Unable to load transactions", 500);
  }
};
