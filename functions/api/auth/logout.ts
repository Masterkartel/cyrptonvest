import { json, parseCookies, clearCookie, destroySession, type Env } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const name = env.SESSION_COOKIE_NAME || "cv_sid";
  const sid = parseCookies(request)[name];
  if (sid) await destroySession(env, sid);
  return new Response("", { status:204, headers: { "Set-Cookie": clearCookie(name) } });
};
