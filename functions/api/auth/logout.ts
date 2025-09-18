// functions/api/auth/logout.ts
import {
  json,
  parseCookies,
  cookieName,
  destroySession,        // sets expired cookie on the response
  destroySessionRecord,  // removes session row from D1
  type Env,
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const cookies = parseCookies(request);
    const sid = cookies[cookieName];

    // Remove DB record if present
    if (sid) {
      await destroySessionRecord(env, sid);
    }

    // Build response and append expired cookie header
    const res = json({ ok: true }, 200);
    destroySession(res, request);
    return res;
  } catch (e: any) {
    console.error("logout error:", e);
    return json({ ok: false, error: "Logout failed" }, 500);
  }
};
