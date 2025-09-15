import { json, parseCookies, clearCookie } from "../../../_utils";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const cookies = parseCookies(request);
  const sid = cookies["session"];
  if (sid) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie("session") });
};
