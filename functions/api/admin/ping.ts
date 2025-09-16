// functions/api/admin/ping.ts
import { json, requireAdmin, type Env } from "../../_utils";

export const onRequestGet: PagesFunction<Env> = [
  requireAdmin,
  async ({ env }) => {
    try {
      const pong = await env.DB.prepare("SELECT 1 AS ok").first("ok");
      return json({ ok: true, db: pong === 1 ? "ready" : "weird" });
    } catch (e: any) {
      return json({ ok: false, error: String(e?.message || e) }, { status: 500 });
    }
  },
];
