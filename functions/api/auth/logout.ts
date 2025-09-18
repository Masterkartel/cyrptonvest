// functions/api/auth/logout.ts
import { json, parseCookies, cookieName, destroySessionRecord, destroySession, type Env } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const cookies = parseCookies(request);
    const sid = cookies[cookieName];

    // 1) Drop DB record (best-effort)
    if (sid) {
      try { await destroySessionRecord(env, sid); } catch {}
    }

    // 2) Return a response with an expired cookie for the client
    const res = json({ ok: true });
    destroySession(res, request);
    return res;
  } catch (e: any) {
    return json({ ok: false, error: `Logout failed: ${e?.message || e}` }, 500);
  }
};
