// functions/api/auth/logout.ts
import { json, parseCookies, cookieName, type Env } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // Get session id from cookie
    const cookies = parseCookies(request);
    const sid = cookies[cookieName];

    // Best-effort: delete session row (ignore errors)
    if (sid) {
      try {
        await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sid).run();
      } catch {}
    }

    // Expire cookie (host-scoped; no Domain attribute required)
    const { protocol } = new URL(request.url);
    const secure = protocol === "https:" ? "; Secure" : "";
    const expired =
      `${cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json", "set-cookie": expired },
    });
  } catch (e: any) {
    return json({ ok: false, error: `Logout failed: ${e?.message || e}` }, 500);
  }
};
