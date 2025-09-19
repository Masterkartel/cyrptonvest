export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  try {
    await requireAdmin(ctx.request, ctx.env);
    const { id, status } = await ctx.request.json().catch(() => ({}));
    const newStatus = String(status || "").toLowerCase();

    if (!id || !["completed", "failed", "pending"].includes(newStatus)) {
      return bad("Provide id and a valid status", 400);
    }

    // Load tx
    const tx = await ctx.env.DB.prepare(
      `SELECT t.id, t.user_id, t.wallet_id, t.kind, t.amount_cents,
              COALESCE(w.currency,'USD') AS currency,
              t.status
         FROM txs t
         LEFT JOIN wallets w ON w.id = t.wallet_id
        WHERE t.id = ? LIMIT 1`
    ).bind(id).first<TxRow>();

    if (!tx) return bad("Transaction not found", 404);
    if (!tx.wallet_id) return bad("Transaction has no wallet_id", 400);

    if (tx.status === newStatus) {
      return json({ ok: true, transaction: tx });
    }

    // If moving to completed, adjust wallet first
    if (newStatus === "completed") {
      const kind = String(tx.kind).toLowerCase();
      const isWithdraw =
        kind === "withdraw" || kind === "withdrawal" || kind.includes("withdraw");
      const delta = isWithdraw ? -Math.abs(tx.amount_cents) : +Math.abs(tx.amount_cents);

      // Check overdraft
      if (delta < 0) {
        const w = await ctx.env.DB.prepare(
          `SELECT balance_cents FROM wallets WHERE id = ? LIMIT 1`
        ).bind(tx.wallet_id).first<{ balance_cents: number }>();
        const current = Number(w?.balance_cents ?? 0);
        if (current < Math.abs(delta)) {
          return bad("Insufficient funds for withdrawal", 400);
        }
      }

      const updWallet = await ctx.env.DB.prepare(
        `UPDATE wallets
            SET balance_cents = COALESCE(balance_cents,0) + ?
          WHERE id = ?`
      ).bind(delta, tx.wallet_id).run();

      if (updWallet.meta.changes !== 1) {
        return bad("Wallet not updated", 500);
      }
    }

    // Always update tx status last
    const updTx = await ctx.env.DB.prepare(
      `UPDATE txs SET status = ? WHERE id = ?`
    ).bind(newStatus, id).run();

    if (updTx.meta.changes !== 1) {
      return bad("Unable to update tx status", 500);
    }

    return json({ ok: true });
  } catch (e: any) {
    if (e?.status === 403) return json({ ok: false, error: "Forbidden" }, 403);
    return bad(`Unable to update transaction: ${String(e)}`, 500);
  }
};
