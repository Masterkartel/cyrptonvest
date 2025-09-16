import { json, parseCookies, clearCookie, headerSetCookie, destroySession, type Env } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const env = ctx.env;
    const name = env.SESSION_COOKIE_NAME || "cv_sid";
    const cookies = parseCookies(ctx.request);
    const sid = cookies[name];
    if (sid) await destroySession(env, sid);

    const cleared = clearCookie(name, "/");
    return headerSetCookie(json({ ok: true }), cleared);
  } catch (e: any) {
    return json({ ok: false, error: "logout_failed", detail: String(e?.message || e) }, 500);
  }
};
