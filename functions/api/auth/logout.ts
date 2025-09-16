// functions/api/auth/logout.ts
import { json, parseCookies, clearCookie, destroySession, headerSetCookie, cookieName, type Env } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const cookies = parseCookies(request.headers.get("cookie") || "");
    const sid = cookies[cookieName];
    if (sid) await destroySession(env, sid);

    // set an expired cookie
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", "set-cookie": headerSetCookie(env, "", new Date(0)) },
    });
  } catch (e: any) {
    return json({ error: `Logout failed: ${e?.message || e}` }, { status: 500 });
  }
};
